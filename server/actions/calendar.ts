"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { ArticleStatus } from "@prisma/client"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export type CalendarArticle = {
  id: string
  title: string | null
  status: ArticleStatus
  publishAt: Date | null
  publishMode: string
  projectId: string
  projectName: string
  url: string | null
}

export async function getCalendarArticles(
  year: number,
  month: number
): Promise<CalendarArticle[]> {
  const session = await requireSession()

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  // Fetch SCHEDULED articles with publishAt in this month
  // AND PUBLISHED articles updated in this month
  const articles = await db.article.findMany({
    where: {
      project: { workspaceId: session.user.workspaceId },
      OR: [
        { publishAt: { gte: start, lte: end } },
        { status: "PUBLISHED", updatedAt: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      publishAt: true,
      publishMode: true,
      url: true,
      projectId: true,
      project: { select: { name: true } },
    },
    orderBy: { publishAt: "asc" },
  })

  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    publishAt: a.publishAt,
    publishMode: a.publishMode,
    projectId: a.projectId,
    projectName: a.project.name,
    url: a.url,
  }))
}

export async function scheduleArticle(
  articleId: string,
  publishAt: Date
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, status: true },
  })
  if (!article) return { success: false, error: "Article not found." }

  // Only schedule articles that are ready (not DRAFT or PUBLISHED)
  const schedulableStatuses: ArticleStatus[] = [
    "AI_GENERATED",
    "NEEDS_REVIEW",
    "APPROVED",
    "SCHEDULED",
  ]
  if (!schedulableStatuses.includes(article.status)) {
    return {
      success: false,
      error: `Cannot schedule an article with status "${article.status}".`,
    }
  }

  try {
    await db.article.update({
      where: { id: articleId },
      data: {
        publishAt,
        publishMode: "SCHEDULED",
        status: "SCHEDULED",
      },
    })
    revalidatePath("/articles")
    return { success: true }
  } catch (err) {
    console.error("[scheduleArticle]", err)
    return { success: false, error: "Failed to schedule article." }
  }
}

export async function unscheduleArticle(
  articleId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  if (!article) return { success: false, error: "Article not found." }

  try {
    await db.article.update({
      where: { id: articleId },
      data: { publishAt: null, publishMode: "DRAFT", status: "APPROVED" },
    })
    revalidatePath("/articles")
    return { success: true }
  } catch (err) {
    console.error("[unscheduleArticle]", err)
    return { success: false, error: "Failed to unschedule article." }
  }
}
