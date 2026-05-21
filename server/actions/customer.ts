"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ArticleStatus, KeywordStatus } from "@prisma/client"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export type CustomerProjectSummary = {
  projectId: string
  projectName: string
  keywordsByStatus: Partial<Record<KeywordStatus, number>>
  articlesByStatus: Partial<Record<ArticleStatus, number>>
  totalKeywords: number
  totalArticles: number
}

export type CustomerPublishedArticle = {
  id: string
  title: string | null
  url: string | null
  projectName: string
  publishedAt: Date
}

export type CustomerData = {
  projects: CustomerProjectSummary[]
  publishedArticles: CustomerPublishedArticle[]
  totalPublished: number
  totalScheduled: number
  totalKeywords: number
  currentMonthArticles: number
  monthlyLimit: number
}

export async function getCustomerData(): Promise<CustomerData> {
  const session = await requireSession()
  const workspaceId = session.user.workspaceId
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [projects, usage, workspace] = await Promise.all([
    db.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        keywords: { select: { status: true } },
        articles: { select: { status: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.workspaceUsage.findUnique({
      where: { workspaceId_month: { workspaceId, month: currentMonth } },
      select: { articleCount: true },
    }),
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { monthlyGenLimit: true },
    }),
  ])

  const projectSummaries: CustomerProjectSummary[] = projects.map((p) => {
    const keywordsByStatus: Partial<Record<KeywordStatus, number>> = {}
    for (const k of p.keywords) {
      keywordsByStatus[k.status] = (keywordsByStatus[k.status] ?? 0) + 1
    }
    const articlesByStatus: Partial<Record<ArticleStatus, number>> = {}
    for (const a of p.articles) {
      articlesByStatus[a.status] = (articlesByStatus[a.status] ?? 0) + 1
    }
    return {
      projectId: p.id,
      projectName: p.name,
      keywordsByStatus,
      articlesByStatus,
      totalKeywords: p.keywords.length,
      totalArticles: p.articles.length,
    }
  })

  const publishedArticles = await db.article.findMany({
    where: { project: { workspaceId }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      url: true,
      updatedAt: true,
      project: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })

  const totalPublished = projectSummaries.reduce(
    (sum, p) => sum + (p.articlesByStatus["PUBLISHED"] ?? 0),
    0
  )
  const totalScheduled = projectSummaries.reduce(
    (sum, p) => sum + (p.articlesByStatus["SCHEDULED"] ?? 0),
    0
  )
  const totalKeywords = projectSummaries.reduce((sum, p) => sum + p.totalKeywords, 0)

  return {
    projects: projectSummaries,
    publishedArticles: publishedArticles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      projectName: a.project.name,
      publishedAt: a.updatedAt,
    })),
    totalPublished,
    totalScheduled,
    totalKeywords,
    currentMonthArticles: usage?.articleCount ?? 0,
    monthlyLimit: workspace?.monthlyGenLimit ?? 100,
  }
}
