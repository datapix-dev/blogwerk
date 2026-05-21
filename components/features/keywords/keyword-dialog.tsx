"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createKeyword, updateKeyword } from "@/server/actions/keywords"
import type { KeywordWithProject } from "@/server/actions/keywords"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

interface ProjectOption { id: string; name: string }

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

export function KeywordDialog({ open, onOpenChange, keyword, projects, defaultProjectId, onSuccess }: KeywordDialogProps) {
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
        priority, cluster: cluster || undefined, targetUrl: targetUrl || undefined, status,
      }
      const result = isEditing
        ? await updateKeyword(keyword!.id, payload)
        : await createKeyword({ projectId, ...payload })
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
        <DialogHeader><DialogTitle>{isEditing ? "Edit Keyword" : "Add Keyword"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Project <span className="text-red-500">*</span></Label>
              <Select value={projectId} onValueChange={(v) => { if (v) setProjectId(v) }} required>
                <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="kw-keyword">Keyword <span className="text-red-500">*</span></Label>
            <Input id="kw-keyword" placeholder="best email marketing software" value={kw} onChange={(e) => setKw(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-volume">Search Volume</Label>
              <Input id="kw-volume" type="number" min="0" placeholder="12000" value={searchVolume} onChange={(e) => setSearchVolume(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-difficulty">Difficulty (0–100)</Label>
              <Input id="kw-difficulty" type="number" min="0" max="100" placeholder="45" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intent</Label>
              <Select value={intent || NONE_VALUE} onValueChange={(v) => setIntent(v === NONE_VALUE ? "" : (v as SearchIntent))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {INTENTS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-cluster">Cluster</Label>
              <Input id="kw-cluster" placeholder="Email Marketing" value={cluster} onChange={(e) => setCluster(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-url">Target URL</Label>
              <Input id="kw-url" type="url" placeholder="https://..." value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as KeywordStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEditing ? "Save Changes" : "Add Keyword"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
