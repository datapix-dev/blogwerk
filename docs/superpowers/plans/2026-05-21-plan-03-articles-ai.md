# BlogPlanner — Plan 03: Articles + AI Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end AI article generation — Claude API integration, BullMQ worker processor, Server Actions, Articles list page, Generate dialog with SWR polling, and Article detail editor — deployed to blogwerk.astro-it.de.

**Architecture:** Claude claude-sonnet-4-6 via `@anthropic-ai/sdk`, BullMQ worker in separate Docker container, Server Actions for all mutations, SWR polling for job status, no WYSIWYG in V1 (HTML preview + source + Markdown tabs).

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table v8, SWR, BullMQ, Prisma 7, `@anthropic-ai/sdk`

---

## File Map

```
blog/
├── lib/
│   └── ai/
│       ├── claude.ts                                      # NEW — Anthropic SDK singleton + generateArticle()
│       └── prompts.ts                                     # NEW — system prompt + user prompt builder
├── worker/
│   ├── processors/
│   │   └── article.ts                                     # NEW — BullMQ job processor
│   └── index.ts                                           # MODIFY — wire up real processor
├── server/
│   └── actions/
│       └── articles.ts                                    # NEW — all article server actions
├── app/
│   ├── (dashboard)/
│   │   └── articles/
│   │       ├── page.tsx                                   # MODIFY — full server component
│   │       └── [id]/
│   │           └── page.tsx                               # NEW — article detail server component
│   └── api/
│       └── articles/
│           └── [id]/
│               └── status/
│                   └── route.ts                           # NEW — SWR polling endpoint
└── components/
    └── features/
        └── articles/
            ├── articles-table.tsx                         # NEW — client DataTable
            ├── generate-article-dialog.tsx                # NEW — 3-step generate dialog
            └── article-editor.tsx                         # NEW — full editor client component
```

---

## Task 1: Claude AI Client + Article Generation Prompt

**Files:**
- Create: `lib/ai/claude.ts`
- Create: `lib/ai/prompts.ts`

- [ ] **Step 1: Create `lib/ai/claude.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt, buildUserPrompt } from "./prompts"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type GenerateArticleParams = {
  keyword: string
  language: string
  targetAudience?: string | null
  toneOfVoice?: string | null
  articleTemplate?: string | null
  formattingTemplate?: string | null
}

export type GeneratedArticle = {
  title: string
  slug: string
  contentHtml: string
  contentMarkdown: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  tags: string[]
}

export async function generateArticle(
  params: GenerateArticleParams
): Promise<GeneratedArticle> {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(params)

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("")

  // Strip markdown code fences if Claude wrapped the JSON
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) 
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${rawText.slice(0, 200)}`)
  }

  const obj = parsed as Record<string, unknown>

  const required = [
    "title",
    "slug",
    "contentHtml",
    "contentMarkdown",
    "metaTitle",
    "metaDescription",
    "excerpt",
    "tags",
  ] as const

  for (const field of required) {
    if (!obj[field] && obj[field] !== "") {
      throw new Error(`Claude response missing required field: ${field}`)
    }
  }

  return {
    title: String(obj.title),
    slug: String(obj.slug),
    contentHtml: String(obj.contentHtml),
    contentMarkdown: String(obj.contentMarkdown),
    metaTitle: String(obj.metaTitle),
    metaDescription: String(obj.metaDescription),
    excerpt: String(obj.excerpt),
    tags: Array.isArray(obj.tags)
      ? (obj.tags as unknown[]).map(String)
      : [],
  }
}
```

- [ ] **Step 2: Create `lib/ai/prompts.ts`**

```typescript
import type { GenerateArticleParams } from "./claude"

export function buildSystemPrompt(): string {
  return `You are an expert SEO content writer. Your task is to write high-quality, long-form blog articles optimized for search engines and human readers.

CRITICAL: You MUST return ONLY a valid JSON object. No prose, no markdown outside the JSON, no explanation. The response must be parseable by JSON.parse().

The JSON object must have exactly these fields:
{
  "title": "string — compelling, SEO-optimized H1 title",
  "slug": "string — URL-friendly slug derived from title, lowercase, hyphens only",
  "contentHtml": "string — complete article as valid HTML (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags). WordPress-compatible. No <html>/<head>/<body> wrapper.",
  "contentMarkdown": "string — same article content in Markdown format",
  "metaTitle": "string — SEO meta title, max 60 characters",
  "metaDescription": "string — SEO meta description, 140-160 characters",
  "excerpt": "string — 1-2 sentence article summary for listings",
  "tags": ["array", "of", "relevant", "tags"]
}

Content requirements:
- Minimum 1200 words of substantive content
- Use clear H2 and H3 subheadings for structure
- Include an introduction and conclusion
- Write in the specified language
- Respect tone of voice instructions if provided
- Tags: 3-7 relevant lowercase tags`
}

export function buildUserPrompt(params: GenerateArticleParams): string {
  const lines: string[] = [
    `Write a complete SEO blog article for the following keyword:`,
    ``,
    `Keyword: ${params.keyword}`,
    `Language: ${params.language}`,
  ]

  if (params.targetAudience) {
    lines.push(`Target Audience: ${params.targetAudience}`)
  }

  if (params.toneOfVoice) {
    lines.push(`Tone of Voice: ${params.toneOfVoice}`)
  }

  if (params.articleTemplate) {
    lines.push(``, `Article Structure Template:`, params.articleTemplate)
  }

  if (params.formattingTemplate) {
    lines.push(``, `Formatting Instructions:`, params.formattingTemplate)
  }

  lines.push(
    ``,
    `Remember: Return ONLY the JSON object. No other text.`
  )

  return lines.join("\n")
}
```

---

## Task 2: Worker Article Processor

**Files:**
- Create: `worker/processors/article.ts`
- Modify: `worker/index.ts`

- [ ] **Step 1: Create `worker/processors/article.ts`**

```typescript
import type { Job } from "bullmq"
import { db } from "@/lib/db"
import { generateArticle } from "@/lib/ai/claude"
import type { JobErrorType } from "@prisma/client"

export type ArticleJobData = {
  articleId: string
  keywordId: string
  projectId: string
}

function classifyError(err: unknown): JobErrorType {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("timed out") || msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "CLAUDE_TIMEOUT"
  }
  if (
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("429") ||
    msg.includes("overloaded")
  ) {
    return "CLAUDE_RATE_LIMIT"
  }
  return "UNKNOWN"
}

export async function processArticleJob(job: Job<ArticleJobData>): Promise<void> {
  const { articleId, keywordId, projectId } = job.data

  // Find the most recent PENDING GenerationJob for this article
  const genJob = await db.generationJob.findFirst({
    where: { articleId, type: "ARTICLE_GENERATION", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (!genJob) {
    console.warn(`[article-processor] No PENDING GenerationJob for article ${articleId}`)
    return
  }

  // Mark as PROCESSING
  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  // Fetch all required data
  const [article, keyword, project, templates] = await Promise.all([
    db.article.findUnique({ where: { id: articleId } }),
    db.keyword.findUnique({ where: { id: keywordId } }),
    db.project.findUnique({ where: { id: projectId } }),
    db.promptTemplate.findMany({
      where: { projectId, isActive: true },
      orderBy: { version: "desc" },
    }),
  ])

  if (!article || !project) {
    await db.generationJob.update({
      where: { id: genJob.id },
      data: { status: "FAILED", errorType: "UNKNOWN", errorMsg: "Article or project not found" },
    })
    return
  }

  const articleTemplate = templates.find((t) => t.type === "ARTICLE")?.content ?? null
  const formattingTemplate = templates.find((t) => t.type === "FORMATTING")?.content ?? null

  try {
    const generated = await generateArticle({
      keyword: keyword?.keyword ?? article.title ?? "blog article",
      language: project.language,
      targetAudience: project.targetAudience,
      toneOfVoice: project.toneOfVoice,
      articleTemplate,
      formattingTemplate,
    })

    // Determine current month for usage tracking
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // All DB updates in a transaction
    await db.$transaction([
      // Update article with generated content
      db.article.update({
        where: { id: articleId },
        data: {
          title: generated.title,
          slug: generated.slug,
          contentHtml: generated.contentHtml,
          contentMarkdown: generated.contentMarkdown,
          metaTitle: generated.metaTitle,
          metaDescription: generated.metaDescription,
          excerpt: generated.excerpt,
          tags: generated.tags,
          status: "AI_GENERATED",
        },
      }),
      // Mark job COMPLETED
      db.generationJob.update({
        where: { id: genJob.id },
        data: {
          status: "COMPLETED",
          result: {
            title: generated.title,
            slug: generated.slug,
            tagsCount: generated.tags.length,
            htmlLength: generated.contentHtml.length,
          },
        },
      }),
      // Upsert usage record
      db.workspaceUsage.upsert({
        where: { workspaceId_month: { workspaceId: project.workspaceId, month } },
        create: { workspaceId: project.workspaceId, month, articleCount: 1 },
        update: { articleCount: { increment: 1 } },
      }),
      // Mark keyword as GENERATED
      ...(keyword
        ? [db.keyword.update({ where: { id: keyword.id }, data: { status: "GENERATED" } })]
        : []),
    ])

    console.log(`[article-processor] Article ${articleId} generated successfully: "${generated.title}"`)
  } catch (err) {
    const errorType = classifyError(err)
    const errorMsg = err instanceof Error ? err.message : String(err)

    console.error(`[article-processor] Article ${articleId} FAILED (${errorType}):`, errorMsg)

    await db.generationJob.update({
      where: { id: genJob.id },
      data: { status: "FAILED", errorType, errorMsg: errorMsg.slice(0, 1000) },
    })

    await db.article.update({
      where: { id: articleId },
      data: { status: "FAILED" },
    })

    // Re-throw so BullMQ can apply retry/backoff
    throw err
  }
}
```

- [ ] **Step 2: Modify `worker/index.ts`**

```typescript
import { Worker } from "bullmq"
import { redis } from "../lib/redis"
import { processArticleJob } from "./processors/article"
import type { ArticleJobData } from "./processors/article"

console.log("BlogPlanner Worker starting...")

const articleWorker = new Worker<ArticleJobData>(
  "article-generation",
  async (job) => {
    console.log(`[article-generation] Processing job ${job.id} — article ${job.data.articleId}`)
    await processArticleJob(job)
  },
  { connection: redis, concurrency: 2 }
)

const imageWorker = new Worker(
  "image-generation",
  async (job) => {
    console.log(`[image-generation] Processing job ${job.id}`)
    return { status: "stub" }
  },
  { connection: redis, concurrency: 3 }
)

const publishWorker = new Worker(
  "publish",
  async (job) => {
    console.log(`[publish] Processing job ${job.id}`)
    return { status: "stub" }
  },
  { connection: redis, concurrency: 2 }
)

articleWorker.on("completed", (job) =>
  console.log(`[article-generation] Job ${job.id} completed — article ${job.data.articleId}`)
)
articleWorker.on("failed", (job, err) =>
  console.error(`[article-generation] Job ${job?.id} failed:`, err.message)
)
imageWorker.on("completed", (job) => console.log(`[image-generation] Job ${job.id} completed`))
imageWorker.on("failed", (job, err) =>
  console.error(`[image-generation] Job ${job?.id} failed:`, err.message)
)
publishWorker.on("completed", (job) => console.log(`[publish] Job ${job.id} completed`))
publishWorker.on("failed", (job, err) =>
  console.error(`[publish] Job ${job?.id} failed:`, err.message)
)

console.log("Worker ready. Listening for jobs...")
```

---

## Task 3: Article Server Actions + Generation Trigger

**Files:**
- Create: `server/actions/articles.ts`
- Create: `app/api/articles/[id]/status/route.ts`

- [ ] **Step 1: Create `server/actions/articles.ts`**

```typescript
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { articleGenerationQueue } from "@/worker/queues/index"
import type { ArticleStatus } from "@prisma/client"

export type ArticleWithRelations = {
  id: string
  projectId: string
  keywordId: string | null
  authorId: string | null
  title: string | null
  slug: string | null
  contentHtml: string | null
  contentMarkdown: string | null
  metaTitle: string | null
  metaDescription: string | null
  excerpt: string | null
  category: string | null
  tags: string[]
  featuredImage: string | null
  status: ArticleStatus
  createdAt: Date
  updatedAt: Date
  project: { id: string; name: string }
  keyword: { id: string; keyword: string } | null
  author: { id: string; name: string | null; email: string } | null
  generationJobs: {
    id: string
    type: string
    status: string
    errorType: string | null
    errorMsg: string | null
    attempts: number
    createdAt: Date
    updatedAt: Date
  }[]
}

export type ArticleFilters = {
  projectId?: string
  status?: ArticleStatus
  search?: string
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function getArticles(filters?: ArticleFilters): Promise<ArticleWithRelations[]> {
  const session = await requireSession()
  return db.article.findMany({
    where: {
      project: { workspaceId: session.user.workspaceId },
      ...(filters?.projectId && { projectId: filters.projectId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && {
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { slug: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      keyword: { select: { id: true, keyword: true } },
      author: { select: { id: true, name: true, email: true } },
      generationJobs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          errorType: true,
          errorMsg: true,
          attempts: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })
}

export async function getArticleById(id: string): Promise<ArticleWithRelations | null> {
  const session = await requireSession()
  return db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    include: {
      project: { select: { id: true, name: true } },
      keyword: { select: { id: true, keyword: true } },
      author: { select: { id: true, name: true, email: true } },
      generationJobs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          errorType: true,
          errorMsg: true,
          attempts: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })
}

export async function generateArticleAction(
  keywordId: string
): Promise<{ success: true; articleId: string } | { success: false; error: string; code?: string }> {
  const session = await requireSession()
  const workspaceId = session.user.workspaceId

  // Verify keyword belongs to workspace
  const keyword = await db.keyword.findFirst({
    where: { id: keywordId, project: { workspaceId } },
    include: { project: true },
  })
  if (!keyword) return { success: false, error: "Keyword not found." }

  // Check monthly usage limit
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [workspace, usage] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { monthlyGenLimit: true } }),
    db.workspaceUsage.findUnique({ where: { workspaceId_month: { workspaceId, month } } }),
  ])

  const currentCount = usage?.articleCount ?? 0
  const limit = workspace?.monthlyGenLimit ?? 100

  if (currentCount >= limit) {
    return {
      success: false,
      error: `Monthly generation limit reached (${currentCount}/${limit}). Upgrade your plan or wait until next month.`,
      code: "RATE_LIMIT_REACHED",
    }
  }

  try {
    // Create Article (DRAFT) + GenerationJob (PENDING) in a transaction
    const { article, job } = await db.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          projectId: keyword.projectId,
          keywordId: keyword.id,
          authorId: session.user.id ?? null,
          status: "DRAFT",
          publishMode: keyword.project.defaultPublishMode,
        },
      })

      const job = await tx.generationJob.create({
        data: {
          articleId: article.id,
          type: "ARTICLE_GENERATION",
          status: "PENDING",
          payload: { keywordId, projectId: keyword.projectId },
        },
      })

      return { article, job }
    })

    // Enqueue BullMQ job
    await articleGenerationQueue.add(
      "generate",
      { articleId: article.id, keywordId, projectId: keyword.projectId },
      { jobId: job.id }
    )

    revalidatePath("/articles")
    return { success: true, articleId: article.id }
  } catch (err) {
    console.error("[generateArticleAction]", err)
    return { success: false, error: "Failed to start article generation." }
  }
}

export type UpdateArticleInput = {
  title?: string
  slug?: string
  contentHtml?: string
  contentMarkdown?: string
  metaTitle?: string
  metaDescription?: string
  excerpt?: string
  category?: string
  tags?: string[]
  featuredImage?: string
  publishMode?: "DRAFT" | "SCHEDULED" | "PUBLISH"
  publishAt?: Date | null
  url?: string
}

export async function updateArticle(
  id: string,
  data: UpdateArticleInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, projectId: true },
  })
  if (!existing) return { success: false, error: "Article not found." }

  try {
    await db.article.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.contentHtml !== undefined && { contentHtml: data.contentHtml }),
        ...(data.contentMarkdown !== undefined && { contentMarkdown: data.contentMarkdown }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.featuredImage !== undefined && { featuredImage: data.featuredImage }),
        ...(data.publishMode !== undefined && { publishMode: data.publishMode }),
        ...(data.publishAt !== undefined && { publishAt: data.publishAt }),
        ...(data.url !== undefined && { url: data.url }),
      },
    })
    revalidatePath("/articles")
    revalidatePath(`/articles/${id}`)
    return { success: true }
  } catch (err) {
    console.error("[updateArticle]", err)
    return { success: false, error: "Failed to update article." }
  }
}

export async function deleteArticles(
  ids: string[]
): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  const session = await requireSession()
  if (!ids.length) return { success: false, error: "No article IDs provided." }
  const owned = await db.article.findMany({
    where: { id: { in: ids }, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  const ownedIds = owned.map((a) => a.id)
  if (!ownedIds.length) return { success: false, error: "No matching articles found." }
  try {
    const { count } = await db.article.deleteMany({ where: { id: { in: ownedIds } } })
    revalidatePath("/articles")
    return { success: true, deleted: count }
  } catch (err) {
    console.error("[deleteArticles]", err)
    return { success: false, error: "Failed to delete articles." }
  }
}

export async function updateArticleStatus(
  id: string,
  status: ArticleStatus
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "Article not found." }
  try {
    await db.article.update({ where: { id }, data: { status } })
    revalidatePath("/articles")
    revalidatePath(`/articles/${id}`)
    return { success: true }
  } catch (err) {
    console.error("[updateArticleStatus]", err)
    return { success: false, error: "Failed to update article status." }
  }
}
```

- [ ] **Step 2: Create `app/api/articles/[id]/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const article = await db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: {
      status: true,
      generationJobs: {
        where: { type: "ARTICLE_GENERATION" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          errorType: true,
          errorMsg: true,
          attempts: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const latestJob = article.generationJobs[0] ?? null

  return NextResponse.json({
    status: article.status,
    errorType: latestJob?.errorType ?? null,
    errorMsg: latestJob?.errorMsg ?? null,
    job: latestJob,
  })
}
```

---

## Task 4: Articles List Page + Generate Dialog

**Files:**
- Modify: `app/(dashboard)/articles/page.tsx`
- Create: `components/features/articles/articles-table.tsx`
- Create: `components/features/articles/generate-article-dialog.tsx`

- [ ] **Step 1: Modify `app/(dashboard)/articles/page.tsx`**

```typescript
import { getArticles } from "@/server/actions/articles"
import { getProjects } from "@/server/actions/projects"
import { getKeywords } from "@/server/actions/keywords"
import { ArticlesTable } from "@/components/features/articles/articles-table"

export const metadata = { title: "Articles — BlogPlanner" }

export default async function ArticlesPage() {
  const [articles, projects, keywords] = await Promise.all([
    getArticles(),
    getProjects(),
    getKeywords({ status: "OPEN" }),
  ])
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))
  const keywordOptions = keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    projectId: k.projectId,
    projectName: k.project.name,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty,
    intent: k.intent,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Articles</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Generate and manage AI-written articles for your projects.
        </p>
      </div>
      <ArticlesTable
        initialData={articles}
        projects={projectOptions}
        keywords={keywordOptions}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/features/articles/articles-table.tsx`**

```typescript
"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Trash2, Eye, Sparkles, X, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "../data-table"
import { StatusBadge } from "../status-badge"
import { GenerateArticleDialog } from "./generate-article-dialog"
import { deleteArticles } from "@/server/actions/articles"
import type { ArticleWithRelations } from "@/server/actions/articles"
import type { ArticleStatus } from "@prisma/client"

interface ProjectOption {
  id: string
  name: string
}

interface KeywordOption {
  id: string
  keyword: string
  projectId: string
  projectName: string
  searchVolume: number | null
  difficulty: number | null
  intent: string | null
}

interface ArticlesTableProps {
  initialData: ArticleWithRelations[]
  projects: ProjectOption[]
  keywords: KeywordOption[]
}

const ALL_VALUE = "__all__"

const ARTICLE_STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "AI_GENERATED", label: "AI Generated" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
]

export function ArticlesTable({ initialData, projects, keywords }: ArticlesTableProps) {
  const router = useRouter()
  const [data, setData] = React.useState<ArticleWithRelations[]>(initialData)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<ArticleStatus | "">("")
  const [projectFilter, setProjectFilter] = React.useState("")
  const [selectedRows, setSelectedRows] = React.useState<ArticleWithRelations[]>([])
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const filteredData = React.useMemo(
    () =>
      data.filter((a) => {
        if (search) {
          const q = search.toLowerCase()
          if (
            !a.title?.toLowerCase().includes(q) &&
            !a.keyword?.keyword.toLowerCase().includes(q) &&
            !a.slug?.toLowerCase().includes(q)
          )
            return false
        }
        if (statusFilter && a.status !== statusFilter) return false
        if (projectFilter && a.projectId !== projectFilter) return false
        return true
      }),
    [data, search, statusFilter, projectFilter]
  )

  function handleSuccess() {
    router.refresh()
  }

  async function handleBulkDelete() {
    if (!selectedRows.length) return
    if (!confirm(`Delete ${selectedRows.length} article(s)?`)) return
    const ids = selectedRows.map((r) => r.id)
    const result = await deleteArticles(ids)
    if (result.success) {
      setData((prev) => prev.filter((a) => !ids.includes(a.id)))
      setSelectedRows([])
    }
  }

  async function handleSingleDelete(id: string) {
    if (!confirm("Delete this article?")) return
    const result = await deleteArticles([id])
    if (result.success) setData((prev) => prev.filter((a) => a.id !== id))
  }

  const columns: ColumnDef<ArticleWithRelations>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Title <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="max-w-xs">
          <span className="font-medium text-zinc-900 line-clamp-2 text-sm">
            {row.original.title ?? (
              <span className="text-zinc-400 italic">Untitled</span>
            )}
          </span>
          {row.original.slug && (
            <p className="text-xs text-zinc-400 truncate mt-0.5">{row.original.slug}</p>
          )}
        </div>
      ),
    },
    {
      id: "keyword",
      header: "Keyword",
      cell: ({ row }) =>
        row.original.keyword ? (
          <span className="text-sm text-zinc-600">{row.original.keyword.keyword}</span>
        ) : (
          <span className="text-zinc-300">—</span>
        ),
    },
    {
      id: "project",
      header: "Project",
      cell: ({ row }) => (
        <span className="text-xs text-zinc-500 truncate max-w-[120px] block">
          {row.original.project.name}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 130,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Updated <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 110,
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-400">
          {format(new Date(getValue() as Date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg w-7 h-7 hover:bg-muted transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => router.push(`/articles/${row.original.id}`)}>
              <Eye className="w-3.5 h-3.5 mr-2" />View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => handleSingleDelete(row.original.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm mb-3">
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-red-500/80 border-red-400/50 text-white hover:bg-red-500"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setSelectedRows([])}
          >
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={filteredData}
        enableRowSelection
        onRowSelectionChange={setSelectedRows}
        emptyTitle="No articles yet"
        emptyDescription="Generate your first article by selecting a keyword."
        emptyAction={
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Article
          </Button>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 text-sm"
            />
            <Select
              value={statusFilter || ALL_VALUE}
              onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : (v as ArticleStatus))}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {ARTICLE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={projectFilter || ALL_VALUE}
              onValueChange={(v) => setProjectFilter(v === ALL_VALUE ? "" : v)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Button size="sm" className="h-8" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Article
              </Button>
            </div>
          </div>
        }
      />
      <GenerateArticleDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        keywords={keywords}
        onSuccess={handleSuccess}
      />
    </>
  )
}
```

- [ ] **Step 3: Create `components/features/articles/generate-article-dialog.tsx`**

```typescript
"use client"

import * as React from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "../status-badge"
import { generateArticleAction } from "@/server/actions/articles"
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Search,
} from "lucide-react"

interface KeywordOption {
  id: string
  keyword: string
  projectId: string
  projectName: string
  searchVolume: number | null
  difficulty: number | null
  intent: string | null
}

interface GenerateArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keywords: KeywordOption[]
  onSuccess?: () => void
}

type DialogStep = "select" | "generating" | "done" | "error"

type StatusResponse = {
  status: string
  errorType: string | null
  errorMsg: string | null
  job: {
    id: string
    status: string
    errorType: string | null
    errorMsg: string | null
    attempts: number
  } | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ERROR_MESSAGES: Record<string, string> = {
  CLAUDE_TIMEOUT: "Claude API timed out. The server will retry automatically.",
  CLAUDE_RATE_LIMIT: "Claude rate limit reached. Please wait a moment and try again.",
  RATE_LIMIT_REACHED: "Monthly generation limit reached. Upgrade your plan or wait until next month.",
  UNKNOWN: "An unknown error occurred during generation.",
}

export function GenerateArticleDialog({
  open,
  onOpenChange,
  keywords,
  onSuccess,
}: GenerateArticleDialogProps) {
  const router = useRouter()
  const [step, setStep] = React.useState<DialogStep>("select")
  const [search, setSearch] = React.useState("")
  const [selectedKeywordId, setSelectedKeywordId] = React.useState<string | null>(null)
  const [articleId, setArticleId] = React.useState<string | null>(null)
  const [articleStatus, setArticleStatus] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  // SWR polling — stops when terminal state reached
  const { data: statusData } = useSWR<StatusResponse>(
    step === "generating" && articleId ? `/api/articles/${articleId}/status` : null,
    fetcher,
    {
      refreshInterval:
        articleStatus === "AI_GENERATED" || articleStatus === "FAILED" ? 0 : 3000,
    }
  )

  // React to polling data
  React.useEffect(() => {
    if (!statusData) return
    setArticleStatus(statusData.status)
    if (statusData.status === "AI_GENERATED") {
      setStep("done")
      onSuccess?.()
    } else if (statusData.status === "FAILED") {
      const errType = statusData.errorType ?? "UNKNOWN"
      setErrorMessage(ERROR_MESSAGES[errType] ?? ERROR_MESSAGES.UNKNOWN)
      setStep("error")
    }
  }, [statusData, onSuccess])

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep("select")
      setSearch("")
      setSelectedKeywordId(null)
      setArticleId(null)
      setArticleStatus(null)
      setErrorMessage(null)
      setLoading(false)
    }
  }, [open])

  const filteredKeywords = React.useMemo(
    () =>
      keywords.filter(
        (k) =>
          !search ||
          k.keyword.toLowerCase().includes(search.toLowerCase()) ||
          k.projectName.toLowerCase().includes(search.toLowerCase())
      ),
    [keywords, search]
  )

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId)

  async function handleGenerate() {
    if (!selectedKeywordId) return
    setLoading(true)
    try {
      const result = await generateArticleAction(selectedKeywordId)
      if (!result.success) {
        setErrorMessage(
          result.code === "RATE_LIMIT_REACHED"
            ? ERROR_MESSAGES.RATE_LIMIT_REACHED
            : result.error
        )
        setStep("error")
        return
      }
      setArticleId(result.articleId)
      setStep("generating")
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.")
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  function handleViewArticle() {
    if (articleId) router.push(`/articles/${articleId}`)
    onOpenChange(false)
  }

  function handleRetry() {
    setStep("select")
    setArticleId(null)
    setArticleStatus(null)
    setErrorMessage(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Generate Article
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: SELECT KEYWORD */}
        {step === "select" && (
          <div className="space-y-4 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <Input
                placeholder="Search keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {filteredKeywords.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                  No open keywords found.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredKeywords.map((kw) => (
                    <button
                      key={kw.id}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors flex items-start gap-3 ${
                        selectedKeywordId === kw.id ? "bg-violet-50" : ""
                      }`}
                      onClick={() => setSelectedKeywordId(kw.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            selectedKeywordId === kw.id
                              ? "text-violet-700"
                              : "text-zinc-900"
                          }`}
                        >
                          {kw.keyword}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">{kw.projectName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {kw.searchVolume != null && (
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {kw.searchVolume.toLocaleString()}
                          </span>
                        )}
                        {kw.difficulty != null && (
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${
                              kw.difficulty >= 70
                                ? "text-red-600 border-red-200"
                                : kw.difficulty >= 40
                                ? "text-amber-600 border-amber-200"
                                : "text-emerald-600 border-emerald-200"
                            }`}
                          >
                            {kw.difficulty}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedKeyword && (
              <>
                <Separator />
                <div className="bg-zinc-50 rounded-xl p-3 space-y-1.5 text-sm">
                  <p className="font-medium text-zinc-900">{selectedKeyword.keyword}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>Project: {selectedKeyword.projectName}</span>
                    {selectedKeyword.searchVolume != null && (
                      <span>Volume: {selectedKeyword.searchVolume.toLocaleString()}</span>
                    )}
                    {selectedKeyword.difficulty != null && (
                      <span>Difficulty: {selectedKeyword.difficulty}</span>
                    )}
                    {selectedKeyword.intent && (
                      <span>Intent: {selectedKeyword.intent}</span>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedKeywordId || loading}
                onClick={handleGenerate}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Generate
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: GENERATING (polling) */}
        {step === "generating" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-violet-500" />
              </div>
              <Loader2 className="absolute -right-1 -bottom-1 w-5 h-5 text-violet-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Generating article...</p>
              <p className="text-sm text-zinc-500 mt-1">
                Claude is writing your article. This usually takes 20–60 seconds.
              </p>
            </div>
            {selectedKeyword && (
              <div className="bg-zinc-50 rounded-xl px-4 py-2.5 text-sm text-zinc-600 text-center">
                <span className="font-medium">{selectedKeyword.keyword}</span>
                <span className="text-zinc-400 ml-2">· {selectedKeyword.projectName}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: DONE */}
        {step === "done" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Article generated!</p>
              <p className="text-sm text-zinc-500 mt-1">
                Your article is ready for review and editing.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleViewArticle}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />View Article
              </Button>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {step === "error" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Generation failed</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                {errorMessage ?? "An unexpected error occurred."}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRetry}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Note: Add missing import to `generate-article-dialog.tsx` — `Eye` is already imported via `lucide-react`. Ensure `Eye` is in the import list at the top (it is included in the import block above).

---

## Task 5: Article Detail / Editor Page

**Files:**
- Create: `app/(dashboard)/articles/[id]/page.tsx`
- Create: `components/features/articles/article-editor.tsx`

- [ ] **Step 1: Create `app/(dashboard)/articles/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation"
import { getArticleById } from "@/server/actions/articles"
import { ArticleEditor } from "@/components/features/articles/article-editor"

export const metadata = { title: "Article — BlogPlanner" }

interface ArticlePageProps {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params
  const article = await getArticleById(id)
  if (!article) notFound()

  return (
    <div className="space-y-5">
      <ArticleEditor article={article} />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/features/articles/article-editor.tsx`**

```typescript
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusBadge } from "../status-badge"
import { updateArticle, updateArticleStatus, generateArticleAction } from "@/server/actions/articles"
import type { ArticleWithRelations } from "@/server/actions/articles"
import type { ArticleStatus } from "@prisma/client"
import {
  CheckCheck,
  Eye,
  RotateCcw,
  Save,
  Clock,
  Code2,
  FileText,
  ChevronLeft,
  Loader2,
  AlertCircle,
} from "lucide-react"

interface ArticleEditorProps {
  article: ArticleWithRelations
}

type ContentView = "preview" | "html" | "markdown"

const ERROR_TYPE_MESSAGES: Record<string, string> = {
  CLAUDE_TIMEOUT: "Claude API timed out",
  CLAUDE_RATE_LIMIT: "Claude rate limit reached",
  INVALID_WP_CREDENTIALS: "Invalid WordPress credentials",
  IMAGE_GENERATION_FAILED: "Image generation failed",
  RATE_LIMIT_REACHED: "Monthly generation limit reached",
  NETWORK_ERROR: "Network error",
  UNKNOWN: "Unknown error",
}

export function ArticleEditor({ article: initialArticle }: ArticleEditorProps) {
  const router = useRouter()

  // Editable fields
  const [title, setTitle] = React.useState(initialArticle.title ?? "")
  const [slug, setSlug] = React.useState(initialArticle.slug ?? "")
  const [contentHtml, setContentHtml] = React.useState(initialArticle.contentHtml ?? "")
  const [contentMarkdown, setContentMarkdown] = React.useState(
    initialArticle.contentMarkdown ?? ""
  )
  const [metaTitle, setMetaTitle] = React.useState(initialArticle.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = React.useState(
    initialArticle.metaDescription ?? ""
  )
  const [excerpt, setExcerpt] = React.useState(initialArticle.excerpt ?? "")
  const [tags, setTags] = React.useState(initialArticle.tags.join(", "))
  const [status, setStatus] = React.useState<ArticleStatus>(initialArticle.status)
  const [contentView, setContentView] = React.useState<ContentView>("preview")

  // Loading states
  const [saving, setSaving] = React.useState(false)
  const [approvingStatus, setApprovingStatus] = React.useState<string | null>(null)
  const [regenerating, setRegenerating] = React.useState(false)

  const isDirty = React.useMemo(() => {
    return (
      title !== (initialArticle.title ?? "") ||
      slug !== (initialArticle.slug ?? "") ||
      contentHtml !== (initialArticle.contentHtml ?? "") ||
      contentMarkdown !== (initialArticle.contentMarkdown ?? "") ||
      metaTitle !== (initialArticle.metaTitle ?? "") ||
      metaDescription !== (initialArticle.metaDescription ?? "") ||
      excerpt !== (initialArticle.excerpt ?? "") ||
      tags !== initialArticle.tags.join(", ")
    )
  }, [title, slug, contentHtml, contentMarkdown, metaTitle, metaDescription, excerpt, tags, initialArticle])

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateArticle(initialArticle.id, {
        title: title || undefined,
        slug: slug || undefined,
        contentHtml,
        contentMarkdown,
        metaTitle,
        metaDescription,
        excerpt,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Article saved.")
      router.refresh()
    } catch {
      toast.error("Failed to save article.")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: ArticleStatus) {
    setApprovingStatus(newStatus)
    try {
      const result = await updateArticleStatus(initialArticle.id, newStatus)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setStatus(newStatus)
      toast.success(
        newStatus === "APPROVED"
          ? "Article approved."
          : newStatus === "NEEDS_REVIEW"
          ? "Marked as needs review."
          : "Status updated."
      )
    } catch {
      toast.error("Failed to update status.")
    } finally {
      setApprovingStatus(null)
    }
  }

  async function handleRegenerate() {
    if (!initialArticle.keywordId) {
      toast.error("No keyword associated with this article.")
      return
    }
    if (
      !confirm(
        "Regenerate this article? The current content will be overwritten by the new generation."
      )
    )
      return
    setRegenerating(true)
    try {
      const result = await generateArticleAction(initialArticle.keywordId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Regeneration started. Redirecting to new article...")
      router.push(`/articles/${result.articleId}`)
    } catch {
      toast.error("Failed to start regeneration.")
    } finally {
      setRegenerating(false)
    }
  }

  const canApprove =
    status === "AI_GENERATED" || status === "NEEDS_REVIEW"
  const canRequestReview =
    status === "AI_GENERATED" || status === "APPROVED"

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 mt-0.5 flex-shrink-0"
            onClick={() => router.back()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Article"
              className="w-full text-xl font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-300 leading-tight"
            />
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={status} />
              {isDirty && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canRequestReview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={approvingStatus !== null}
                    onClick={() => handleStatusChange("NEEDS_REVIEW")}
                  >
                    {approvingStatus === "NEEDS_REVIEW" ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Request Review
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as Needs Review</TooltipContent>
              </Tooltip>
            )}

            {canApprove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-teal-200 text-teal-700 hover:bg-teal-50"
                    disabled={approvingStatus !== null}
                    onClick={() => handleStatusChange("APPROVED")}
                  >
                    {approvingStatus === "APPROVED" ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Approve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve this article</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={regenerating || !initialArticle.keywordId}
                  onClick={handleRegenerate}
                >
                  {regenerating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Regenerate
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {initialArticle.keywordId
                  ? "Generate a new version of this article"
                  : "No keyword linked — cannot regenerate"}
              </TooltipContent>
            </Tooltip>

            <Button size="sm" className="h-8" disabled={saving || !isDirty} onClick={handleSave}>
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="content">
          <TabsList className="h-8">
            <TabsTrigger value="content" className="text-xs h-6 px-3">
              Content
            </TabsTrigger>
            <TabsTrigger value="seo" className="text-xs h-6 px-3">
              SEO
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs h-6 px-3">
              Info
            </TabsTrigger>
          </TabsList>

          {/* CONTENT TAB */}
          <TabsContent value="content" className="mt-4 space-y-3">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
              <button
                onClick={() => setContentView("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contentView === "preview"
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <Eye className="w-3 h-3" />Preview
              </button>
              <button
                onClick={() => setContentView("html")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contentView === "html"
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <Code2 className="w-3 h-3" />HTML Source
              </button>
              <button
                onClick={() => setContentView("markdown")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contentView === "markdown"
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <FileText className="w-3 h-3" />Markdown
              </button>
            </div>

            {contentView === "preview" && (
              <div className="border border-zinc-200 rounded-xl p-6 bg-white min-h-[400px]">
                {contentHtml ? (
                  <div
                    className="prose prose-zinc prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentHtml }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                    <FileText className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No content yet</p>
                  </div>
                )}
              </div>
            )}

            {contentView === "html" && (
              <Textarea
                value={contentHtml}
                onChange={(e) => setContentHtml(e.target.value)}
                placeholder="<h2>Article content goes here...</h2>"
                className="font-mono text-xs min-h-[400px] resize-y"
                spellCheck={false}
              />
            )}

            {contentView === "markdown" && (
              <Textarea
                value={contentMarkdown}
                onChange={(e) => setContentMarkdown(e.target.value)}
                placeholder="## Article content in Markdown..."
                className="font-mono text-xs min-h-[400px] resize-y"
                spellCheck={false}
              />
            )}
          </TabsContent>

          {/* SEO TAB */}
          <TabsContent value="seo" className="mt-4 space-y-4">
            <div className="grid gap-4 max-w-2xl">
              <div className="space-y-1.5">
                <Label htmlFor="seo-slug">URL Slug</Label>
                <Input
                  id="seo-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metatitle">Meta Title</Label>
                  <span
                    className={`text-xs ${
                      metaTitle.length > 60 ? "text-red-500" : "text-zinc-400"
                    }`}
                  >
                    {metaTitle.length}/60
                  </span>
                </div>
                <Input
                  id="seo-metatitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO meta title (max 60 characters)"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metadesc">Meta Description</Label>
                  <span
                    className={`text-xs ${
                      metaDescription.length > 160
                        ? "text-red-500"
                        : metaDescription.length > 140
                        ? "text-amber-500"
                        : "text-zinc-400"
                    }`}
                  >
                    {metaDescription.length}/160
                  </span>
                </div>
                <Textarea
                  id="seo-metadesc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO meta description (140-160 characters recommended)"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-excerpt">Excerpt</Label>
                <Textarea
                  id="seo-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Short article summary for listings..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-tags">Tags</Label>
                <Input
                  id="seo-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="seo, content-marketing, blog (comma-separated)"
                />
                <p className="text-xs text-zinc-400">Separate tags with commas</p>
              </div>
            </div>
          </TabsContent>

          {/* INFO TAB */}
          <TabsContent value="info" className="mt-4 space-y-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-w-lg text-sm">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Project</p>
                <p className="text-zinc-900 font-medium">{initialArticle.project.name}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Keyword</p>
                <p className="text-zinc-900 font-medium">
                  {initialArticle.keyword?.keyword ?? (
                    <span className="text-zinc-400 italic">None</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Author</p>
                <p className="text-zinc-900 font-medium">
                  {initialArticle.author?.name ??
                    initialArticle.author?.email ?? (
                      <span className="text-zinc-400 italic">Unassigned</span>
                    )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Status</p>
                <StatusBadge status={status} />
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Created</p>
                <p className="text-zinc-700">
                  {format(new Date(initialArticle.createdAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Last Updated</p>
                <p className="text-zinc-700">
                  {format(new Date(initialArticle.updatedAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            </div>

            <Separator />

            {/* Generation job history */}
            <div>
              <h3 className="text-sm font-medium text-zinc-900 mb-3">
                Generation History
              </h3>
              {initialArticle.generationJobs.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">No generation jobs yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Attempts
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Error
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {initialArticle.generationJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-zinc-50/50">
                          <td className="px-3 py-2.5 text-xs text-zinc-600">
                            {job.type
                              .replace("_GENERATION", "")
                              .toLowerCase()
                              .replace(/^\w/, (c) => c.toUpperCase())}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-500 tabular-nums">
                            {job.attempts}
                          </td>
                          <td className="px-3 py-2.5 text-xs max-w-[200px]">
                            {job.errorType ? (
                              <div className="flex items-start gap-1 text-red-600">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="truncate">
                                  {ERROR_TYPE_MESSAGES[job.errorType] ?? job.errorType}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">
                            {format(new Date(job.createdAt), "dd MMM, HH:mm")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
```

---

## Task 6: Deploy

**Checklist:**

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 2: Ensure `ANTHROPIC_API_KEY` env var is set**

In `.env.local` (local) and on the server:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: Verify worker tsconfig resolves `@/` path alias**

Check `tsconfig.worker.json` includes the paths alias. If not, ensure:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "./dist-worker",
    "noEmit": false,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["worker/**/*.ts", "lib/**/*.ts", "prisma/**/*.ts"]
}
```

The `tsx` runner used by `npm run worker` honours `tsconfig.json` path mappings automatically, so `@/lib/db` and `@/lib/ai/claude` resolve correctly.

- [ ] **Step 4: Git commit and push**

```bash
git add \
  lib/ai/claude.ts \
  lib/ai/prompts.ts \
  worker/processors/article.ts \
  worker/index.ts \
  server/actions/articles.ts \
  "app/api/articles/[id]/status/route.ts" \
  "app/(dashboard)/articles/page.tsx" \
  "app/(dashboard)/articles/[id]/page.tsx" \
  components/features/articles/articles-table.tsx \
  components/features/articles/generate-article-dialog.tsx \
  components/features/articles/article-editor.tsx

git commit -m "feat(plan-03): articles AI generation with Claude, BullMQ worker, and editor"
git push
```

- [ ] **Step 5: Deploy to server**

```bash
# On server — pull latest and rebuild
git pull
npm ci
npm run build
pm2 restart blogplanner-web
pm2 restart blogplanner-worker
```

- [ ] **Step 6: Smoke test**

1. Navigate to `/articles` — verify empty state and "Generate Article" button renders.
2. Click "Generate Article" — verify keyword selector populates with OPEN keywords.
3. Select a keyword, click Generate — verify dialog transitions to "Generating..." state.
4. Wait ~30–60s — verify dialog transitions to "Article generated!" success state.
5. Click "View Article" — verify article detail page loads with populated content.
6. Toggle HTML Preview / HTML Source / Markdown in Content tab.
7. Edit meta title, save — verify toast "Article saved."
8. Click "Approve" — verify status badge changes to Approved.
9. Check Info tab — verify generation history row shows COMPLETED status.
10. Check server logs: `pm2 logs blogplanner-worker` — verify no uncaught errors.

---

## Key Implementation Notes

### Import boundary: worker vs. Next.js
- `worker/processors/article.ts` imports `db` from `@/lib/db` directly — NOT via Server Actions.  
- Server Actions (`server/actions/articles.ts`) import `articleGenerationQueue` from `@/worker/queues/index` — this is safe because the queue module only creates a Queue (no Worker), which can run in both environments.

### SWR polling lifecycle
- Polling starts when `articleId` is set and `step === "generating"`.
- `refreshInterval` is set to `0` (disabled) once status is `AI_GENERATED` or `FAILED` — preventing unnecessary requests after terminal state.

### Article status workflow
```
DRAFT → (worker processing) → AI_GENERATED → NEEDS_REVIEW ↔ APPROVED
                                           ↘ APPROVED
         (worker failure)  → FAILED
```
- "Approve" visible when: `AI_GENERATED` or `NEEDS_REVIEW`  
- "Request Review" visible when: `AI_GENERATED` or `APPROVED`  
- "Regenerate" always visible (disabled if no `keywordId`)

### Error classification in worker
BullMQ re-throws errors after `classifyError()` records them, allowing BullMQ's exponential backoff (3 attempts, 5s base) to fire retries. On final failure after all attempts, `Article.status` is set to `FAILED` and `GenerationJob.errorType` records the cause.

### WordPress-compatible HTML
Claude is instructed to produce HTML using only standard block elements (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<blockquote>`) without `<html>`/`<head>`/`<body>` wrappers — ready for direct insertion into WordPress via the REST API (Plan 05).
