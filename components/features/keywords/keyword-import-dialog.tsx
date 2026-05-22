"use client"

import * as React from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react"
import { importKeywords } from "@/server/actions/keywords"
import type { ImportKeywordRow, ImportKeywordsResult } from "@/server/actions/keywords"
import type { SearchIntent, Priority } from "@prisma/client"
import { cn } from "@/lib/utils"

type Step = "upload" | "mapping" | "result"

interface ProjectOption { id: string; name: string }

interface KeywordImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  defaultProjectId?: string
  onSuccess?: () => void
}

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

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function parseIntent(v: unknown): SearchIntent | null {
  const map: Record<string, SearchIntent> = {
    informational: "INFORMATIONAL", navigational: "NAVIGATIONAL",
    commercial: "COMMERCIAL", transactional: "TRANSACTIONAL",
    info: "INFORMATIONAL", nav: "NAVIGATIONAL", com: "COMMERCIAL", trans: "TRANSACTIONAL",
  }
  if (v == null || v === "") return null
  return map[String(v).toLowerCase().trim()] ?? null
}

function parsePriority(v: unknown): Priority | null {
  const map: Record<string, Priority> = { low: "LOW", medium: "MEDIUM", high: "HIGH" }
  if (v == null || v === "") return null
  return map[String(v).toLowerCase().trim()] ?? null
}

export function KeywordImportDialog({ open, onOpenChange, projects, defaultProjectId, onSuccess }: KeywordImportDialogProps) {
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

  React.useEffect(() => {
    if (open) {
      setStep("upload"); setFileName(""); setHeaders([]); setRawRows([])
      setMapping({}); setProjectId(defaultProjectId ?? projects[0]?.id ?? "")
      setResult(null); setUploadError("")
    }
  }, [open, defaultProjectId, projects])

  const FIELD_ALIASES: Record<KeywordField, string[]> = {
    keyword: ["keyword", "term", "query", "phrase", "search term", "schlüsselwort", "keywords"],
    searchVolume: ["search volume", "volume", "vol", "sv", "searches", "search_volume", "suchvolumen", "monatliches suchvolumen"],
    difficulty: ["difficulty", "kd", "keyword difficulty", "diff", "kd%", "seo difficulty", "schwierigkeit"],
    intent: ["intent", "search intent", "type", "suchabsicht", "absicht"],
    priority: ["priority", "prio", "priorität"],
    cluster: ["cluster", "topic", "group", "category", "thema", "gruppe"],
    targetUrl: ["target url", "url", "target", "landing page", "target_url", "ziel-url"],
  }

  function autoDetectMapping(hdrs: string[]): Record<string, KeywordField | typeof SKIP_VALUE> {
    const auto: Record<string, KeywordField | typeof SKIP_VALUE> = {}
    for (const header of hdrs) {
      const h = header.toLowerCase().trim()
      let matched = false
      for (const [field, als] of Object.entries(FIELD_ALIASES) as [KeywordField, string[]][]) {
        if (als.some((a) => h === a || h.includes(a) || a.includes(h))) { auto[header] = field; matched = true; break }
      }
      if (!matched) auto[header] = SKIP_VALUE
    }
    return auto
  }

  function looksLikeHeaders(values: string[]): boolean {
    return values.some((v) => {
      const h = v.toLowerCase().trim()
      return Object.values(FIELD_ALIASES).some((als) => als.some((a) => h === a || h.includes(a) || a.includes(h)))
    })
  }

  function applyParsedData(rows: Record<string, unknown>[], hdrs: string[], fileName: string) {
    // If detected headers don't match any known field, try using first data row as headers
    if (!looksLikeHeaders(hdrs) && rows.length > 0) {
      const firstRowValues = Object.values(rows[0]).map((v) => String(v ?? ""))
      if (looksLikeHeaders(firstRowValues)) {
        const newHdrs = firstRowValues
        const newRows = rows.slice(1).map((row) => {
          const vals = Object.values(row)
          return Object.fromEntries(newHdrs.map((h, i) => [h, vals[i] ?? ""]))
        })
        setRawRows(newRows); setHeaders(newHdrs); setMapping(autoDetectMapping(newHdrs))
        setFileName(fileName); setStep("mapping")
        return
      }
    }
    setRawRows(rows); setHeaders(hdrs); setMapping(autoDetectMapping(hdrs))
    setFileName(fileName); setStep("mapping")
  }

  function processFile(file: File) {
    setUploadError("")
    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[]
          const hdrs = results.meta.fields ?? []
          applyParsedData(rows, hdrs, file.name)
        },
        error: (err) => setUploadError(`CSV parse error: ${err.message}`),
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
          if (!rows.length) throw new Error("No rows found.")
          const hdrs = Object.keys(rows[0])
          applyParsedData(rows, hdrs, file.name)
        } catch (err) {
          setUploadError(`XLSX error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setUploadError("Unsupported file type. Please upload .csv or .xlsx")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (!projectId) return
    setLoading(true)
    const kwField = Object.entries(mapping).find(([, v]) => v === "keyword")?.[0]
    if (!kwField) { setUploadError("You must map the Keyword column."); setLoading(false); return }
    const importRows: ImportKeywordRow[] = rawRows
      .map((row) => {
        const mapped: Record<string, unknown> = {}
        for (const [header, field] of Object.entries(mapping)) {
          if (field !== SKIP_VALUE) mapped[field] = row[header]
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
    if (!res.success) { setUploadError(res.error); return }
    setResult(res.result); setStep("result"); onSuccess?.()
  }

  const previewRows = rawRows.slice(0, 3)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Import Keywords</DialogTitle></DialogHeader>

        <div className="flex items-center gap-2 text-xs mb-2">
          {(["upload", "mapping", "result"] as Step[]).map((s, idx) => (
            <React.Fragment key={s}>
              <div className={cn("flex items-center gap-1.5", step === s ? "text-zinc-900 font-medium" : "text-zinc-400")}>
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs border",
                  step === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-400")}>
                  {idx + 1}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {idx < 2 && <div className="flex-1 h-px bg-zinc-200" />}
            </React.Fragment>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div
              className={cn("border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors",
                dragging ? "border-zinc-400 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50")}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="w-10 h-10 text-zinc-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">Drop your CSV or XLSX file here</p>
                <p className="text-xs text-zinc-400 mt-0.5">or click to browse</p>
              </div>
              <div className="text-xs text-zinc-400 bg-zinc-100 rounded-lg px-3 py-1.5">Supported: .csv, .xlsx, .xls</div>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadError}
              </div>
            )}
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">{fileName}</span>
              <span className="text-zinc-400">— {rawRows.length} rows</span>
              <button className="ml-auto text-zinc-400 hover:text-zinc-600" onClick={() => setStep("upload")}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-1.5">
              <Label>Import into Project <span className="text-red-500">*</span></Label>
              <Select value={projectId} onValueChange={(v) => { if (v) setProjectId(v) }}>
                <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Map Columns</Label>
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 gap-0 text-xs font-medium text-zinc-500 bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                  <span>File Column</span><span>Maps to Field</span>
                </div>
                <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                  {headers.map((header) => (
                    <div key={header} className="grid grid-cols-2 gap-3 px-3 py-2 items-center">
                      <span className="text-sm text-zinc-700 font-mono truncate">{header}</span>
                      <Select value={mapping[header] ?? SKIP_VALUE} onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v as KeywordField | typeof SKIP_VALUE }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                          {KEYWORD_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {previewRows.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Preview (first 3 rows)</Label>
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead><tr className="bg-zinc-50 border-b border-zinc-200">{headers.slice(0, 6).map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium text-zinc-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewRows.map((row, i) => (
                        <tr key={i}>{headers.slice(0, 6).map((h) => <td key={h} className="px-2 py-1.5 text-zinc-600 max-w-[120px] truncate">{row[h] != null ? String(row[h]) : ""}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {uploadError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadError}</div>}
          </div>
        )}

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
                {result.errors.map((err, i) => <p key={i} className="text-xs text-red-600">{err}</p>)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>Back</Button>
              <Button onClick={handleImport} disabled={loading || !projectId}>{loading ? "Importing..." : `Import ${rawRows.length} rows`}</Button>
            </>
          )}
          {step === "result" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
