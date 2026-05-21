"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTemplate, updateTemplate } from "@/server/actions/templates"
import type { PromptTemplateRow } from "@/server/actions/templates"
import type { TemplateType } from "@prisma/client"

const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  ARTICLE: "Article Generation",
  EDITORIAL: "Editorial Brain",
  FORMATTING: "Blog Formatting",
  IMAGE: "Image Generation",
}

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  template?: PromptTemplateRow | null
  defaultType?: TemplateType
  onSuccess?: () => void
}

export function TemplateDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  template,
  defaultType = "ARTICLE",
  onSuccess,
}: TemplateDialogProps) {
  const isEditing = !!template
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<TemplateType>(defaultType)
  const [content, setContent] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(template?.name ?? "")
      setType(template?.type ?? defaultType)
      setContent(template?.content ?? "")
    }
  }, [open, template, defaultType])

  async function handleSave() {
    if (!name.trim()) { toast.error("Template name is required."); return }
    if (!content.trim()) { toast.error("Template content is required."); return }

    setSaving(true)
    try {
      if (isEditing) {
        const res = await updateTemplate(template.id, { name, content })
        if (!res.success) { toast.error(res.error); return }
        toast.success("Template updated.")
      } else {
        const res = await createTemplate({ projectId, type, name, content })
        if (!res.success) { toast.error(res.error); return }
        toast.success("Template created.")
      }
      onSuccess?.()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "New Template"}</DialogTitle>
          <p className="text-xs text-zinc-500">Project: {projectName}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Default Article Prompt"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => { if (v) setType(v as TemplateType) }}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TEMPLATE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prompt Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="font-mono text-xs resize-none"
              placeholder="Enter the prompt template content..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
