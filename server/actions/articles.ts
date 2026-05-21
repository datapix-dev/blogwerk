"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { articleGenerationQueue } from "@/worker/queues/index"
import type { ArticleStatus } from "@prisma/client"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

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
  publishMode: string
  publishAt: Date | null
  url: string | null
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

const articleSelect = {
  id: true,
  projectId: true,
  keywordId: true,
  authorId: true,
  title: true,
  slug: true,
  contentHtml: true,
  contentMarkdown: true,
  metaTitle: true,
  metaDescription: true,
  excerpt: true,
  category: true,
  tags: true,
  featuredImage: true,
  status: true,
  publishMode: true,
  publishAt: true,
  url: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  keyword: { select: { id: true, keyword: true } },
  author: { select: { id: true, name: true, email: true } },
  generationJobs: {
    orderBy: { createdAt: "desc" as const },
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
} as const

export async function getArticles(): Promise<ArticleWithRelations[]> {
  const session = await requireSession()
  return db.article.findMany({
    where: { project: { workspaceId: session.user.workspaceId } },
    select: articleSelect,
    orderBy: { updatedAt: "desc" },
  }) as Promise<ArticleWithRelations[]>
}

export async function getArticleById(id: string): Promise<ArticleWithRelations | null> {
  const session = await requireSession()
  return db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: articleSelect,
  }) as Promise<ArticleWithRelations | null>
}

export async function generateArticleAction(
  keywordId: string
): Promise<
  | { success: true; articleId: string }
  | { success: false; error: string; code?: string }
> {
  const session = await requireSession()

  // Verify keyword belongs to workspace
  const keyword = await db.keyword.findFirst({
    where: {
      id: keywordId,
      project: { workspaceId: session.user.workspaceId },
    },
    select: { id: true, projectId: true, status: true },
  })
  if (!keyword) return { success: false, error: "Keyword not found." }

  // Monthly usage check
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [workspace, usage] = await Promise.all([
    db.workspace.findUnique({
      where: { id: session.user.workspaceId },
      select: { monthlyGenLimit: true },
    }),
    db.workspaceUsage.findUnique({
      where: {
        workspaceId_month: {
          workspaceId: session.user.workspaceId,
          month: currentMonth,
        },
      },
      select: { articleCount: true },
    }),
  ])

  const limit = workspace?.monthlyGenLimit ?? 100
  const used = usage?.articleCount ?? 0
  if (used >= limit) {
    return {
      success: false,
      error: `Monthly generation limit (${limit}) reached.`,
      code: "RATE_LIMIT_REACHED",
    }
  }

  try {
    const { article, job } = await db.$transaction(async (tx) => {
      // Reuse existing article if it failed or is still a blank draft
      const existing = await tx.article.findUnique({
        where: { keywordId: keyword.id },
        select: { id: true, status: true },
      })

      let articleId: string
      if (existing) {
        if (!["FAILED", "DRAFT"].includes(existing.status)) {
          throw new Error(`ALREADY_EXISTS:${existing.id}`)
        }
        await tx.article.update({
          where: { id: existing.id },
          data: { status: "DRAFT", title: null, slug: null, contentHtml: null, contentMarkdown: null },
        })
        await tx.generationJob.updateMany({
          where: { articleId: existing.id, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "FAILED" },
        })
        articleId = existing.id
      } else {
        const created = await tx.article.create({
          data: {
            projectId: keyword.projectId,
            keywordId: keyword.id,
            authorId: session.user.id,
            status: "DRAFT",
          },
          select: { id: true },
        })
        articleId = created.id
      }

      const job = await tx.generationJob.create({
        data: {
          articleId,
          type: "ARTICLE_GENERATION",
          status: "PENDING",
          payload: { keywordId, projectId: keyword.projectId },
        },
        select: { id: true },
      })

      return { article: { id: articleId }, job }
    })

    await articleGenerationQueue.add(
      "generate",
      { articleId: article.id, keywordId, projectId: keyword.projectId },
      { jobId: job.id, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    )

    revalidatePath("/articles")
    return { success: true, articleId: article.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.startsWith("ALREADY_EXISTS:")) {
      const existingId = msg.split(":")[1]
      return { success: true, articleId: existingId }
    }
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
    select: { id: true },
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
