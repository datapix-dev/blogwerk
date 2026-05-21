# BlogPlanner — Plan 02: Projects + Keywords

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full Projects CRUD and Keywords management with CSV/XLSX import, reusable DataTable primitives, and complete server actions — deployed to blogwerk.astro-it.de.

**Architecture:** Server Actions for all mutations, SWR for client-side data fetching, TanStack Table v8 for all tables, shadcn/ui dialogs for forms, Prisma scoped by `workspaceId` for all queries.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table v8, SWR, papaparse, xlsx, Prisma 7

---

## File Map

```
blogwerk/
├── components/
│   └── features/
│       ├── data-table.tsx                          # NEW — generic TanStack Table wrapper
│       ├── status-badge.tsx                        # NEW — colored badge for all status enums
│       ├── empty-state.tsx                         # NEW — empty state with icon + CTA
│       ├── loading-skeleton.tsx                    # NEW — TableSkeleton + CardSkeleton
│       ├── projects/
│       │   ├── projects-table.tsx                  # NEW — client table component
│       │   └── project-dialog.tsx                  # NEW — create/edit modal
│       └── keywords/
│           ├── keywords-table.tsx                  # NEW — client table with bulk actions
│           ├── keyword-dialog.tsx                  # NEW — add/edit single keyword modal
│           └── keyword-import-dialog.tsx           # NEW — CSV/XLSX import flow (3 steps)
├── server/
│   └── actions/
│       ├── projects.ts                             # NEW — getProjects, createProject, etc.
│       └── keywords.ts                             # NEW — getKeywords, importKeywords, etc.
└── app/
    └── (dashboard)/
        ├── projects/
        │   ├── page.tsx                            # MODIFY — full server component
        │   └── [id]/
        │       └── page.tsx                        # NEW — project detail overview
        └── keywords/
            └── page.tsx                            # MODIFY — full server component
```

---

### Task 1: Shared Feature Components

**Files:**
- Create: `components/features/data-table.tsx`
- Create: `components/features/status-badge.tsx`
- Create: `components/features/empty-state.tsx`
- Create: `components/features/loading-skeleton.tsx`

- [ ] **Step 1: Create `components/features/data-table.tsx`**

```typescript
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableSkeleton } from "./loading-skeleton"
import { EmptyState } from "./empty-state"
import { TableProperties } from "lucide-react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  toolbar?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  pageSize?: number
  enableRowSelection?: boolean
  onRowSelectionChange?: (rows: TData[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  toolbar,
  emptyTitle = "No results",
  emptyDescription = "No data to display.",
  emptyAction,
  pageSize = 20,
  enableRowSelection = false,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const selectionColumn: ColumnDef<TData, TValue> = {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  }

  const finalColumns = enableRowSelection
    ? [selectionColumn, ...columns]
    : columns

  const table = useReactTable({
    data,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater
      setRowSelection(next)
      if (onRowSelectionChange) {
        const selectedRows = Object.keys(next)
          .filter((key) => next[key])
          .map((key) => data[parseInt(key)])
          .filter(Boolean)
        onRowSelectionChange(selectedRows)
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize },
    },
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {toolbar && <div className="opacity-50 pointer-events-none">{toolbar}</div>}
        <TableSkeleton rows={6} cols={finalColumns.length} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {toolbar && <div>{toolbar}</div>}

      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-zinc-200 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-medium text-zinc-500 bg-zinc-50 h-9 px-3"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-zinc-100 hover:bg-zinc-50/50 data-[state=selected]:bg-zinc-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 text-sm text-zinc-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={finalColumns.length} className="h-48 text-center p-0">
                  <EmptyState
                    icon={<TableProperties className="w-8 h-8" />}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-zinc-500">
          {enableRowSelection && (
            <span className="mr-3">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} selected
            </span>
          )}
          {table.getFilteredRowModel().rows.length} row
          {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/features/status-badge.tsx`**

```typescript
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ProjectStatus = "ACTIVE" | "PAUSED" | "ARCHIVED"
type KeywordStatus = "OPEN" | "PLANNED" | "IN_PROGRESS" | "GENERATED" | "PUBLISHED"
type ArticleStatus =
  | "DRAFT"
  | "AI_GENERATED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED"

type AnyStatus = ProjectStatus | KeywordStatus | ArticleStatus

interface StatusConfig {
  label: string
  className: string
}

const statusMap: Record<string, StatusConfig> = {
  // ProjectStatus
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PAUSED: { label: "Paused", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ARCHIVED: { label: "Archived", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  // KeywordStatus
  OPEN: { label: "Open", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PLANNED: { label: "Planned", className: "bg-violet-50 text-violet-700 border-violet-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  GENERATED: { label: "Generated", className: "bg-teal-50 text-teal-700 border-teal-200" },
  PUBLISHED: { label: "Published", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  // ArticleStatus
  DRAFT: { label: "Draft", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  AI_GENERATED: { label: "AI Generated", className: "bg-violet-50 text-violet-700 border-violet-200" },
  NEEDS_REVIEW: { label: "Needs Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-teal-50 text-teal-700 border-teal-200" },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-700 border-blue-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
}

interface StatusBadgeProps {
  status: AnyStatus | string
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
```

- [ ] **Step 3: Create `components/features/empty-state.tsx`**

```typescript
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
```

- [ ] **Step 4: Create `components/features/loading-skeleton.tsx`**

```typescript
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
      {/* Header */}
      <div className="flex items-center gap-3 px-3 h-9 bg-zinc-50 border-b border-zinc-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? 40 : undefined }} />
        ))}
      </div>
      {/* Rows */}
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
```

- [ ] **Step 5: Commit**

```bash
git add components/features/data-table.tsx components/features/status-badge.tsx components/features/empty-state.tsx components/features/loading-skeleton.tsx
git commit -m "feat: add shared DataTable, StatusBadge, EmptyState, LoadingSkeleton components"
```

---

### Task 2: Project Server Actions

**Files:**
- Create: `server/actions/projects.ts`

- [ ] **Step 1: Create `server/actions/projects.ts`**

```typescript
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { ProjectStatus, PublishMode } from "@prisma/client"

export type ProjectWithCounts = {
  id: string
  workspaceId: string
  name: string
  clientName: string | null
  blogUrl: string | null
  language: string
  targetAudience: string | null
  toneOfVoice: string | null
  defaultPublishMode: PublishMode
  status: ProjectStatus
  createdAt: Date
  _count: {
    keywords: number
    articles: number
  }
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function getProjects(): Promise<ProjectWithCounts[]> {
  const session = await requireSession()

  return db.project.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { keywords: true, articles: true },
      },
    },
  })
}

export async function getProjectById(id: string): Promise<ProjectWithCounts | null> {
  const session = await requireSession()

  return db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    include: {
      _count: {
        select: { keywords: true, articles: true },
      },
    },
  })
}

export type CreateProjectInput = {
  name: string
  clientName?: string
  blogUrl?: string
  language?: string
  targetAudience?: string
  toneOfVoice?: string
  defaultPublishMode?: PublishMode
}

export async function createProject(data: CreateProjectInput): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()

  if (!data.name?.trim()) {
    return { success: false, error: "Project name is required." }
  }

  try {
    const project = await db.project.create({
      data: {
        workspaceId: session.user.workspaceId,
        name: data.name.trim(),
        clientName: data.clientName?.trim() || null,
        blogUrl: data.blogUrl?.trim() || null,
        language: data.language ?? "de",
        targetAudience: data.targetAudience?.trim() || null,
        toneOfVoice: data.toneOfVoice?.trim() || null,
        defaultPublishMode: data.defaultPublishMode ?? "DRAFT",
      },
    })

    revalidatePath("/projects")
    return { success: true, id: project.id }
  } catch (err) {
    console.error("[createProject]", err)
    return { success: false, error: "Failed to create project." }
  }
}

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  status?: ProjectStatus
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const existing = await db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })

  if (!existing) {
    return { success: false, error: "Project not found." }
  }

  try {
    await db.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.clientName !== undefined && { clientName: data.clientName?.trim() || null }),
        ...(data.blogUrl !== undefined && { blogUrl: data.blogUrl?.trim() || null }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.targetAudience !== undefined && { targetAudience: data.targetAudience?.trim() || null }),
        ...(data.toneOfVoice !== undefined && { toneOfVoice: data.toneOfVoice?.trim() || null }),
        ...(data.defaultPublishMode !== undefined && { defaultPublishMode: data.defaultPublishMode }),
        ...(data.status !== undefined && { status: data.status }),
      },
    })

    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    return { success: true }
  } catch (err) {
    console.error("[updateProject]", err)
    return { success: false, error: "Failed to update project." }
  }
}

export async function deleteProject(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const existing = await db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })

  if (!existing) {
    return { success: false, error: "Project not found." }
  }

  try {
    await db.project.delete({ where: { id } })
    revalidatePath("/projects")
    return { success: true }
  } catch (err) {
    console.error("[deleteProject]", err)
    return { success: false, error: "Failed to delete project." }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/actions/projects.ts
git commit -m "feat: add project server actions (getProjects, createProject, updateProject, deleteProject)"
```

---

### Task 3: Projects List Page

**Files:**
- Modify: `app/(dashboard)/projects/page.tsx`
- Create: `components/features/projects/projects-table.tsx`
- Create: `components/features/projects/project-dialog.tsx`

- [ ] **Step 1: Create `components/features/projects/project-dialog.tsx`**

```typescript
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createProject, updateProject } from "@/server/actions/projects"
import type { ProjectWithCounts } from "@/server/actions/projects"
import type { ProjectStatus, PublishMode } from "@prisma/client"

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: ProjectWithCounts | null
  onSuccess?: () => void
}

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
]

const PUBLISH_MODES: { value: PublishMode; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISH", label: "Publish immediately" },
]

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
]

export function ProjectDialog({ open, onOpenChange, project, onSuccess }: ProjectDialogProps) {
  const isEditing = !!project

  const [name, setName] = React.useState("")
  const [clientName, setClientName] = React.useState("")
  const [blogUrl, setBlogUrl] = React.useState("")
  const [language, setLanguage] = React.useState("de")
  const [targetAudience, setTargetAudience] = React.useState("")
  const [toneOfVoice, setToneOfVoice] = React.useState("")
  const [defaultPublishMode, setDefaultPublishMode] = React.useState<PublishMode>("DRAFT")
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setClientName(project?.clientName ?? "")
      setBlogUrl(project?.blogUrl ?? "")
      setLanguage(project?.language ?? "de")
      setTargetAudience(project?.targetAudience ?? "")
      setToneOfVoice(project?.toneOfVoice ?? "")
      setDefaultPublishMode(project?.defaultPublishMode ?? "DRAFT")
      setStatus(project?.status ?? "ACTIVE")
      setError("")
    }
  }, [open, project])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const payload = {
        name,
        clientName: clientName || undefined,
        blogUrl: blogUrl || undefined,
        language,
        targetAudience: targetAudience || undefined,
        toneOfVoice: toneOfVoice || undefined,
        defaultPublishMode,
      }

      const result = isEditing
        ? await updateProject(project!.id, { ...payload, status })
        : await createProject(payload)

      if (!result.success) {
        setError(result.error)
        return
      }

      onSuccess?.()
      onOpenChange(false)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="proj-name"
              placeholder="My Blog Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Client Name + Blog URL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-client">Client Name</Label>
              <Input
                id="proj-client"
                placeholder="Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-url">Blog URL</Label>
              <Input
                id="proj-url"
                type="url"
                placeholder="https://blog.example.com"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Language + Publish Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Publish Mode</Label>
              <Select value={defaultPublishMode} onValueChange={(v) => setDefaultPublishMode(v as PublishMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISH_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-audience">Target Audience</Label>
            <Input
              id="proj-audience"
              placeholder="Marketing managers, B2B SaaS founders"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>

          {/* Tone of Voice */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-tone">Tone of Voice</Label>
            <Textarea
              id="proj-tone"
              placeholder="Professional, approachable, data-driven..."
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Status (edit only) */}
          {isEditing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `components/features/projects/projects-table.tsx`**

```typescript
"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, FolderOpen, Pencil, Trash2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DataTable } from "../data-table"
import { StatusBadge } from "../status-badge"
import { ProjectDialog } from "./project-dialog"
import { deleteProject } from "@/server/actions/projects"
import type { ProjectWithCounts } from "@/server/actions/projects"

interface ProjectsTableProps {
  initialData: ProjectWithCounts[]
}

export function ProjectsTable({ initialData }: ProjectsTableProps) {
  const router = useRouter()
  const [data, setData] = React.useState<ProjectWithCounts[]>(initialData)
  const [search, setSearch] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<ProjectWithCounts | null>(null)

  const filteredData = React.useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.clientName?.toLowerCase().includes(q) ?? false) ||
        (p.blogUrl?.toLowerCase().includes(q) ?? false)
    )
  }, [data, search])

  function handleSuccess() {
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This will also delete all associated keywords and articles.")) return
    const result = await deleteProject(id)
    if (result.success) {
      setData((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const columns: ColumnDef<ProjectWithCounts>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-zinc-900">{row.original.name}</p>
          {row.original.blogUrl && (
            <a
              href={row.original.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.blogUrl}
            </a>
          )}
        </div>
      ),
    },
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ getValue }) => (
        <span className="text-zinc-600">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "language",
      header: "Lang",
      size: 60,
      cell: ({ getValue }) => (
        <span className="uppercase text-xs font-medium text-zinc-500">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: "keywords",
      header: "Keywords",
      size: 90,
      cell: ({ row }) => (
        <span className="tabular-nums text-zinc-600">{row.original._count.keywords}</span>
      ),
    },
    {
      id: "articles",
      header: "Articles",
      size: 80,
      cell: ({ row }) => (
        <span className="tabular-nums text-zinc-600">{row.original._count.articles}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-500">
          {format(new Date(getValue() as Date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`/projects/${row.original.id}`)}>
              <FolderOpen className="w-3.5 h-3.5 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditingProject(row.original)
                setDialogOpen(true)
              }}
            >
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredData}
        emptyTitle="No projects yet"
        emptyDescription="Create your first project to start managing keywords and articles."
        emptyAction={
          <Button
            size="sm"
            onClick={() => {
              setEditingProject(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Project
          </Button>
        }
        toolbar={
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-60 text-sm"
            />
            <div className="ml-auto">
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  setEditingProject(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Project
              </Button>
            </div>
          </div>
        }
      />

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingProject(null)
        }}
        project={editingProject}
        onSuccess={handleSuccess}
      />
    </>
  )
}
```

- [ ] **Step 3: Modify `app/(dashboard)/projects/page.tsx`**

```typescript
import { getProjects } from "@/server/actions/projects"
import { ProjectsTable } from "@/components/features/projects/projects-table"

export const metadata = { title: "Projects — BlogPlanner" }

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Projects</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage your content projects and their settings.
        </p>
      </div>
      <ProjectsTable initialData={projects} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/projects/page.tsx components/features/projects/
git commit -m "feat: add projects list page with DataTable, create/edit dialog, delete"
```

---

### Task 4: Project Detail Page

**Files:**
- Create: `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Create `app/(dashboard)/projects/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation"
import Link from "next/link"
import { getProjectById } from "@/server/actions/projects"
import { StatusBadge } from "@/components/features/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tags, FileText, Globe, ArrowLeft, ExternalLink } from "lucide-react"
import { format } from "date-fns"

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) notFound()

  const publishModeLabels: Record<string, string> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    PUBLISH: "Publish immediately",
  }

  const languageLabels: Record<string, string> = {
    de: "Deutsch",
    en: "English",
    fr: "Français",
    es: "Español",
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mb-1"
          >
            <ArrowLeft className="w-3 h-3" />
            All Projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.clientName && (
            <p className="text-sm text-zinc-500">Client: {project.clientName}</p>
          )}
        </div>

        {project.blogUrl && (
          <a
            href={project.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white hover:border-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Visit Blog
          </a>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Tags className="w-3.5 h-3.5" />
              <span className="text-xs">Keywords</span>
            </div>
            <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
              {project._count.keywords}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs">Articles</span>
            </div>
            <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
              {project._count.articles}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Globe className="w-3.5 h-3.5" />
              <span className="text-xs">Language</span>
            </div>
            <p className="text-sm font-medium text-zinc-900">
              {languageLabels[project.language] ?? project.language}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs">Publish Mode</span>
            </div>
            <p className="text-sm font-medium text-zinc-900">
              {publishModeLabels[project.defaultPublishMode] ?? project.defaultPublishMode}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details card */}
      <Card className="rounded-xl border-zinc-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-700">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {project.targetAudience && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 mb-0.5">Target Audience</p>
                <p className="text-zinc-700">{project.targetAudience}</p>
              </div>
            )}
            {project.toneOfVoice && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 mb-0.5">Tone of Voice</p>
                <p className="text-zinc-700">{project.toneOfVoice}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Created</p>
              <p className="text-zinc-700">{format(new Date(project.createdAt), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Workspace ID</p>
              <p className="text-zinc-500 font-mono text-xs">{project.workspaceId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick navigation */}
      <div className="flex gap-3">
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/keywords?projectId=${project.id}`}>
            <Tags className="w-3.5 h-3.5" />
            Go to Keywords ({project._count.keywords})
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/articles?projectId=${project.id}`}>
            <FileText className="w-3.5 h-3.5" />
            Go to Articles ({project._count.articles})
          </Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/projects/
git commit -m "feat: add project detail page with stats grid and quick navigation"
```

---

### Task 5: Keyword Server Actions

**Files:**
- Create: `server/actions/keywords.ts`

- [ ] **Step 1: Create `server/actions/keywords.ts`**

```typescript
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

export type KeywordWithProject = {
  id: string
  projectId: string
  keyword: string
  searchVolume: number | null
  difficulty: number | null
  intent: SearchIntent | null
  priority: Priority
  cluster: string | null
  targetUrl: string | null
  status: KeywordStatus
  createdAt: Date
  project: {
    id: string
    name: string
  }
}

export type KeywordFilters = {
  projectId?: string
  status?: KeywordStatus
  intent?: SearchIntent
  priority?: Priority
  search?: string
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function getKeywords(filters?: KeywordFilters): Promise<KeywordWithProject[]> {
  const session = await requireSession()

  return db.keyword.findMany({
    where: {
      project: { workspaceId: session.user.workspaceId },
      ...(filters?.projectId && { projectId: filters.projectId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.intent && { intent: filters.intent }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.search && {
        keyword: { contains: filters.search, mode: "insensitive" },
      }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
    },
  })
}

export type CreateKeywordInput = {
  projectId: string
  keyword: string
  searchVolume?: number
  difficulty?: number
  intent?: SearchIntent
  priority?: Priority
  cluster?: string
  targetUrl?: string
  status?: KeywordStatus
}

export async function createKeyword(
  data: CreateKeywordInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()

  if (!data.keyword?.trim()) {
    return { success: false, error: "Keyword is required." }
  }

  // Verify project belongs to workspace
  const project = await db.project.findFirst({
    where: { id: data.projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) {
    return { success: false, error: "Project not found." }
  }

  try {
    const kw = await db.keyword.create({
      data: {
        projectId: data.projectId,
        keyword: data.keyword.trim(),
        searchVolume: data.searchVolume ?? null,
        difficulty: data.difficulty ?? null,
        intent: data.intent ?? null,
        priority: data.priority ?? "MEDIUM",
        cluster: data.cluster?.trim() || null,
        targetUrl: data.targetUrl?.trim() || null,
        status: data.status ?? "OPEN",
      },
    })

    revalidatePath("/keywords")
    revalidatePath(`/projects/${data.projectId}`)
    return { success: true, id: kw.id }
  } catch (err) {
    console.error("[createKeyword]", err)
    return { success: false, error: "Failed to create keyword." }
  }
}

export type UpdateKeywordInput = Partial<Omit<CreateKeywordInput, "projectId">>

export async function updateKeyword(
  id: string,
  data: UpdateKeywordInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const existing = await db.keyword.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, projectId: true },
  })
  if (!existing) {
    return { success: false, error: "Keyword not found." }
  }

  try {
    await db.keyword.update({
      where: { id },
      data: {
        ...(data.keyword !== undefined && { keyword: data.keyword.trim() }),
        ...(data.searchVolume !== undefined && { searchVolume: data.searchVolume ?? null }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty ?? null }),
        ...(data.intent !== undefined && { intent: data.intent ?? null }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.cluster !== undefined && { cluster: data.cluster?.trim() || null }),
        ...(data.targetUrl !== undefined && { targetUrl: data.targetUrl?.trim() || null }),
        ...(data.status !== undefined && { status: data.status }),
      },
    })

    revalidatePath("/keywords")
    revalidatePath(`/projects/${existing.projectId}`)
    return { success: true }
  } catch (err) {
    console.error("[updateKeyword]", err)
    return { success: false, error: "Failed to update keyword." }
  }
}

export async function deleteKeywords(
  ids: string[]
): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  const session = await requireSession()

  if (!ids.length) {
    return { success: false, error: "No keyword IDs provided." }
  }

  // Verify all keywords belong to workspace
  const owned = await db.keyword.findMany({
    where: { id: { in: ids }, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  const ownedIds = owned.map((k) => k.id)

  if (!ownedIds.length) {
    return { success: false, error: "No matching keywords found." }
  }

  try {
    const { count } = await db.keyword.deleteMany({
      where: { id: { in: ownedIds } },
    })

    revalidatePath("/keywords")
    return { success: true, deleted: count }
  } catch (err) {
    console.error("[deleteKeywords]", err)
    return { success: false, error: "Failed to delete keywords." }
  }
}

export type ImportKeywordRow = {
  keyword: string
  searchVolume?: number | null
  difficulty?: number | null
  intent?: SearchIntent | null
  priority?: Priority | null
  cluster?: string | null
  targetUrl?: string | null
}

export type ImportKeywordsResult = {
  imported: number
  duplicates: number
  errors: string[]
}

export async function importKeywords(
  projectId: string,
  rows: ImportKeywordRow[]
): Promise<{ success: true; result: ImportKeywordsResult } | { success: false; error: string }> {
  const session = await requireSession()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) {
    return { success: false, error: "Project not found." }
  }

  const validRows = rows.filter((r) => r.keyword?.trim())
  if (!validRows.length) {
    return { success: false, error: "No valid keyword rows found." }
  }

  // Fetch existing keywords for duplicate detection
  const keywords = validRows.map((r) => r.keyword.trim().toLowerCase())
  const existing = await db.keyword.findMany({
    where: {
      projectId,
      keyword: { in: keywords, mode: "insensitive" },
    },
    select: { keyword: true },
  })
  const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()))

  const toInsert: ImportKeywordRow[] = []
  let duplicates = 0
  const errors: string[] = []

  for (const row of validRows) {
    const kw = row.keyword.trim()
    if (existingSet.has(kw.toLowerCase())) {
      duplicates++
      continue
    }
    toInsert.push(row)
  }

  let imported = 0
  for (const row of toInsert) {
    try {
      await db.keyword.create({
        data: {
          projectId,
          keyword: row.keyword.trim(),
          searchVolume: row.searchVolume ?? null,
          difficulty: row.difficulty ?? null,
          intent: row.intent ?? null,
          priority: row.priority ?? "MEDIUM",
          cluster: row.cluster?.trim() || null,
          targetUrl: row.targetUrl?.trim() || null,
          status: "OPEN",
        },
      })
      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to import "${row.keyword}": ${msg}`)
    }
  }

  revalidatePath("/keywords")
  revalidatePath(`/projects/${projectId}`)

  return {
    success: true,
    result: { imported, duplicates, errors },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/actions/keywords.ts
git commit -m "feat: add keyword server actions (getKeywords, createKeyword, updateKeyword, deleteKeywords, importKeywords)"
```

---

### Task 6: Keywords List Page

**Files:**
- Modify: `app/(dashboard)/keywords/page.tsx`
- Create: `components/features/keywords/keywords-table.tsx`
- Create: `components/features/keywords/keyword-dialog.tsx`

- [ ] **Step 1: Create `components/features/keywords/keyword-dialog.tsx`**

```typescript
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createKeyword, updateKeyword } from "@/server/actions/keywords"
import type { KeywordWithProject } from "@/server/actions/keywords"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

interface ProjectOption {
  id: string
  name: string
}

interface KeywordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyword?: KeywordWithProject | null
  projects: ProjectOption[]
  defaultProjectId?: string
  onSuccess?: () => void
}

const INTENTS: { value: SearchIntent; label: string }[] = [
  { value: "INFORMATIONAL", label: "Informational" },
  { value: "NAVIGATIONAL", label: "Navigational" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "TRANSACTIONAL", label: "Transactional" },
]

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
]

const STATUSES: { value: KeywordStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "GENERATED", label: "Generated" },
  { value: "PUBLISHED", label: "Published" },
]

const NONE_VALUE = "__none__"

export function KeywordDialog({
  open,
  onOpenChange,
  keyword,
  projects,
  defaultProjectId,
  onSuccess,
}: KeywordDialogProps) {
  const isEditing = !!keyword

  const [kw, setKw] = React.useState("")
  const [projectId, setProjectId] = React.useState("")
  const [searchVolume, setSearchVolume] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("")
  const [intent, setIntent] = React.useState<SearchIntent | "">("")
  const [priority, setPriority] = React.useState<Priority>("MEDIUM")
  const [cluster, setCluster] = React.useState("")
  const [targetUrl, setTargetUrl] = React.useState("")
  const [status, setStatus] = React.useState<KeywordStatus>("OPEN")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setKw(keyword?.keyword ?? "")
      setProjectId(keyword?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "")
      setSearchVolume(keyword?.searchVolume != null ? String(keyword.searchVolume) : "")
      setDifficulty(keyword?.difficulty != null ? String(keyword.difficulty) : "")
      setIntent(keyword?.intent ?? "")
      setPriority(keyword?.priority ?? "MEDIUM")
      setCluster(keyword?.cluster ?? "")
      setTargetUrl(keyword?.targetUrl ?? "")
      setStatus(keyword?.status ?? "OPEN")
      setError("")
    }
  }, [open, keyword, defaultProjectId, projects])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const payload = {
        keyword: kw,
        searchVolume: searchVolume ? parseInt(searchVolume, 10) : undefined,
        difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
        intent: (intent || undefined) as SearchIntent | undefined,
        priority,
        cluster: cluster || undefined,
        targetUrl: targetUrl || undefined,
        status,
      }

      const result = isEditing
        ? await updateKeyword(keyword!.id, payload)
        : await createKeyword({ projectId, ...payload })

      if (!result.success) {
        setError(result.error)
        return
      }

      onSuccess?.()
      onOpenChange(false)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Keyword" : "Add Keyword"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Project selector (create only) */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label>
                Project <span className="text-red-500">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Keyword */}
          <div className="space-y-1.5">
            <Label htmlFor="kw-keyword">
              Keyword <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kw-keyword"
              placeholder="best email marketing software"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Volume + Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-volume">Search Volume</Label>
              <Input
                id="kw-volume"
                type="number"
                min="0"
                placeholder="12000"
                value={searchVolume}
                onChange={(e) => setSearchVolume(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-difficulty">Difficulty (0–100)</Label>
              <Input
                id="kw-difficulty"
                type="number"
                min="0"
                max="100"
                placeholder="45"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
            </div>
          </div>

          {/* Intent + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intent</Label>
              <Select
                value={intent || NONE_VALUE}
                onValueChange={(v) => setIntent(v === NONE_VALUE ? "" : (v as SearchIntent))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {INTENTS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cluster + Target URL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-cluster">Cluster</Label>
              <Input
                id="kw-cluster"
                placeholder="Email Marketing"
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-url">Target URL</Label>
              <Input
                id="kw-url"
                type="url"
                placeholder="https://..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as KeywordStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Keyword"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `components/features/keywords/keywords-table.tsx`**

```typescript
"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowUpDown, MoreHorizontal, Pencil, Trash2, Plus,
  Upload, X, ChevronDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "../data-table"
import { StatusBadge } from "../status-badge"
import { KeywordDialog } from "./keyword-dialog"
import { KeywordImportDialog } from "./keyword-import-dialog"
import { deleteKeywords, updateKeyword } from "@/server/actions/keywords"
import type { KeywordWithProject } from "@/server/actions/keywords"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

interface ProjectOption {
  id: string
  name: string
}

interface KeywordsTableProps {
  initialData: KeywordWithProject[]
  projects: ProjectOption[]
  defaultProjectId?: string
}

const INTENT_LABELS: Record<string, string> = {
  INFORMATIONAL: "Info",
  NAVIGATIONAL: "Nav",
  COMMERCIAL: "Com",
  TRANSACTIONAL: "Trans",
}

const PRIORITY_CLASSES: Record<string, string> = {
  LOW: "text-zinc-400",
  MEDIUM: "text-amber-600",
  HIGH: "text-red-600",
}

const ALL_VALUE = "__all__"

export function KeywordsTable({ initialData, projects, defaultProjectId }: KeywordsTableProps) {
  const router = useRouter()
  const [data, setData] = React.useState<KeywordWithProject[]>(initialData)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<KeywordStatus | "">("")
  const [intentFilter, setIntentFilter] = React.useState<SearchIntent | "">("")
  const [priorityFilter, setPriorityFilter] = React.useState<Priority | "">("")
  const [selectedRows, setSelectedRows] = React.useState<KeywordWithProject[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [editingKeyword, setEditingKeyword] = React.useState<KeywordWithProject | null>(null)

  const filteredData = React.useMemo(() => {
    return data.filter((kw) => {
      if (search && !kw.keyword.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter && kw.status !== statusFilter) return false
      if (intentFilter && kw.intent !== intentFilter) return false
      if (priorityFilter && kw.priority !== priorityFilter) return false
      return true
    })
  }, [data, search, statusFilter, intentFilter, priorityFilter])

  function handleSuccess() {
    router.refresh()
  }

  async function handleBulkDelete() {
    if (!selectedRows.length) return
    if (!confirm(`Delete ${selectedRows.length} keyword(s)?`)) return
    const ids = selectedRows.map((r) => r.id)
    const result = await deleteKeywords(ids)
    if (result.success) {
      setData((prev) => prev.filter((k) => !ids.includes(k.id)))
      setSelectedRows([])
    }
  }

  async function handleBulkSetStatus(status: KeywordStatus) {
    for (const kw of selectedRows) {
      await updateKeyword(kw.id, { status })
    }
    router.refresh()
    setSelectedRows([])
  }

  async function handleBulkSetPriority(priority: Priority) {
    for (const kw of selectedRows) {
      await updateKeyword(kw.id, { priority })
    }
    router.refresh()
    setSelectedRows([])
  }

  async function handleSingleDelete(id: string) {
    if (!confirm("Delete this keyword?")) return
    const result = await deleteKeywords([id])
    if (result.success) {
      setData((prev) => prev.filter((k) => k.id !== id))
    }
  }

  const columns: ColumnDef<KeywordWithProject>[] = [
    {
      accessorKey: "keyword",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Keyword
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="font-medium text-zinc-900">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "searchVolume",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Volume
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return <span className="text-zinc-300">—</span>
        return <span className="tabular-nums text-zinc-600">{v.toLocaleString()}</span>
      },
    },
    {
      accessorKey: "difficulty",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Diff
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 70,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return <span className="text-zinc-300">—</span>
        const color = v >= 70 ? "text-red-600" : v >= 40 ? "text-amber-600" : "text-emerald-600"
        return <span className={`tabular-nums font-medium ${color}`}>{v}</span>
      },
    },
    {
      accessorKey: "intent",
      header: "Intent",
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as SearchIntent | null
        if (!v) return <span className="text-zinc-300">—</span>
        return <span className="text-xs text-zinc-600">{INTENT_LABELS[v] ?? v}</span>
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as Priority
        return (
          <span className={`text-xs font-medium ${PRIORITY_CLASSES[v] ?? "text-zinc-500"}`}>
            {v.charAt(0) + v.slice(1).toLowerCase()}
          </span>
        )
      },
    },
    {
      accessorKey: "cluster",
      header: "Cluster",
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-500">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 110,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: "project",
      header: "Project",
      cell: ({ row }) => (
        <span className="text-xs text-zinc-500 truncate max-w-[120px] block">
          {row.original.project.name}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-400">
          {format(new Date(getValue() as Date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => {
                setEditingKeyword(row.original)
                setDialogOpen(true)
              }}
            >
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => handleSingleDelete(row.original.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      {/* Bulk actions bar */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm mb-3">
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-2">
            {/* Set Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Set Status <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["OPEN", "PLANNED", "IN_PROGRESS", "GENERATED", "PUBLISHED"] as KeywordStatus[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkSetStatus(s)}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Set Priority */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Set Priority <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => (
                  <DropdownMenuItem key={p} onClick={() => handleBulkSetPriority(p)}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-red-500/80 border-red-400/50 text-white hover:bg-red-500"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setSelectedRows([])}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredData}
        enableRowSelection
        onRowSelectionChange={setSelectedRows}
        emptyTitle="No keywords yet"
        emptyDescription="Add keywords manually or import from CSV/XLSX."
        emptyAction={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setEditingKeyword(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Keyword
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import
            </Button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 text-sm"
            />

            {/* Status filter */}
            <Select
              value={statusFilter || ALL_VALUE}
              onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : (v as KeywordStatus))}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {(["OPEN", "PLANNED", "IN_PROGRESS", "GENERATED", "PUBLISHED"] as KeywordStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Intent filter */}
            <Select
              value={intentFilter || ALL_VALUE}
              onValueChange={(v) => setIntentFilter(v === ALL_VALUE ? "" : (v as SearchIntent))}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All intents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All intents</SelectItem>
                {(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"] as SearchIntent[]).map((i) => (
                  <SelectItem key={i} value={i}>
                    {INTENT_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority filter */}
            <Select
              value={priorityFilter || ALL_VALUE}
              onValueChange={(v) => setPriorityFilter(v === ALL_VALUE ? "" : (v as Priority))}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
                {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setImportOpen(true)}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  setEditingKeyword(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Keyword
              </Button>
            </div>
          </div>
        }
      />

      <KeywordDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingKeyword(null)
        }}
        keyword={editingKeyword}
        projects={projects}
        defaultProjectId={defaultProjectId}
        onSuccess={handleSuccess}
      />

      <KeywordImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projects={projects}
        defaultProjectId={defaultProjectId}
        onSuccess={handleSuccess}
      />
    </>
  )
}
```

- [ ] **Step 3: Modify `app/(dashboard)/keywords/page.tsx`**

```typescript
import { getKeywords } from "@/server/actions/keywords"
import { getProjects } from "@/server/actions/projects"
import { KeywordsTable } from "@/components/features/keywords/keywords-table"

export const metadata = { title: "Keywords — BlogPlanner" }

interface KeywordsPageProps {
  searchParams: Promise<{ projectId?: string }>
}

export default async function KeywordsPage({ searchParams }: KeywordsPageProps) {
  const { projectId } = await searchParams

  const [keywords, projects] = await Promise.all([
    getKeywords(projectId ? { projectId } : undefined),
    getProjects(),
  ])

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Keywords</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage keywords across all projects. Import from CSV or XLSX.
        </p>
      </div>
      <KeywordsTable
        initialData={keywords}
        projects={projectOptions}
        defaultProjectId={projectId}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/keywords/page.tsx components/features/keywords/keyword-dialog.tsx components/features/keywords/keywords-table.tsx
git commit -m "feat: add keywords list page with table, filters, bulk actions, add/edit dialog"
```

---

### Task 7: CSV/XLSX Import + Deploy

**Files:**
- Create: `components/features/keywords/keyword-import-dialog.tsx`

- [ ] **Step 1: Create `components/features/keywords/keyword-import-dialog.tsx`**

```typescript
"use client"

import * as React from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react"
import { importKeywords } from "@/server/actions/keywords"
import type { ImportKeywordRow, ImportKeywordsResult } from "@/server/actions/keywords"
import type { SearchIntent, Priority } from "@prisma/client"
import { cn } from "@/lib/utils"

type Step = "upload" | "mapping" | "result"

interface ProjectOption {
  id: string
  name: string
}

interface KeywordImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  defaultProjectId?: string
  onSuccess?: () => void
}

// Keyword fields that can be mapped from a CSV column
const KEYWORD_FIELDS = [
  { value: "keyword", label: "Keyword *" },
  { value: "searchVolume", label: "Search Volume" },
  { value: "difficulty", label: "Difficulty" },
  { value: "intent", label: "Intent" },
  { value: "priority", label: "Priority" },
  { value: "cluster", label: "Cluster" },
  { value: "targetUrl", label: "Target URL" },
] as const

type KeywordField = (typeof KEYWORD_FIELDS)[number]["value"]

const SKIP_VALUE = "__skip__"
const NONE_VALUE = "__none__"

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function parseIntent(v: unknown): SearchIntent | null {
  const map: Record<string, SearchIntent> = {
    informational: "INFORMATIONAL",
    navigational: "NAVIGATIONAL",
    commercial: "COMMERCIAL",
    transactional: "TRANSACTIONAL",
    info: "INFORMATIONAL",
    nav: "NAVIGATIONAL",
    com: "COMMERCIAL",
    trans: "TRANSACTIONAL",
  }
  if (v == null || v === "") return null
  return map[String(v).toLowerCase().trim()] ?? null
}

function parsePriority(v: unknown): Priority | null {
  const map: Record<string, Priority> = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
  }
  if (v == null || v === "") return null
  return map[String(v).toLowerCase().trim()] ?? null
}

export function KeywordImportDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  onSuccess,
}: KeywordImportDialogProps) {
  const [step, setStep] = React.useState<Step>("upload")
  const [dragging, setDragging] = React.useState(false)
  const [fileName, setFileName] = React.useState("")
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rawRows, setRawRows] = React.useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = React.useState<Record<string, KeywordField | typeof SKIP_VALUE>>({})
  const [projectId, setProjectId] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<ImportKeywordsResult | null>(null)
  const [uploadError, setUploadError] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Reset on open/close
  React.useEffect(() => {
    if (open) {
      setStep("upload")
      setFileName("")
      setHeaders([])
      setRawRows([])
      setMapping({})
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "")
      setResult(null)
      setUploadError("")
    }
  }, [open, defaultProjectId, projects])

  function autoDetectMapping(detectedHeaders: string[]): Record<string, KeywordField | typeof SKIP_VALUE> {
    const auto: Record<string, KeywordField | typeof SKIP_VALUE> = {}
    const fieldAliases: Record<KeywordField, string[]> = {
      keyword: ["keyword", "term", "query", "phrase", "search term", "schlüsselwort"],
      searchVolume: ["search volume", "volume", "vol", "sv", "searches"],
      difficulty: ["difficulty", "kd", "keyword difficulty", "diff"],
      intent: ["intent", "search intent", "type"],
      priority: ["priority", "prio"],
      cluster: ["cluster", "topic", "group", "category"],
      targetUrl: ["target url", "url", "target", "landing page"],
    }

    for (const header of detectedHeaders) {
      const h = header.toLowerCase().trim()
      let matched = false
      for (const [field, aliases] of Object.entries(fieldAliases) as [KeywordField, string[]][]) {
        if (aliases.some((a) => h.includes(a) || a.includes(h))) {
          auto[header] = field
          matched = true
          break
        }
      }
      if (!matched) auto[header] = SKIP_VALUE
    }
    return auto
  }

  function processFile(file: File) {
    setUploadError("")

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[]
          const detectedHeaders = results.meta.fields ?? []
          setRawRows(rows)
          setHeaders(detectedHeaders)
          setMapping(autoDetectMapping(detectedHeaders))
          setFileName(file.name)
          setStep("mapping")
        },
        error: (err) => {
          setUploadError(`CSV parse error: ${err.message}`)
        },
      })
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (!data) throw new Error("Empty file")
          const workbook = XLSX.read(data as ArrayBuffer, { type: "array" })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
          if (!rows.length) throw new Error("No rows found in spreadsheet.")
          const detectedHeaders = Object.keys(rows[0])
          setRawRows(rows)
          setHeaders(detectedHeaders)
          setMapping(autoDetectMapping(detectedHeaders))
          setFileName(file.name)
          setStep("mapping")
        } catch (err) {
          setUploadError(`XLSX parse error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setUploadError("Unsupported file type. Please upload a .csv or .xlsx file.")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (!projectId) return
    setLoading(true)

    const kwField = Object.entries(mapping).find(([, v]) => v === "keyword")?.[0]
    if (!kwField) {
      setUploadError("You must map the Keyword column.")
      setLoading(false)
      return
    }

    const importRows: ImportKeywordRow[] = rawRows
      .map((row) => {
        const mapped: Record<string, unknown> = {}
        for (const [header, field] of Object.entries(mapping)) {
          if (field !== SKIP_VALUE) {
            mapped[field] = row[header]
          }
        }
        if (!mapped["keyword"] || String(mapped["keyword"]).trim() === "") return null
        return {
          keyword: String(mapped["keyword"]).trim(),
          searchVolume: parseNumber(mapped["searchVolume"]),
          difficulty: parseNumber(mapped["difficulty"]),
          intent: parseIntent(mapped["intent"]),
          priority: parsePriority(mapped["priority"]),
          cluster: mapped["cluster"] ? String(mapped["cluster"]).trim() : null,
          targetUrl: mapped["targetUrl"] ? String(mapped["targetUrl"]).trim() : null,
        } satisfies ImportKeywordRow
      })
      .filter(Boolean) as ImportKeywordRow[]

    const res = await importKeywords(projectId, importRows)
    setLoading(false)

    if (!res.success) {
      setUploadError(res.error)
      return
    }

    setResult(res.result)
    setStep("result")
    onSuccess?.()
  }

  const previewRows = rawRows.slice(0, 3)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Keywords</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs mb-2">
          {(["upload", "mapping", "result"] as Step[]).map((s, idx) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  step === s ? "text-zinc-900 font-medium" : "text-zinc-400"
                )}
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs border",
                    step === s
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "border-zinc-200 text-zinc-400"
                  )}
                >
                  {idx + 1}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {idx < 2 && <div className="flex-1 h-px bg-zinc-200" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div
              className={cn(
                "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors",
                dragging
                  ? "border-zinc-400 bg-zinc-50"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="w-10 h-10 text-zinc-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">
                  Drop your CSV or XLSX file here
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">or click to browse</p>
              </div>
              <div className="text-xs text-zinc-400 bg-zinc-100 rounded-lg px-3 py-1.5">
                Supported: .csv, .xlsx, .xls
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === "mapping" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">{fileName}</span>
              <span className="text-zinc-400">— {rawRows.length} rows detected</span>
              <button
                className="ml-auto text-zinc-400 hover:text-zinc-600"
                onClick={() => setStep("upload")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Project selector */}
            <div className="space-y-1.5">
              <Label>
                Import into Project <span className="text-red-500">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Column mapping */}
            <div className="space-y-1.5">
              <Label>Map Columns</Label>
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 gap-0 text-xs font-medium text-zinc-500 bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                  <span>File Column</span>
                  <span>Maps to Field</span>
                </div>
                <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                  {headers.map((header) => (
                    <div key={header} className="grid grid-cols-2 gap-3 px-3 py-2 items-center">
                      <span className="text-sm text-zinc-700 font-mono truncate">{header}</span>
                      <Select
                        value={mapping[header] ?? SKIP_VALUE}
                        onValueChange={(v) =>
                          setMapping((prev) => ({ ...prev, [header]: v as KeywordField | typeof SKIP_VALUE }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                          {KEYWORD_FIELDS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            {previewRows.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Preview (first 3 rows)</Label>
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        {headers.slice(0, 6).map((h) => (
                          <th key={h} className="text-left px-2 py-1.5 font-medium text-zinc-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewRows.map((row, i) => (
                        <tr key={i}>
                          {headers.slice(0, 6).map((h) => (
                            <td key={h} className="px-2 py-1.5 text-zinc-600 max-w-[120px] truncate">
                              {row[h] != null ? String(row[h]) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {step === "result" && result && (
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-lg font-semibold text-zinc-900">Import Complete</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border border-zinc-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-emerald-600 tabular-nums">{result.imported}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Imported</p>
              </div>
              <div className="border border-zinc-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-amber-600 tabular-nums">{result.duplicates}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Duplicates skipped</p>
              </div>
              <div className="border border-zinc-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-red-600 tabular-nums">{result.errors.length}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-200 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto bg-red-50">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading || !projectId}>
                {loading ? "Importing..." : `Import ${rawRows.length} rows`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Deploy to production**

```bash
git add components/features/keywords/keyword-import-dialog.tsx
git commit -m "feat: add CSV/XLSX keyword import dialog with column mapping and duplicate detection"
```

Push and deploy:
```bash
git push origin main
./deploy.sh
```

Expected: All changes live at https://blogwerk.astro-it.de

- [ ] **Step 3: Verify deployment**

```bash
curl -sI https://blogwerk.astro-it.de/projects
# Expected: HTTP/2 200 or redirect to /login (auth working)

curl -sI https://blogwerk.astro-it.de/keywords
# Expected: HTTP/2 200 or redirect to /login
```

- [ ] **Step 4: Smoke test in browser**

1. Login at https://blogwerk.astro-it.de/login
2. Navigate to /projects — table loads, "New Project" button opens dialog
3. Create a project — appears in table with keyword/article counts at 0
4. Click project name/view — detail page shows stats and quick links
5. Navigate to /keywords — table loads, "Add Keyword" and "Import" buttons present
6. Add a keyword manually — appears in table
7. Import a CSV with columns: `keyword,search_volume,difficulty` — mapping step auto-detects, import completes with result summary

---

## Self-Review Checklist

- [x] **Spec coverage:** DataTable ✓, StatusBadge ✓, EmptyState ✓, LoadingSkeleton ✓, Project CRUD ✓, Keywords CRUD ✓, CSV import ✓, XLSX import ✓, bulk actions ✓, column mapping ✓, duplicate detection ✓
- [x] **Placeholder scan:** No TODO, no "implement later", no partial functions — every component fully renderable
- [x] **Type consistency:** All Prisma enum imports (`ProjectStatus`, `KeywordStatus`, `SearchIntent`, `Priority`, `PublishMode`) sourced from `@prisma/client`. `ProjectWithCounts` and `KeywordWithProject` exported from server actions and consumed by client components
- [x] **Workspace scoping:** Every server action calls `requireSession()` and scopes queries to `session.user.workspaceId`. Keywords scoped via `project.workspaceId` join
- [x] **No gaps:** All 7 tasks produce working, testable, committable output

---

_Next: Plan 03 — Articles + AI Generation_
