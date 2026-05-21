"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { format, formatDistanceToNow } from "date-fns"
import {
  MousePointerClick,
  Eye,
  BarChart2,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowUpDown,
  Activity,
  FileText,
  Tags,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DataTable } from "@/components/features/data-table"
import { SearchConsoleSetup } from "./search-console-setup"
import type { ReportsData } from "@/server/actions/reports"
import type { SearchConsoleConnectionData } from "@/server/actions/search-console"

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  colorClass?: string
}

function StatCard({ icon: Icon, label, value, sub, colorClass = "text-zinc-600" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-zinc-100 p-2">
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
        <p className="text-xs text-zinc-500 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  )
}

function TrendIndicator({
  current,
  previous,
}: {
  current: number | null
  previous: number | null
}) {
  if (current === null) return <span className="text-zinc-300 text-xs">—</span>
  if (previous === null)
    return <span className="text-zinc-400 text-xs">#{current.toFixed(1)}</span>

  const delta = previous - current
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
        <Minus className="w-3 h-3" />
        #{current.toFixed(1)}
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <TrendingUp className="w-3.5 h-3.5" />
        #{current.toFixed(1)}
        <span className="text-emerald-500 text-[10px]">+{delta.toFixed(1)}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
      <TrendingDown className="w-3.5 h-3.5" />
      #{current.toFixed(1)}
      <span className="text-red-400 text-[10px]">{delta.toFixed(1)}</span>
    </span>
  )
}

const ACTION_LABELS: Record<string, string> = {
  ARTICLE_CREATED: "Created article",
  ARTICLE_UPDATED: "Updated article",
  ARTICLE_PUBLISHED: "Published article",
  ARTICLE_DELETED: "Deleted article",
  KEYWORD_CREATED: "Added keyword",
  KEYWORD_DELETED: "Removed keyword",
  PROJECT_CREATED: "Created project",
  USER_INVITED: "Invited user",
  SEARCH_CONSOLE_SYNC: "Synced Search Console",
  CONNECTION_CREATED: "Added connection",
  CONNECTION_TESTED: "Tested connection",
}

function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase()
}

interface ReportsPageProps {
  data: ReportsData
  connection: SearchConsoleConnectionData | null
}

export function ReportsPage({ data, connection }: ReportsPageProps) {
  const { totals, topArticles, keywordRankings, activityLog } = data

  const articleColumns: ColumnDef<(typeof topArticles)[0]>[] = [
    {
      accessorKey: "title",
      header: "Article",
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="text-sm font-medium text-zinc-900 line-clamp-2">
            {row.original.title ?? <span className="text-zinc-400 italic">Untitled</span>}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{row.original.projectName}</p>
        </div>
      ),
    },
    {
      accessorKey: "clicks",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Clicks <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm font-medium text-zinc-900">
          {(getValue() as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "impressions",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Impr. <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-zinc-600">
          {(getValue() as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "ctr",
      header: "CTR",
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return (
          <span className="text-sm text-zinc-600">
            {v !== null ? `${(v * 100).toFixed(1)}%` : "—"}
          </span>
        )
      },
    },
    {
      accessorKey: "position",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Position <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return (
          <span className="text-sm text-zinc-600">
            {v !== null ? `#${v.toFixed(1)}` : "—"}
          </span>
        )
      },
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-400">
          {format(new Date(getValue() as Date), "dd MMM yyyy")}
        </span>
      ),
    },
  ]

  const keywordColumns: ColumnDef<(typeof keywordRankings)[0]>[] = [
    {
      accessorKey: "keyword",
      header: "Keyword",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-zinc-900">{row.original.keyword}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{row.original.projectName}</p>
        </div>
      ),
    },
    {
      id: "position",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Position <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      accessorFn: (row) => row.latestPosition,
      cell: ({ row }) => (
        <TrendIndicator
          current={row.original.latestPosition}
          previous={row.original.previousPosition}
        />
      ),
      sortingFn: (a, b) => {
        const pa = a.original.latestPosition
        const pb = b.original.latestPosition
        if (pa === null && pb === null) return 0
        if (pa === null) return 1
        if (pb === null) return -1
        return pa - pb
      },
    },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <a
            href={v}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline truncate max-w-[200px] block"
          >
            {v}
          </a>
        ) : (
          <span className="text-zinc-300 text-xs">—</span>
        )
      },
    },
    {
      accessorKey: "recordedAt",
      header: "Last Recorded",
      cell: ({ getValue }) => {
        const v = getValue() as Date | null
        return v ? (
          <span className="text-xs text-zinc-400">
            {format(new Date(v), "dd MMM yyyy")}
          </span>
        ) : (
          <span className="text-zinc-300 text-xs">—</span>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <SearchConsoleSetup connection={connection} />

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">
            <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <Tags className="w-3.5 h-3.5 mr-1.5" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-5 mt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={MousePointerClick}
              label="Total Clicks"
              value={totals.totalClicks.toLocaleString()}
              sub="All time from GSC"
            />
            <StatCard
              icon={Eye}
              label="Total Impressions"
              value={totals.totalImpressions.toLocaleString()}
              sub="Across all articles"
            />
            <StatCard
              icon={BarChart2}
              label="Avg. CTR"
              value={
                totals.avgCtr !== null ? `${(totals.avgCtr * 100).toFixed(2)}%` : "—"
              }
              sub="Click-through rate"
              colorClass="text-blue-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg. Position"
              value={
                totals.avgPosition !== null ? `#${totals.avgPosition.toFixed(1)}` : "—"
              }
              sub="SERP average rank"
              colorClass="text-emerald-600"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-700 mb-3">Top Articles by Clicks</p>
            <DataTable
              columns={articleColumns}
              data={topArticles}
              pageSize={10}
              emptyTitle="No performance data yet"
              emptyDescription="Connect Google Search Console and run a sync to see article performance."
            />
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <DataTable
            columns={keywordColumns}
            data={keywordRankings}
            pageSize={20}
            emptyTitle="No keyword rankings yet"
            emptyDescription="Sync Search Console data to populate keyword positions."
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {activityLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="w-8 h-8 text-zinc-300 mb-3" />
              <p className="text-sm font-medium text-zinc-600">No activity yet</p>
              <p className="text-xs text-zinc-400 mt-1">
                Actions like creating articles or syncing will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <ul className="divide-y divide-zinc-100">
                {activityLog.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 rounded-full bg-zinc-100 p-1.5 flex-shrink-0">
                      <FileText className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-900 font-medium">
                        {activityLabel(entry.action)}
                        {entry.entity && (
                          <span className="font-normal text-zinc-500">
                            {" "}· {entry.entity}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {entry.userName ?? entry.userEmail ?? "System"} ·{" "}
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <time
                      className="text-xs text-zinc-400 flex-shrink-0"
                      dateTime={new Date(entry.createdAt).toISOString()}
                    >
                      {format(new Date(entry.createdAt), "dd MMM, HH:mm")}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
