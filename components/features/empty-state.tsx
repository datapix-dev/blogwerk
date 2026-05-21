import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div className="text-zinc-300">{icon}</div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700">{title}</p>
        {description && (
          <p className="text-xs text-zinc-400 max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
