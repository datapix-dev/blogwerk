"use client"

import * as React from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
        name, clientName: clientName || undefined, blogUrl: blogUrl || undefined,
        language, targetAudience: targetAudience || undefined,
        toneOfVoice: toneOfVoice || undefined, defaultPublishMode,
      }
      const result = isEditing
        ? await updateProject(project!.id, { ...payload, status })
        : await createProject(payload)
      if (!result.success) { setError(result.error); return }
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
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name <span className="text-red-500">*</span></Label>
            <Input id="proj-name" placeholder="My Blog Project" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-client">Client Name</Label>
              <Input id="proj-client" placeholder="Acme Corp" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-url">Blog URL</Label>
              <Input id="proj-url" type="url" placeholder="https://blog.example.com" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={(v) => { if (v) setLanguage(v) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Publish Mode</Label>
              <Select value={defaultPublishMode} onValueChange={(v) => setDefaultPublishMode(v as PublishMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PUBLISH_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-audience">Target Audience</Label>
            <Input id="proj-audience" placeholder="Marketing managers, B2B SaaS founders" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-tone">Tone of Voice</Label>
            <Textarea id="proj-tone" placeholder="Professional, approachable, data-driven..." value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} rows={2} className="resize-none" />
          </div>
          {isEditing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
