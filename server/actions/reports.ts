"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export type ArticlePerformanceRow = {
  articleId: string
  title: string | null
  projectName: string
  clicks: number
  impressions: number
  ctr: number | null
  position: number | null
  updatedAt: Date
}

export type WorkspaceTotals = {
  totalPublished: number
  totalClicks: number
  totalImpressions: number
  avgCtr: number | null
  avgPosition: number | null
}

export type KeywordRankingRow = {
  keywordId: string
  keyword: string
  projectName: string
  latestPosition: number | null
  previousPosition: number | null
  url: string | null
  recordedAt: Date | null
}

export type ActivityLogRow = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  meta: Record<string, unknown> | null
  createdAt: Date
  userName: string | null
  userEmail: string | null
}

export type ReportsData = {
  totals: WorkspaceTotals
  topArticles: ArticlePerformanceRow[]
  keywordRankings: KeywordRankingRow[]
  activityLog: ActivityLogRow[]
}

export async function getReportsData(): Promise<ReportsData> {
  const session = await requireSession()
  const workspaceId = session.user.workspaceId

  const [publishedCount, analyticsRows, keywordsWithProject, activityRows, allAnalytics] =
    await Promise.all([
      db.article.count({
        where: { project: { workspaceId }, status: "PUBLISHED" },
      }),
      db.articleAnalytics.findMany({
        where: { article: { project: { workspaceId } } },
        select: {
          articleId: true,
          clicks: true,
          impressions: true,
          ctr: true,
          position: true,
          updatedAt: true,
          article: {
            select: {
              title: true,
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { clicks: "desc" },
        take: 10,
      }),
      db.keyword.findMany({
        where: { project: { workspaceId } },
        select: {
          id: true,
          keyword: true,
          project: { select: { name: true } },
        },
      }),
      db.activityLog.findMany({
        where: {
          OR: [
            { user: { workspaceId } },
            { userId: null },
          ],
        },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          meta: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.articleAnalytics.findMany({
        where: { article: { project: { workspaceId } } },
        select: { clicks: true, impressions: true, ctr: true, position: true },
      }),
    ])

  const totalClicks = allAnalytics.reduce((sum, a) => sum + a.clicks, 0)
  const totalImpressions = allAnalytics.reduce((sum, a) => sum + a.impressions, 0)
  const ctrs = allAnalytics.map((a) => a.ctr).filter((v): v is number => v !== null)
  const positions = allAnalytics.map((a) => a.position).filter((v): v is number => v !== null)
  const avgCtr = ctrs.length > 0 ? ctrs.reduce((s, v) => s + v, 0) / ctrs.length : null
  const avgPosition =
    positions.length > 0 ? positions.reduce((s, v) => s + v, 0) / positions.length : null

  const totals: WorkspaceTotals = {
    totalPublished: publishedCount,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  }

  const topArticles: ArticlePerformanceRow[] = analyticsRows.map((row) => ({
    articleId: row.articleId,
    title: row.article.title,
    projectName: row.article.project.name,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    updatedAt: row.updatedAt,
  }))

  const keywordIds = keywordsWithProject.map((k) => k.id)
  let keywordRankings: KeywordRankingRow[] = []

  if (keywordIds.length > 0) {
    const rankings = await db.keywordRanking.findMany({
      where: { keywordId: { in: keywordIds } },
      orderBy: { recordedAt: "desc" },
    })

    const grouped = new Map<string, typeof rankings>()
    for (const r of rankings) {
      const existing = grouped.get(r.keywordId) ?? []
      if (existing.length < 2) {
        existing.push(r)
        grouped.set(r.keywordId, existing)
      }
    }

    keywordRankings = keywordsWithProject.map((kw) => {
      const kwRankings = grouped.get(kw.id) ?? []
      const latest = kwRankings[0] ?? null
      const previous = kwRankings[1] ?? null
      return {
        keywordId: kw.id,
        keyword: kw.keyword,
        projectName: kw.project.name,
        latestPosition: latest?.position ?? null,
        previousPosition: previous?.position ?? null,
        url: latest?.url ?? null,
        recordedAt: latest?.recordedAt ?? null,
      }
    })

    keywordRankings.sort((a, b) => {
      if (a.latestPosition === null && b.latestPosition === null) return 0
      if (a.latestPosition === null) return 1
      if (b.latestPosition === null) return -1
      return a.latestPosition - b.latestPosition
    })
  }

  const activityLog: ActivityLogRow[] = activityRows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    meta: (row.meta ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt,
    userName: row.user?.name ?? null,
    userEmail: row.user?.email ?? null,
  }))

  return { totals, topArticles, keywordRankings, activityLog }
}
