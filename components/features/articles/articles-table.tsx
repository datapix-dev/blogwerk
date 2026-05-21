"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Trash2, Eye, Sparkles, X } from "lucide-react"
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
import { GenerateArticleDialog } from "./generate-article-dialog"
import { deleteArticles } from "@/server/actions/articles"
import type { ArticleWithRelations } from "@/server/actions/articles"
import type { ArticleStatus } from "@prisma/client"

interface ProjectOption {
  id: string
  name: string
}

interface KeywordOption {
  id: string
  keyword: string
  projectId: string
  projectName: string
  searchVolume: number | null
  difficulty: number | null
  intent: string | null
}

interface ArticlesTableProps {
  initialData: ArticleWithRelations[]
  projects: ProjectOption[]
  keywords: KeywordOption[]
}

const ALL_VALUE = "__all__"

const ARTICLE_STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "AI_GENERATED", label: "AI Generated" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
]

export function ArticlesTable({ initialData, projects, keywords }: ArticlesTableProps) {
  const router = useRouter()
  const [data, setData] = React.useState<ArticleWithRelations[]>(initialData)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<ArticleStatus | "">("")
  const [projectFilter, setProjectFilter] = React.useState("")
  const [selectedRows, setSelectedRows] = React.useState<ArticleWithRelations[]>([])
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const filteredData = React.useMemo(
    () =>
      data.filter((a) => {
        if (search) {
          const q = search.toLowerCase()
          if (
            !a.title?.toLowerCase().includes(q) &&
            !a.keyword?.keyword.toLowerCase().includes(q) &&
            !a.slug?.toLowerCase().includes(q)
          )
            return false
        }
        if (statusFilter && a.status !== statusFilter) return false
        if (projectFilter && a.projectId !== projectFilter) return false
        return true
      }),
    [data, search, statusFilter, projectFilter]
  )

  function handleSuccess() {
    router.refresh()
  }

  async function handleBulkDelete() {
    if (!selectedRows.length) return
    if (!confirm(`Delete ${selectedRows.length} article(s)?`)) return
    const ids = selectedRows.map((r) => r.id)
    const result = await deleteArticles(ids)
    if (result.success) {
      setData((prev) => prev.filter((a) => !ids.includes(a.id)))
      setSelectedRows([])
    }
  }

  async function handleSingleDelete(id: string) {
    if (!confirm("Delete this article?")) return
    const result = await deleteArticles([id])
    if (result.success) setData((prev) => prev.filter((a) => a.id !== id))
  }

  const columns: ColumnDef<ArticleWithRelations>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Title <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="max-w-xs">
          <span className="font-medium text-zinc-900 line-clamp-2 text-sm">
            {row.original.title ?? (
              <span className="text-zinc-400 italic">Untitled</span>
            )}
          </span>
          {row.original.slug && (
            <p className="text-xs text-zinc-400 truncate mt-0.5">{row.original.slug}</p>
          )}
        </div>
      ),
    },
    {
      id: "keyword",
      header: "Keyword",
      cell: ({ row }) =>
        row.original.keyword ? (
          <span className="text-sm text-zinc-600">{row.original.keyword.keyword}</span>
        ) : (
          <span className="text-zinc-300">—</span>
        ),
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
      accessorKey: "status",
      header: "Status",
      size: 130,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-zinc-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Updated <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 110,
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
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg w-7 h-7 hover:bg-muted transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => router.push(`/articles/${row.original.id}`)}>
              <Eye className="w-3.5 h-3.5 mr-2" />View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => handleSingleDelete(row.original.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm mb-3">
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-red-500/80 border-red-400/50 text-white hover:bg-red-500"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setSelectedRows([])}
          >
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={filteredData}
        enableRowSelection
        onRowSelectionChange={setSelectedRows}
        emptyTitle="No articles yet"
        emptyDescription="Generate your first article by selecting a keyword."
        emptyAction={
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Article
          </Button>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 text-sm"
            />
            <Select
              value={statusFilter || ALL_VALUE}
              onValueChange={(v) =>
                setStatusFilter((v ?? "") === ALL_VALUE ? "" : ((v ?? "") as ArticleStatus))
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {ARTICLE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={projectFilter || ALL_VALUE}
              onValueChange={(v) => setProjectFilter((v ?? "") === ALL_VALUE ? "" : (v ?? ""))}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Button size="sm" className="h-8" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Article
              </Button>
            </div>
          </div>
        }
      />
      <GenerateArticleDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        keywords={keywords}
        onSuccess={handleSuccess}
      />
    </>
  )
}
