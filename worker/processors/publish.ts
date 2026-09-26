import type { Job } from "bullmq"
import fs from "fs/promises"
import path from "path"
import { db } from "../../lib/db"
import type { JobErrorType } from "@prisma/client"
import type { ContentBlock, InternalLinkSuggestion } from "../../lib/ai/claude"
import { transformBlocksToAstro } from "../../lib/adapters/astro-blog"
import { buildJsonLd, canonicalUrl } from "../../lib/adapters/schema-ld"
import { resolveInternalLinks, type LinkTarget } from "../../lib/adapters/internal-links"

interface PublishJobData {
  articleId: string
  connectionId: string
  publishLive?: boolean
}

interface WordPressConfig {
  url: string
  username: string
  applicationPassword: string
  defaultAuthorId?: number
  defaultCategoryId?: number
  publishMode: "draft" | "publish"
}

interface CustomApiConfig {
  baseUrl: string
  authType: "api_key" | "bearer"
  authValue: string
  postEndpoint: string
  imageEndpoint?: string
  fieldMapping: Record<string, string>
  format?: "astro-blog"
  category?: string
}

function classifyPublishError(err: unknown): JobErrorType {
  const message = err instanceof Error ? err.message.toLowerCase() : ""
  if (
    message.includes("401") ||
    message.includes("invalid credentials") ||
    message.includes("unauthorized")
  ) {
    return "INVALID_WP_CREDENTIALS"
  }
  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed") ||
    message.includes("timeout")
  ) {
    return "NETWORK_ERROR"
  }
  return "UNKNOWN"
}

async function publishToWordPress(
  article: {
    id: string
    title: string | null
    contentHtml: string | null
    slug: string | null
    metaTitle: string | null
    metaDescription: string | null
    excerpt: string | null
    tags: string[]
    featuredImage: string | null
    externalId: string | null
  },
  cfg: WordPressConfig
): Promise<{ postUrl: string; wpPostId: number }> {
  const url = cfg.url.replace(/\/$/, "")
  const credentials = Buffer.from(
    `${cfg.username}:${cfg.applicationPassword}`
  ).toString("base64")
  const authHeader = `Basic ${credentials}`

  const body: Record<string, unknown> = {
    title: article.title ?? "",
    content: article.contentHtml ?? "",
    slug: article.slug ?? undefined,
    status: cfg.publishMode === "publish" ? "publish" : "draft",
    excerpt: article.excerpt ?? "",
    meta: {
      _yoast_wpseo_title: article.metaTitle ?? "",
      _yoast_wpseo_metadesc: article.metaDescription ?? "",
    },
  }

  const isUpdate = !!article.externalId
  const endpoint = isUpdate
    ? `${url}/wp-json/wp/v2/posts/${article.externalId}`
    : `${url}/wp-json/wp/v2/posts`

  const res = await fetch(endpoint, {
    method: isUpdate ? "PUT" : "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (res.status === 401) {
    throw new Error("401 Invalid WordPress credentials")
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `WordPress POST failed with HTTP ${res.status}: ${text.slice(0, 300)}`
    )
  }

  const data = (await res.json()) as { id: number; link: string }
  return { postUrl: data.link, wpPostId: data.id }
}

async function uploadAstroMedia(
  filePath: string,
  slug: string | null,
  authHeaders: Record<string, string>,
  base: string
): Promise<string | null> {
  try {
    const fileBuffer = await fs.readFile(filePath)
    const ext = path.extname(filePath) || ".webp"
    const fileName = `${slug ?? "featured-image"}${ext}`

    const form = new FormData()
    form.append("file", new Blob([fileBuffer], { type: "image/webp" }), fileName)

    const res = await fetch(`${base}/api/blog/admin/media`, {
      method: "POST",
      headers: authHeaders,
      body: form,
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.warn(`[publish] Media upload failed ${res.status}: ${text.slice(0, 200)}`)
      return null
    }

    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch (err) {
    console.warn(`[publish] Media upload error: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

interface AstroPublishContext {
  /** Project blog root, e.g. https://example.com — required for canonical + JSON-LD. */
  blogUrl: string | null
  projectName: string
  language: string
  authorName: string
  publishedAt: Date
  modifiedAt: Date
  /** Already-published pages of this project plus hand-mapped keyword URLs. */
  linkTargets: LinkTarget[]
}

async function publishToAstroBlog(
  article: {
    id: string
    title: string | null
    slug: string | null
    metaTitle: string | null
    metaDescription: string | null
    excerpt: string | null
    tags: string[]
    blocks: unknown
    externalId: string | null
    featuredImage: string | null
    imageAlt: string | null
    internalLinkSuggestions: unknown
  },
  cfg: CustomApiConfig,
  publishLive: boolean,
  ctx: AstroPublishContext
): Promise<{ postUrl: string; externalId: string }> {
  const base = cfg.baseUrl.replace(/\/$/, "")
  const authHeaders: Record<string, string> =
    cfg.authType === "bearer"
      ? { Authorization: `Bearer ${cfg.authValue}` }
      : { "X-Api-Key": cfg.authValue }

  // Upload featured image if we have a local file
  let featuredImageUrl: string | undefined
  if (article.featuredImage) {
    const uploaded = await uploadAstroMedia(article.featuredImage, article.slug, authHeaders, base)
    if (uploaded) featuredImageUrl = uploaded
  }

  const blocks = Array.isArray(article.blocks) ? (article.blocks as ContentBlock[]) : []
  const astroBlocks = transformBlocksToAstro(blocks, ctx.language)

  const seo: Record<string, unknown> = {
    title: article.metaTitle ?? article.title ?? "",
    description: article.metaDescription ?? "",
    robots: "index,follow",
  }

  // Canonical + JSON-LD need the project's blog root. Without it we publish as
  // before rather than emitting a broken relative URL into structured data.
  if (ctx.blogUrl && article.slug) {
    seo.canonical = canonicalUrl(ctx.blogUrl, article.slug)
    seo.jsonLd = buildJsonLd({
      title: article.title ?? "",
      slug: article.slug,
      excerpt: article.excerpt ?? "",
      blocks,
      blogUrl: ctx.blogUrl,
      language: ctx.language,
      publisherName: ctx.projectName,
      authorName: ctx.authorName,
      publishedAt: ctx.publishedAt,
      modifiedAt: ctx.modifiedAt,
      featuredImage: featuredImageUrl ?? null,
      imageAlt: article.imageAlt,
    })
  } else {
    console.warn(
      `[publish] Article ${article.id}: no project blogUrl or slug — skipping canonical + JSON-LD`
    )
  }

  const suggestions = Array.isArray(article.internalLinkSuggestions)
    ? (article.internalLinkSuggestions as InternalLinkSuggestion[])
    : []
  const internalLinks = resolveInternalLinks(suggestions, ctx.linkTargets, {
    excludeUrl: ctx.blogUrl && article.slug ? canonicalUrl(ctx.blogUrl, article.slug) : null,
  })

  const payload: Record<string, unknown> = {
    title: article.title ?? "",
    slug: article.slug ?? undefined,
    excerpt: article.excerpt ?? "",
    tags: article.tags,
    category: cfg.category ?? "",
    status: publishLive ? "published" : "draft",
    ...(featuredImageUrl && { featuredImage: featuredImageUrl }),
    ...(featuredImageUrl && article.imageAlt && { featuredImageAlt: article.imageAlt }),
    ...(internalLinks.length && { internalLinks }),
    seo,
    content: astroBlocks,
  }

  const isUpdate = !!article.externalId
  const endpoint = isUpdate
    ? `${base}/api/blog/admin/posts/${article.externalId}`
    : `${base}/api/blog/admin/posts`

  const res = await fetch(endpoint, {
    method: isUpdate ? "PUT" : "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Astro Blog POST failed with HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { id?: string | number; url?: string; slug?: string }
  const externalId = String(data.id ?? article.externalId ?? "")
  const postUrl = data.url ?? `${base}/blog/${data.slug ?? article.slug ?? ""}`
  return { postUrl, externalId }
}

async function publishToCustomApi(
  article: {
    id: string
    title: string | null
    contentHtml: string | null
    slug: string | null
    metaTitle: string | null
    metaDescription: string | null
    excerpt: string | null
    tags: string[]
    featuredImage: string | null
  },
  cfg: CustomApiConfig
): Promise<{ postUrl: string; externalId: string }> {
  const authHeader =
    cfg.authType === "bearer" ? `Bearer ${cfg.authValue}` : cfg.authValue

  const defaultPayload: Record<string, unknown> = {
    title: article.title,
    content: article.contentHtml,
    slug: article.slug,
    excerpt: article.excerpt,
    meta_title: article.metaTitle,
    meta_description: article.metaDescription,
    tags: article.tags,
    featured_image: article.featuredImage,
  }

  const mappingKeys = new Set(Object.keys(cfg.fieldMapping))
  const mappedPayload: Record<string, unknown> = {}
  for (const [ourKey, theirKey] of Object.entries(cfg.fieldMapping)) {
    if (ourKey in defaultPayload) {
      mappedPayload[theirKey] = defaultPayload[ourKey]
    }
  }
  for (const [key, value] of Object.entries(defaultPayload)) {
    if (!mappingKeys.has(key)) {
      mappedPayload[key] = value
    }
  }

  const postUrl = cfg.postEndpoint.startsWith("http")
    ? cfg.postEndpoint
    : `${cfg.baseUrl.replace(/\/$/, "")}${cfg.postEndpoint}`

  const res = await fetch(postUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mappedPayload),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `Custom API POST failed with HTTP ${res.status}: ${text.slice(0, 300)}`
    )
  }

  const data = (await res.json()) as {
    id?: string | number
    url?: string
    link?: string
  }
  return {
    postUrl: (data.url ?? data.link ?? postUrl) as string,
    externalId: String(data.id ?? ""),
  }
}

/**
 * Internal link destinations for a project: editor-mapped keyword URLs plus
 * everything this project has already published. Both were sitting unused —
 * Keyword.targetUrl was written by the UI and never read by any pipeline.
 */
async function loadLinkTargets(projectId: string, excludeArticleId: string): Promise<LinkTarget[]> {
  const [keywords, published] = await Promise.all([
    db.keyword.findMany({
      where: { projectId, targetUrl: { not: null } },
      select: { keyword: true, cluster: true, targetUrl: true },
    }),
    db.article.findMany({
      where: {
        projectId,
        status: "PUBLISHED",
        url: { not: null },
        id: { not: excludeArticleId },
      },
      select: { url: true, title: true, keyword: { select: { keyword: true, cluster: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ])

  const targets: LinkTarget[] = []
  const seen = new Set<string>()

  for (const k of keywords) {
    if (!k.targetUrl || seen.has(k.targetUrl)) continue
    seen.add(k.targetUrl)
    targets.push({ url: k.targetUrl, keyword: k.keyword, cluster: k.cluster })
  }

  for (const a of published) {
    if (!a.url || seen.has(a.url)) continue
    seen.add(a.url)
    targets.push({
      url: a.url,
      keyword: a.keyword?.keyword ?? a.title ?? "",
      cluster: a.keyword?.cluster ?? null,
      title: a.title,
    })
  }

  return targets
}

export async function processPublishJob(job: Job<PublishJobData>): Promise<void> {
  const { articleId, connectionId, publishLive = false } = job.data

  const genJob = await db.generationJob.findFirst({
    where: { articleId, status: "PENDING", type: "PUBLISH" },
  })
  if (!genJob) {
    console.warn(`[publish-processor] No PENDING PUBLISH job for article ${articleId}`)
    return
  }

  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  const [article, connection] = await Promise.all([
    db.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentHtml: true,
        metaTitle: true,
        metaDescription: true,
        excerpt: true,
        tags: true,
        featuredImage: true,
        imageAlt: true,
        externalId: true,
        blocks: true,
        projectId: true,
        publishAt: true,
        createdAt: true,
        updatedAt: true,
        internalLinkSuggestions: true,
        author: { select: { name: true } },
        project: { select: { name: true, blogUrl: true, language: true } },
      },
    }),
    db.apiConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, type: true, config: true },
    }),
  ])

  if (!article) throw new Error(`Article not found: ${articleId}`)
  if (!connection) throw new Error(`Connection not found: ${connectionId}`)

  let postUrl: string
  let externalId: string

  try {
    if (connection.type === "WORDPRESS") {
      const cfg = connection.config as unknown as WordPressConfig
      const result = await publishToWordPress(article, cfg)
      postUrl = result.postUrl
      externalId = String(result.wpPostId)
    } else if (connection.type === "CUSTOM_API") {
      const cfg = connection.config as unknown as CustomApiConfig
      if (cfg.format === "astro-blog") {
        const result = await publishToAstroBlog(article, cfg, publishLive, {
          blogUrl: article.project.blogUrl,
          projectName: article.project.name,
          language: article.project.language,
          authorName: article.author?.name ?? article.project.name,
          // First publish sets the date; later updates keep it and only move
          // dateModified, which is what freshness signals actually key on.
          publishedAt: article.publishAt ?? article.createdAt,
          modifiedAt: article.updatedAt,
          linkTargets: await loadLinkTargets(article.projectId, article.id),
        })
        postUrl = result.postUrl
        externalId = result.externalId
      } else {
        const result = await publishToCustomApi(article, cfg)
        postUrl = result.postUrl
        externalId = result.externalId
      }
    } else {
      throw new Error(`Unknown connection type: ${connection.type}`)
    }
  } catch (err) {
    const errorType = classifyPublishError(err)
    const errorMsg = err instanceof Error ? err.message : "Unknown error"

    await db.$transaction([
      db.generationJob.update({
        where: { id: genJob.id },
        data: { status: "FAILED", errorType, errorMsg },
      }),
      db.article.update({
        where: { id: articleId },
        data: { status: "FAILED" },
      }),
    ])

    throw err
  }

  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: {
        status: "PUBLISHED",
        url: postUrl,
        externalId,
        publishMode: "PUBLISH",
        // Stamp the publication date once; re-publishes must not reset it or
        // every update would look like a brand-new article to crawlers.
        ...(article.publishAt ? {} : { publishAt: new Date() }),
      },
    }),
    db.generationJob.update({
      where: { id: genJob.id },
      data: {
        status: "COMPLETED",
        result: { postUrl, externalId },
      },
    }),
    db.apiConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    }),
  ])

  console.log(`[publish-processor] Article ${articleId} published → ${postUrl}`)
}
