"use client"

import Link from "next/link"
import { List, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  current: "list" | "calendar"
}

export function ViewToggle({ current }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 gap-0.5">
      <Link
        href="/articles"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          current === "list"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        )}
      >
        <List className="w-3.5 h-3.5" />
        List
      </Link>
      <Link
        href="/articles?view=calendar"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          current === "calendar"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        )}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        Calendar
      </Link>
    </div>
  )
}
