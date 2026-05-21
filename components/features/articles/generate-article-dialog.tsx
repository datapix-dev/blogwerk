"use client"

import * as React from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "../status-badge"
import { generateArticleAction } from "@/server/actions/articles"
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Search,
  Eye,
} from "lucide-react"

interface KeywordOption {
  id: string
  keyword: string
  projectId: string
  projectName: string
  searchVolume: number | null
  difficulty: number | null
  intent: string | null
}

interface GenerateArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keywords: KeywordOption[]
  onSuccess?: () => void
}

type DialogStep = "select" | "generating" | "done" | "error"

type StatusResponse = {
  status: string
  errorType: string | null
  errorMsg: string | null
  job: {
    id: string
    status: string
    errorType: string | null
    errorMsg: string | null
    attempts: number
  } | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ERROR_MESSAGES: Record<string, string> = {
  CLAUDE_TIMEOUT: "Claude API timed out. The server will retry automatically.",
  CLAUDE_RATE_LIMIT: "Claude rate limit reached. Please wait a moment and try again.",
  RATE_LIMIT_REACHED:
    "Monthly generation limit reached. Upgrade your plan or wait until next month.",
  UNKNOWN: "An unknown error occurred during generation.",
}

export function GenerateArticleDialog({
  open,
  onOpenChange,
  keywords,
  onSuccess,
}: GenerateArticleDialogProps) {
  const router = useRouter()
  const [step, setStep] = React.useState<DialogStep>("select")
  const [search, setSearch] = React.useState("")
  const [selectedKeywordId, setSelectedKeywordId] = React.useState<string | null>(null)
  const [articleId, setArticleId] = React.useState<string | null>(null)
  const [articleStatus, setArticleStatus] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const { data: statusData } = useSWR<StatusResponse>(
    step === "generating" && articleId ? `/api/articles/${articleId}/status` : null,
    fetcher,
    {
      refreshInterval:
        articleStatus === "AI_GENERATED" || articleStatus === "FAILED" ? 0 : 3000,
    }
  )

  React.useEffect(() => {
    if (!statusData) return
    setArticleStatus(statusData.status)
    if (statusData.status === "AI_GENERATED") {
      setStep("done")
      onSuccess?.()
    } else if (statusData.status === "FAILED") {
      const errType = statusData.errorType ?? "UNKNOWN"
      setErrorMessage(ERROR_MESSAGES[errType] ?? ERROR_MESSAGES.UNKNOWN)
      setStep("error")
    }
  }, [statusData, onSuccess])

  React.useEffect(() => {
    if (!open) {
      setStep("select")
      setSearch("")
      setSelectedKeywordId(null)
      setArticleId(null)
      setArticleStatus(null)
      setErrorMessage(null)
      setLoading(false)
    }
  }, [open])

  const filteredKeywords = React.useMemo(
    () =>
      keywords.filter(
        (k) =>
          !search ||
          k.keyword.toLowerCase().includes(search.toLowerCase()) ||
          k.projectName.toLowerCase().includes(search.toLowerCase())
      ),
    [keywords, search]
  )

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId)

  async function handleGenerate() {
    if (!selectedKeywordId) return
    setLoading(true)
    try {
      const result = await generateArticleAction(selectedKeywordId)
      if (!result.success) {
        setErrorMessage(
          result.code === "RATE_LIMIT_REACHED"
            ? ERROR_MESSAGES.RATE_LIMIT_REACHED
            : result.error
        )
        setStep("error")
        return
      }
      setArticleId(result.articleId)
      setStep("generating")
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.")
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  function handleViewArticle() {
    if (articleId) router.push(`/articles/${articleId}`)
    onOpenChange(false)
  }

  function handleRetry() {
    setStep("select")
    setArticleId(null)
    setArticleStatus(null)
    setErrorMessage(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Generate Article
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <Input
                placeholder="Search keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {filteredKeywords.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                  No open keywords found.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredKeywords.map((kw) => (
                    <button
                      key={kw.id}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors flex items-start gap-3 ${
                        selectedKeywordId === kw.id ? "bg-violet-50" : ""
                      }`}
                      onClick={() => setSelectedKeywordId(kw.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            selectedKeywordId === kw.id
                              ? "text-violet-700"
                              : "text-zinc-900"
                          }`}
                        >
                          {kw.keyword}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">{kw.projectName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {kw.searchVolume != null && (
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {kw.searchVolume.toLocaleString()}
                          </span>
                        )}
                        {kw.difficulty != null && (
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${
                              kw.difficulty >= 70
                                ? "text-red-600 border-red-200"
                                : kw.difficulty >= 40
                                ? "text-amber-600 border-amber-200"
                                : "text-emerald-600 border-emerald-200"
                            }`}
                          >
                            {kw.difficulty}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedKeyword && (
              <>
                <Separator />
                <div className="bg-zinc-50 rounded-xl p-3 space-y-1.5 text-sm">
                  <p className="font-medium text-zinc-900">{selectedKeyword.keyword}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>Project: {selectedKeyword.projectName}</span>
                    {selectedKeyword.searchVolume != null && (
                      <span>Volume: {selectedKeyword.searchVolume.toLocaleString()}</span>
                    )}
                    {selectedKeyword.difficulty != null && (
                      <span>Difficulty: {selectedKeyword.difficulty}</span>
                    )}
                    {selectedKeyword.intent && (
                      <span>Intent: {selectedKeyword.intent}</span>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!selectedKeywordId || loading} onClick={handleGenerate}>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Generate
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-violet-500" />
              </div>
              <Loader2 className="absolute -right-1 -bottom-1 w-5 h-5 text-violet-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Generating article...</p>
              <p className="text-sm text-zinc-500 mt-1">
                Claude is writing your article. This usually takes 20–60 seconds.
              </p>
            </div>
            {selectedKeyword && (
              <div className="bg-zinc-50 rounded-xl px-4 py-2.5 text-sm text-zinc-600 text-center">
                <span className="font-medium">{selectedKeyword.keyword}</span>
                <span className="text-zinc-400 ml-2">· {selectedKeyword.projectName}</span>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Article generated!</p>
              <p className="text-sm text-zinc-500 mt-1">
                Your article is ready for review and editing.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleViewArticle}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />View Article
              </Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900">Generation failed</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                {errorMessage ?? "An unexpected error occurred."}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRetry}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
