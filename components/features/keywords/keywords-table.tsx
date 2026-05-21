"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Plus, Upload, X, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "../data-table"
import { StatusBadge } from "../status-badge"
import { KeywordDialog } from "./keyword-dialog"
import { KeywordImportDialog } from "./keyword-import-dialog"
import { deleteKeywords, updateKeyword } from "@/server/actions/keywords"
import type { KeywordWithProject } from "@/server/actions/keywords"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

interface ProjectOption { id: string; name: string }
interface KeywordsTableProps {
  initialData: KeywordWithProject[]
  projects: ProjectOption[]
  defaultProjectId?: string
}

const INTENT_LABELS: Record<string, string> = {
  INFORMATIONAL: "Info", NAVIGATIONAL: "Nav", COMMERCIAL: "Com", TRANSACTIONAL: "Trans",
}

const PRIORITY_CLASSES: Record<string, string> = {
  LOW: "text-zinc-400", MEDIUM: "text-amber-600", HIGH: "text-red-600",
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

  const filteredData = React.useMemo(() => data.filter((kw) => {
    if (search && !kw.keyword.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && kw.status !== statusFilter) return false
    if (intentFilter && kw.intent !== intentFilter) return false
    if (priorityFilter && kw.priority !== priorityFilter) return false
    return true
  }), [data, search, statusFilter, intentFilter, priorityFilter])

  function handleSuccess() { router.refresh() }

  async function handleBulkDelete() {
    if (!selectedRows.length) return
    if (!confirm(`Delete ${selectedRows.length} keyword(s)?`)) return
    const ids = selectedRows.map((r) => r.id)
    const result = await deleteKeywords(ids)
    if (result.success) { setData((prev) => prev.filter((k) => !ids.includes(k.id))); setSelectedRows([]) }
  }

  async function handleBulkSetStatus(status: KeywordStatus) {
    for (const kw of selectedRows) await updateKeyword(kw.id, { status })
    router.refresh(); setSelectedRows([])
  }

  async function handleBulkSetPriority(priority: Priority) {
    for (const kw of selectedRows) await updateKeyword(kw.id, { priority })
    router.refresh(); setSelectedRows([])
  }

  async function handleSingleDelete(id: string) {
    if (!confirm("Delete this keyword?")) return
    const result = await deleteKeywords([id])
    if (result.success) setData((prev) => prev.filter((k) => k.id !== id))
  }

  const columns: ColumnDef<KeywordWithProject>[] = [
    {
      accessorKey: "keyword",
      header: ({ column }) => <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Keyword <ArrowUpDown className="w-3 h-3" /></button>,
      cell: ({ getValue }) => <span className="font-medium text-zinc-900">{getValue() as string}</span>,
    },
    {
      accessorKey: "searchVolume",
      header: ({ column }) => <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Volume <ArrowUpDown className="w-3 h-3" /></button>,
      size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return <span className="text-zinc-300">—</span>
        return <span className="tabular-nums text-zinc-600">{v.toLocaleString()}</span>
      },
    },
    {
      accessorKey: "difficulty",
      header: ({ column }) => <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Diff <ArrowUpDown className="w-3 h-3" /></button>,
      size: 70,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return <span className="text-zinc-300">—</span>
        const color = v >= 70 ? "text-red-600" : v >= 40 ? "text-amber-600" : "text-emerald-600"
        return <span className={`tabular-nums font-medium ${color}`}>{v}</span>
      },
    },
    {
      accessorKey: "intent", header: "Intent", size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as SearchIntent | null
        if (!v) return <span className="text-zinc-300">—</span>
        return <span className="text-xs text-zinc-600">{INTENT_LABELS[v] ?? v}</span>
      },
    },
    {
      accessorKey: "priority", header: "Priority", size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as Priority
        return <span className={`text-xs font-medium ${PRIORITY_CLASSES[v] ?? "text-zinc-500"}`}>{v.charAt(0) + v.slice(1).toLowerCase()}</span>
      },
    },
    {
      accessorKey: "cluster", header: "Cluster",
      cell: ({ getValue }) => <span className="text-xs text-zinc-500">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      accessorKey: "status", header: "Status", size: 110,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: "project", header: "Project",
      cell: ({ row }) => <span className="text-xs text-zinc-500 truncate max-w-[120px] block">{row.original.project.name}</span>,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Created <ArrowUpDown className="w-3 h-3" /></button>,
      size: 100,
      cell: ({ getValue }) => <span className="text-xs text-zinc-400">{format(new Date(getValue() as Date), "dd MMM yyyy")}</span>,
    },
    {
      id: "actions", size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg w-7 h-7 hover:bg-muted transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => { setEditingKeyword(row.original); setDialogOpen(true) }}>
              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleSingleDelete(row.original.id)}>
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
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors">
                Set Status <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["OPEN", "PLANNED", "IN_PROGRESS", "GENERATED", "PUBLISHED"] as KeywordStatus[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkSetStatus(s)}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors">
                Set Priority <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => (
                  <DropdownMenuItem key={p} onClick={() => handleBulkSetPriority(p)}>{p.charAt(0) + p.slice(1).toLowerCase()}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" className="h-7 text-xs bg-red-500/80 border-red-400/50 text-white hover:bg-red-500" onClick={handleBulkDelete}>
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => setSelectedRows([])}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        </div>
      )}
      <DataTable
        columns={columns} data={filteredData} enableRowSelection onRowSelectionChange={setSelectedRows}
        emptyTitle="No keywords yet" emptyDescription="Add keywords manually or import from CSV/XLSX."
        emptyAction={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setEditingKeyword(null); setDialogOpen(true) }}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Keyword</Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-3.5 h-3.5 mr-1.5" />Import</Button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search keywords..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-52 text-sm" />
            <Select value={statusFilter || ALL_VALUE} onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : (v as KeywordStatus))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {(["OPEN", "PLANNED", "IN_PROGRESS", "GENERATED", "PUBLISHED"] as KeywordStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={intentFilter || ALL_VALUE} onValueChange={(v) => setIntentFilter(v === ALL_VALUE ? "" : (v as SearchIntent))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All intents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All intents</SelectItem>
                {(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"] as SearchIntent[]).map((i) => (
                  <SelectItem key={i} value={i}>{INTENT_LABELS[i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter || ALL_VALUE} onValueChange={(v) => setPriorityFilter(v === ALL_VALUE ? "" : (v as Priority))}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All priorities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
                {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setImportOpen(true)}><Upload className="w-3.5 h-3.5 mr-1.5" />Import</Button>
              <Button size="sm" className="h-8" onClick={() => { setEditingKeyword(null); setDialogOpen(true) }}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Keyword</Button>
            </div>
          </div>
        }
      />
      <KeywordDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingKeyword(null) }}
        keyword={editingKeyword} projects={projects} defaultProjectId={defaultProjectId} onSuccess={handleSuccess}
      />
      <KeywordImportDialog open={importOpen} onOpenChange={setImportOpen} projects={projects} defaultProjectId={defaultProjectId} onSuccess={handleSuccess} />
    </>
  )
}
