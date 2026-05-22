"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Brain, FileText, AlignLeft, Image, CheckCircle2, MoreHorizontal, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TemplateDialog } from "@/components/features/templates/template-dialog"
import {
  deleteTemplate,
  setActiveTemplate,
  getTemplates,
} from "@/server/actions/templates"
import type { PromptTemplateRow } from "@/server/actions/templates"
import type { TemplateType } from "@prisma/client"

const SECTIONS: { type: TemplateType; label: string; description: string; icon: React.ElementType }[] = [
  { type: "ARTICLE",    label: "Article Generation", description: "Custom prompt for Phase 1 content generation",  icon: FileText },
  { type: "EDITORIAL",  label: "Editorial Brain",    description: "Expert voice & anti-generic rules for Phase 1.5", icon: Brain },
  { type: "FORMATTING", label: "Blog Formatting",    description: "HTML template guide for Phase 2 adaptation",    icon: AlignLeft },
  { type: "IMAGE",      label: "Image Generation",   description: "Prompt for AI image generation",                icon: Image },
]

interface ProjectTemplatesSectionProps {
  projectId: string
  projectName: string
  initialTemplates: PromptTemplateRow[]
}

export function ProjectTemplatesSection({
  projectId,
  projectName,
  initialTemplates,
}: ProjectTemplatesSectionProps) {
  const [templates, setTemplates] = React.useState<PromptTemplateRow[]>(initialTemplates)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<PromptTemplateRow | null>(null)
  const [defaultType, setDefaultType] = React.useState<TemplateType>("ARTICLE")

  async function reload() {
    const data = await getTemplates(projectId)
    setTemplates(data)
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
    await reload()
  }

  async function handleDelete(id: string) {
    const res = await deleteTemplate(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Template deleted.")
    await reload()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700">AI Templates</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map(({ type, label, description, icon: Icon }) => {
          const active = templates.find((t) => t.type === type && t.isActive)
          const all = templates.filter((t) => t.type === type)

          return (
            <div key={type} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{label}</p>
                    <p className="text-xs text-zinc-400">{description}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => openAdd(type)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              {active ? (
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs font-medium text-zinc-800 truncate">{active.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">active</Badge>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1 font-mono ml-5">{active.content.slice(0, 60)}…</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(active)}
                    className="shrink-0 p-1 rounded hover:bg-zinc-200 transition-colors"
                  >
                    <Pencil className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-center">
                  <p className="text-xs text-zinc-400">No active template</p>
                </div>
              )}

              {all.filter((t) => !t.isActive).length > 0 && (
                <div className="space-y-1">
                  {all.filter((t) => !t.isActive).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-zinc-50">
                      <span className="text-xs text-zinc-500 truncate">{t.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded h-5 w-5 hover:bg-zinc-200 transition-colors shrink-0">
                          <MoreHorizontal className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetActive(t.id)}>Set Active</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(t.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectName={projectName}
        template={editingTemplate}
        defaultType={defaultType}
        onSuccess={reload}
      />
    </div>
  )
}
