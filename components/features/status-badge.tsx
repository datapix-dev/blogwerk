import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type AnyStatus = string

interface StatusConfig {
  label: string
  className: string
}

const statusMap: Record<string, StatusConfig> = {
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PAUSED: { label: "Paused", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ARCHIVED: { label: "Archived", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  OPEN: { label: "Open", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PLANNED: { label: "Planned", className: "bg-violet-50 text-violet-700 border-violet-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  GENERATED: { label: "Generated", className: "bg-teal-50 text-teal-700 border-teal-200" },
  PUBLISHED: { label: "Published", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DRAFT: { label: "Draft", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  AI_GENERATED: { label: "AI Generated", className: "bg-violet-50 text-violet-700 border-violet-200" },
  ADAPTED: { label: "Adapted", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  NEEDS_REVIEW: { label: "Needs Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-teal-50 text-teal-700 border-teal-200" },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-700 border-blue-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
}

interface StatusBadgeProps {
  status: AnyStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, className: "bg-zinc-100 text-zinc-500 border-zinc-200" }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-md border",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
