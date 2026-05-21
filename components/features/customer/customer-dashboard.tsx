"use client"

import Link from "next/link"
import { format } from "date-fns"
import {
  FileText,
  CalendarDays,
  Tags,
  ExternalLink,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react"
import type { CustomerData } from "@/server/actions/customer"
import type { ArticleStatus, KeywordStatus } from "@prisma/client"

const ARTICLE_STATUS_LABELS: Partial<Record<ArticleStatus, string>> = {
  DRAFT: "Draft",
  AI_GENERATED: "Generated",
  NEEDS_REVIEW: "Review",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
}

const ARTICLE_STATUS_COLORS: Partial<Record<ArticleStatus, string>> = {
  DRAFT: "bg-zinc-200",
  AI_GENERATED: "bg-blue-400",
  NEEDS_REVIEW: "bg-amber-400",
  APPROVED: "bg-green-400",
  SCHEDULED: "bg-violet-400",
  PUBLISHED: "bg-emerald-500",
  FAILED: "bg-red-400",
}

const KEYWORD_STATUS_LABELS: Partial<Record<KeywordStatus, string>> = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  GENERATED: "Generated",
  PUBLISHED: "Published",
}

const KEYWORD_STATUS_COLORS: Partial<Record<KeywordStatus, string>> = {
  OPEN: "bg-zinc-200",
  PLANNED: "bg-blue-300",
  IN_PROGRESS: "bg-amber-400",
  GENERATED: "bg-green-400",
  PUBLISHED: "bg-emerald-500",
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}

function StatCard({ icon: Icon, label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-xl bg-zinc-100 p-2.5">
          <Icon className="h-5 w-5 text-zinc-600" />
        </div>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </div>
  )
}

interface CustomerDashboardProps {
  data: CustomerData
  userName: string | null
}

export function CustomerDashboard({ data, userName }: CustomerDashboardProps) {
  const {
    projects,
    publishedArticles,
    totalPublished,
    totalScheduled,
    totalKeywords,
    currentMonthArticles,
    monthlyLimit,
  } = data

  const usagePct = Math.min(100, Math.round((currentMonthArticles / monthlyLimit) * 100))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Here&apos;s the current state of your content program.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FileText} label="Published" value={totalPublished} sub="articles live" />
        <StatCard icon={CalendarDays} label="Scheduled" value={totalScheduled} sub="upcoming articles" />
        <StatCard icon={Tags} label="Keywords" value={totalKeywords} sub="in roadmap" />
        <StatCard
          icon={TrendingUp}
          label="This Month"
          value={`${currentMonthArticles}/${monthlyLimit}`}
          sub="articles generated"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Project Roadmaps */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-base font-semibold text-zinc-900">Project Progress</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-400">No projects yet.</p>
          ) : (
            <div className="space-y-6">
              {projects.map((p) => {
                const articleStatuses = Object.entries(p.articlesByStatus) as [
                  ArticleStatus,
                  number
                ][]
                const keywordStatuses = Object.entries(p.keywordsByStatus) as [
                  KeywordStatus,
                  number
                ][]

                return (
                  <div key={p.projectId} className="space-y-3">
                    <p className="text-sm font-semibold text-zinc-800">{p.projectName}</p>

                    {/* Keyword pipeline */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Keywords</span>
                        <span>{p.totalKeywords} total</span>
                      </div>
                      {p.totalKeywords > 0 && (
                        <div className="flex h-2 rounded-full overflow-hidden gap-px">
                          {keywordStatuses.map(([status, count]) => (
                            <div
                              key={status}
                              className={`h-full ${KEYWORD_STATUS_COLORS[status] ?? "bg-zinc-200"}`}
                              style={{ width: `${(count / p.totalKeywords) * 100}%` }}
                              title={`${KEYWORD_STATUS_LABELS[status] ?? status}: ${count}`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {keywordStatuses.map(([status, count]) => (
                          <span key={status} className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${KEYWORD_STATUS_COLORS[status] ?? "bg-zinc-200"}`}
                            />
                            {KEYWORD_STATUS_LABELS[status] ?? status}: {count}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Article pipeline */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Articles</span>
                        <span>{p.totalArticles} total</span>
                      </div>
                      {p.totalArticles > 0 && (
                        <div className="flex h-2 rounded-full overflow-hidden gap-px">
                          {articleStatuses.map(([status, count]) => (
                            <div
                              key={status}
                              className={`h-full ${ARTICLE_STATUS_COLORS[status] ?? "bg-zinc-200"}`}
                              style={{ width: `${(count / p.totalArticles) * 100}%` }}
                              title={`${ARTICLE_STATUS_LABELS[status] ?? status}: ${count}`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {articleStatuses.map(([status, count]) => (
                          <span key={status} className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${ARTICLE_STATUS_COLORS[status] ?? "bg-zinc-200"}`}
                            />
                            {ARTICLE_STATUS_LABELS[status] ?? status}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Monthly usage + Published URLs */}
        <div className="space-y-4">
          {/* Usage */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">Monthly Generation</h2>
              <span className="text-xs text-zinc-400">
                {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Articles created</span>
                <span className="font-semibold text-zinc-900">
                  {currentMonthArticles} / {monthlyLimit}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePct >= 90 ? "bg-red-500" : usagePct >= 70 ? "bg-amber-500" : "bg-zinc-900"
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">{usagePct}% of monthly limit used</p>
            </div>
          </div>

          {/* Published articles list */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-zinc-900">Published Articles</h2>
            </div>
            {publishedArticles.length === 0 ? (
              <p className="text-sm text-zinc-400 px-5 py-8 text-center">No published articles yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {publishedArticles.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {a.title ?? "Untitled"}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <span>{a.projectName}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(a.publishedAt), "dd MMM yyyy")}</span>
                      </p>
                    </div>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
