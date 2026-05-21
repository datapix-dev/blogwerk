import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface TableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

export function TableSkeleton({ rows = 5, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 overflow-hidden bg-white", className)}>
      <div className="flex items-center gap-3 px-3 h-9 bg-zinc-50 border-b border-zinc-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? 40 : undefined }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-3 px-3 h-11 border-b border-zinc-100 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className="h-3 flex-1"
              style={{ maxWidth: colIdx === 0 ? 40 : colIdx === cols - 1 ? 80 : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface CardSkeletonProps {
  className?: string
  lines?: number
}

export function CardSkeleton({ className, lines = 4 }: CardSkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-5 space-y-3", className)}>
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2 pt-1">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${65 + (i % 3) * 10}%` }} />
        ))}
      </div>
    </div>
  )
}
