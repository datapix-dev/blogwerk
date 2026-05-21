"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { scheduleArticle, unscheduleArticle, getCalendarArticles } from "@/server/actions/calendar"
import type { CalendarArticle } from "@/server/actions/calendar"
import type { ArticleStatus } from "@prisma/client"

const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 border-zinc-200",
  AI_GENERATED: "bg-blue-50 text-blue-700 border-blue-200",
  ADAPTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  SCHEDULED: "bg-violet-50 text-violet-700 border-violet-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
}

const STATUS_DOT: Record<ArticleStatus, string> = {
  DRAFT: "bg-zinc-400",
  AI_GENERATED: "bg-blue-500",
  ADAPTED: "bg-indigo-500",
  NEEDS_REVIEW: "bg-amber-500",
  APPROVED: "bg-green-500",
  SCHEDULED: "bg-violet-500",
  PUBLISHED: "bg-emerald-500",
  FAILED: "bg-red-500",
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface ContentCalendarProps {
  initialArticles: CalendarArticle[]
  initialYear: number
  initialMonth: number
}

export function ContentCalendar({
  initialArticles,
  initialYear,
  initialMonth,
}: ContentCalendarProps) {
  const [year, setYear] = React.useState(initialYear)
  const [month, setMonth] = React.useState(initialMonth)
  const [articles, setArticles] = React.useState<CalendarArticle[]>(initialArticles)
  const [loading, setLoading] = React.useState(false)
  const [dragArticleId, setDragArticleId] = React.useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = React.useState<number | null>(null)

  async function navigate(dir: -1 | 1) {
    let newMonth = month + dir
    let newYear = year
    if (newMonth < 1) { newMonth = 12; newYear-- }
    if (newMonth > 12) { newMonth = 1; newYear++ }

    setLoading(true)
    try {
      const data = await getCalendarArticles(newYear, newMonth)
      setArticles(data)
      setYear(newYear)
      setMonth(newMonth)
    } finally {
      setLoading(false)
    }
  }

  async function goToToday() {
    const now = new Date()
    setLoading(true)
    try {
      const data = await getCalendarArticles(now.getFullYear(), now.getMonth() + 1)
      setArticles(data)
      setYear(now.getFullYear())
      setMonth(now.getMonth() + 1)
    } finally {
      setLoading(false)
    }
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  // Map articles to days
  function articleDay(a: CalendarArticle): number | null {
    const date = a.publishAt ?? (a.status === "PUBLISHED" ? a.publishAt : null)
    if (!date) return null
    const d = new Date(date)
    if (d.getFullYear() === year && d.getMonth() + 1 === month) return d.getDate()
    return null
  }

  const articlesByDay = React.useMemo(() => {
    const map = new Map<number, CalendarArticle[]>()
    for (const a of articles) {
      const day = articleDay(a)
      if (day !== null) {
        const existing = map.get(day) ?? []
        existing.push(a)
        map.set(day, existing)
      }
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, year, month])

  // Drag handlers
  function handleDragStart(articleId: string) {
    setDragArticleId(articleId)
  }

  function handleDragOver(e: React.DragEvent, day: number) {
    e.preventDefault()
    setDragOverDay(day)
  }

  function handleDragLeave() {
    setDragOverDay(null)
  }

  async function handleDrop(day: number) {
    setDragOverDay(null)
    if (!dragArticleId) return
    const publishAt = new Date(year, month - 1, day, 12, 0, 0)
    const res = await scheduleArticle(dragArticleId, publishAt)
    if (!res.success) {
      toast.error(res.error)
    } else {
      toast.success("Article rescheduled.")
      setArticles((prev) =>
        prev.map((a) =>
          a.id === dragArticleId
            ? { ...a, publishAt, status: "SCHEDULED" as ArticleStatus }
            : a
        )
      )
    }
    setDragArticleId(null)
  }

  async function handleUnschedule(articleId: string) {
    const res = await unscheduleArticle(articleId)
    if (!res.success) {
      toast.error(res.error)
    } else {
      toast.success("Article unscheduled.")
      setArticles((prev) => prev.filter((a) => a.id !== articleId))
    }
  }

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold text-zinc-900 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToToday}>
              Today
            </Button>
          )}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {(["SCHEDULED", "PUBLISHED", "APPROVED"] as ArticleStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={cn("rounded-xl border border-zinc-200 overflow-hidden", loading && "opacity-50")}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }).map((_, i) => {
            const day = i - startOffset + 1
            const isValid = day >= 1 && day <= daysInMonth
            const isToday = isCurrentMonth && isValid && day === today.getDate()
            const isDragTarget = dragOverDay === day
            const dayArticles = isValid ? (articlesByDay.get(day) ?? []) : []

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] border-b border-r border-zinc-100 p-1.5 align-top",
                  "last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  !isValid && "bg-zinc-50/50",
                  isDragTarget && isValid && "bg-violet-50 ring-1 ring-inset ring-violet-300",
                )}
                onDragOver={(e) => isValid && handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={() => isValid && handleDrop(day)}
              >
                {isValid && (
                  <>
                    <div className="flex items-center justify-center mb-1">
                      <span
                        className={cn(
                          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                          isToday
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-500"
                        )}
                      >
                        {day}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayArticles.map((a) => (
                        <ArticleCard
                          key={a.id}
                          article={a}
                          onDragStart={() => handleDragStart(a.id)}
                          onUnschedule={() => handleUnschedule(a.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {articles.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays className="w-8 h-8 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-zinc-600">No scheduled articles this month</p>
          <p className="text-xs text-zinc-400 mt-1">
            Schedule articles from the list view by setting a publish date.
          </p>
        </div>
      )}
    </div>
  )
}

function ArticleCard({
  article,
  onDragStart,
  onUnschedule,
}: {
  article: CalendarArticle
  onDragStart: () => void
  onUnschedule: () => void
}) {
  const [showActions, setShowActions] = React.useState(false)

  return (
    <div
      draggable={article.status !== "PUBLISHED"}
      onDragStart={onDragStart}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn(
        "group relative rounded px-1.5 py-1 text-[11px] leading-tight border cursor-grab active:cursor-grabbing",
        STATUS_COLORS[article.status],
        article.status === "PUBLISHED" && "cursor-default"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[article.status])} />
            <span className="text-[10px] opacity-70 truncate">{article.projectName}</span>
          </div>
          <p className="font-medium line-clamp-2 leading-tight">
            {article.title ?? "Untitled"}
          </p>
        </div>
        {showActions && (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <Link
              href={`/articles/${article.id}`}
              className="p-0.5 hover:opacity-70 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            {article.status === "SCHEDULED" && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnschedule() }}
                className="p-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
