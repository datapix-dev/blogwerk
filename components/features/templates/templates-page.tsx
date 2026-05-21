"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, FileText, AlignLeft, Image, MoreHorizontal, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "../empty-state"
import { TemplateDialog } from "./template-dialog"
import {
  deleteTemplate,
  setActiveTemplate,
  getTemplates,
} from "@/server/actions/templates"
import type { PromptTemplateRow } from "@/server/actions/templates"
import type { TemplateType } from "@prisma/client"

interface ProjectOption {
  id: string
  name: string
}

interface TemplatesPageProps {
  projects: ProjectOption[]
  initialProjectId?: string
  initialTemplates: PromptTemplateRow[]
}

const TEMPLATE_SECTIONS: { type: TemplateType; label: string; icon: React.ElementType }[] = [
  { type: "ARTICLE", label: "Article Generation", icon: FileText },
  { type: "FORMATTING", label: "Formatting", icon: AlignLeft },
  { type: "IMAGE", label: "Image Generation", icon: Image },
]

export function TemplatesPage({ projects, initialProjectId, initialTemplates }: TemplatesPageProps) {
  const router = useRouter()
  const [projectId, setProjectId] = React.useState(initialProjectId ?? projects[0]?.id ?? "")
  const [templates, setTemplates] = React.useState<PromptTemplateRow[]>(initialTemplates)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<PromptTemplateRow | null>(null)
  const [defaultType, setDefaultType] = React.useState<TemplateType>("ARTICLE")

  const currentProject = projects.find((p) => p.id === projectId)

  async function loadTemplates(pid: string) {
    const data = await getTemplates(pid)
    setTemplates(data)
  }

  function handleProjectChange(pid: string) {
    setProjectId(pid)
    router.push(`/ai-templates?projectId=${pid}`)
    loadTemplates(pid)
  }

  function openAdd(type: TemplateType) {
    setEditingTemplate(null)
    setDefaultType(type)
    setDialogOpen(true)
  }

  function openEdit(t: PromptTemplateRow) {
    setEditingTemplate(t)
    setDialogOpen(true)
  }

  async function handleSetActive(id: string) {
    const res = await setActiveTemplate(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Active template updated.")
    await loadTemplates(projectId)
  }

  async function handleDelete(id: string) {
    const res = await deleteTemplate(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Template deleted.")
    await loadTemplates(projectId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">Project:</span>
        <Select value={projectId} onValueChange={(v) => { if (v) handleProjectChange(v) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!projectId ? (
        <EmptyState title="No project selected" description="Select a project to manage its templates." />
      ) : (
        TEMPLATE_SECTIONS.map(({ type, label, icon: Icon }) => {
          const sectionTemplates = templates.filter((t) => t.type === type)
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-zinc-400" />
                  <h2 className="text-sm font-semibold text-zinc-700">{label}</h2>
                  <Badge variant="secondary" className="text-xs">{sectionTemplates.length}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => openAdd(type)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Template
                </Button>
              </div>

              {sectionTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 py-8">
                  <EmptyState
                    title={`No ${label.toLowerCase()} templates`}
                    description="Create a template to customize AI generation for this project."
                    action={
                      <Button size="sm" variant="outline" onClick={() => openAdd(type)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Template
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionTemplates.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border bg-white p-4 space-y-2 ${
                        t.isActive
                          ? "ring-1 ring-zinc-900 border-zinc-900"
                          : "border-zinc-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{t.name}</p>
                          <p className="text-xs text-zinc-400">v{t.version}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.isActive && (
                            <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-zinc-100 transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(t)}>
                                Edit
                              </DropdownMenuItem>
                              {!t.isActive && (
                                <DropdownMenuItem onClick={() => handleSetActive(t.id)}>
                                  Set Active
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDelete(t.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-3 font-mono">{t.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectName={currentProject?.name ?? ""}
        template={editingTemplate}
        defaultType={defaultType}
        onSuccess={() => loadTemplates(projectId)}
      />
    </div>
  )
}
