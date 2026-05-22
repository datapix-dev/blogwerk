import type { Job } from "bullmq"
import fs from "fs/promises"
import path from "path"
import { db } from "../../lib/db"
import type { JobErrorType } from "@prisma/client"
import type { ContentBlock } from "../../lib/ai/claude"
import { transformBlocksToAstro } from "../../lib/adapters/astro-blog"

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
  },
  cfg: CustomApiConfig,
  publishLive: boolean
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

  const astroBlocks = Array.isArray(article.blocks)
    ? transformBlocksToAstro(article.blocks as ContentBlock[])
    : []

  const payload: Record<string, unknown> = {
    title: article.title ?? "",
    slug: article.slug ?? undefined,
    excerpt: article.excerpt ?? "",
    tags: article.tags,
    category: cfg.category ?? "",
    status: publishLive ? "published" : "draft",
    ...(featuredImageUrl && { featuredImage: featuredImageUrl }),
    ...(featuredImageUrl && article.imageAlt && { featuredImageAlt: article.imageAlt }),
    seo: {
      title: article.metaTitle ?? article.title ?? "",
      description: article.metaDescription ?? "",
      robots: "index,follow",
    },
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
        const result = await publishToAstroBlog(article, cfg, publishLive)
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
