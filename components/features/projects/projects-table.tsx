"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, FolderOpen, Pencil, Trash2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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
      (p) => p.name.toLowerCase().includes(q) || (p.clientName?.toLowerCase().includes(q) ?? false)
    )
  }, [data, search])

  function handleSuccess() { router.refresh() }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This will also delete all associated keywords and articles.")) return
    const result = await deleteProject(id)
    if (result.success) setData((prev) => prev.filter((p) => p.id !== id))
  }

  const columns: ColumnDef<ProjectWithCounts>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-zinc-900">{row.original.name}</p>
          {row.original.blogUrl && (
            <a href={row.original.blogUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
              onClick={(e) => e.stopPropagation()}>
              {row.original.blogUrl}
            </a>
          )}
        </div>
      ),
    },
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ getValue }) => <span className="text-zinc-600">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      accessorKey: "language",
      header: "Lang",
      size: 60,
      cell: ({ getValue }) => <span className="uppercase text-xs font-medium text-zinc-500">{getValue() as string}</span>,
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
      cell: ({ row }) => <span className="tabular-nums text-zinc-600">{row.original._count.keywords}</span>,
    },
    {
      id: "articles",
      header: "Articles",
      size: 80,
      cell: ({ row }) => <span className="tabular-nums text-zinc-600">{row.original._count.articles}</span>,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-zinc-900" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Created <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      size: 100,
      cell: ({ getValue }) => <span className="text-xs text-zinc-500">{format(new Date(getValue() as Date), "dd MMM yyyy")}</span>,
    },
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg w-7 h-7 hover:bg-muted transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`/projects/${row.original.id}`)}>
              <FolderOpen className="w-3.5 h-3.5 mr-2" />View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditingProject(row.original); setDialogOpen(true) }}>
              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDelete(row.original.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
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
          <Button size="sm" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />New Project
          </Button>
        }
        toolbar={
          <div className="flex items-center gap-3">
            <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-60 text-sm" />
            <div className="ml-auto">
              <Button size="sm" className="h-8" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />New Project
              </Button>
            </div>
          </div>
        }
      />
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProject(null) }}
        project={editingProject}
        onSuccess={handleSuccess}
      />
    </>
  )
}
