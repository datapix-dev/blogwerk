"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusBadge } from "../status-badge"
import {
  updateArticle,
  updateArticleStatus,
  generateArticleAction,
} from "@/server/actions/articles"
import { adaptArticleAction } from "@/server/actions/adaptation"
import { enhanceArticleAction } from "@/server/actions/editorial"
import { publishArticleAction } from "@/server/actions/publish"
import { getConnectionByProject } from "@/server/actions/connections"
import type { ConnectionWithProject } from "@/server/actions/connections"
import type { ArticleWithRelations } from "@/server/actions/articles"
import type { ArticleStatus } from "@prisma/client"
import useSWR from "swr"
import { generateImageAction, generateImageAltAction, saveImageAltAction } from "@/server/actions/image"
import {
  CheckCheck,
  Eye,
  RotateCcw,
  Save,
  Clock,
  Code2,
  FileText,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Send,
  ImageIcon,
  Wand2,
  ChevronDown,
  MessageSquare,
  Link2,
  Megaphone,
  Sparkles,
  Download,
} from "lucide-react"

type FaqItem = { question: string; answer: string }
type LinkItem = { anchorText: string; suggestedTopic: string }
type CtaItem = { position: string; text: string }

function SuggestionsPanel({ article }: { article: ArticleWithRelations }) {
  const [open, setOpen] = React.useState(false)

  const faqs = (article.faqSuggestions as FaqItem[] | null) ?? []
  const links = (article.internalLinkSuggestions as LinkItem[] | null) ?? []
  const ctas = (article.ctaSuggestions as CtaItem[] | null) ?? []

  if (!faqs.length && !links.length && !ctas.length) return null

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
          SEO Suggestions from Phase 1
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="p-4 space-y-5 bg-white">
          {faqs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <MessageSquare className="w-3.5 h-3.5" /> FAQ Suggestions
              </div>
              <div className="space-y-2">
                {faqs.map((f, i) => (
                  <div key={i} className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5 space-y-1">
                    <p className="text-xs font-semibold text-zinc-800">{f.question}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <Link2 className="w-3.5 h-3.5" /> Internal Link Suggestions
              </div>
              <div className="flex flex-wrap gap-2">
                {links.map((l, i) => (
                  <div key={i} className="rounded-md bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-xs">
                    <span className="font-medium text-blue-800">&ldquo;{l.anchorText}&rdquo;</span>
                    <span className="text-blue-500 mx-1">→</span>
                    <span className="text-blue-600">{l.suggestedTopic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ctas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <Megaphone className="w-3.5 h-3.5" /> CTA Suggestions
              </div>
              <div className="space-y-1.5">
                {ctas.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-mono shrink-0">{c.position}</span>
                    <span className="text-zinc-600">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-zinc-400">
            These suggestions are automatically used in Phase 2 (Adapt for Blog). They are derived from the article content — no invented facts.
          </p>
        </div>
      )}
    </div>
  )
}

type EditorialChange = { blockIndex: number; changeType: string; summary: string }

interface ArticleEditorProps {
  article: ArticleWithRelations
  hasAdaptationTemplate?: boolean
  hasEditorialTemplate?: boolean
}

type ContentView = "preview" | "html" | "markdown"

const ERROR_TYPE_MESSAGES: Record<string, string> = {
  CLAUDE_TIMEOUT: "Claude API timed out",
  CLAUDE_RATE_LIMIT: "Claude rate limit reached",
  INVALID_WP_CREDENTIALS: "Invalid WordPress credentials",
  IMAGE_GENERATION_FAILED: "Image generation failed",
  RATE_LIMIT_REACHED: "Monthly generation limit reached",
  NETWORK_ERROR: "Network error",
  UNKNOWN: "Unknown error",
}

export function ArticleEditor({ article: initialArticle, hasAdaptationTemplate = false, hasEditorialTemplate = false }: ArticleEditorProps) {
  const router = useRouter()

  const [title, setTitle] = React.useState(initialArticle.title ?? "")
  const [slug, setSlug] = React.useState(initialArticle.slug ?? "")
  const [contentHtml, setContentHtml] = React.useState(initialArticle.contentHtml ?? "")
  const [contentMarkdown, setContentMarkdown] = React.useState(
    initialArticle.contentMarkdown ?? ""
  )
  const [metaTitle, setMetaTitle] = React.useState(initialArticle.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = React.useState(
    initialArticle.metaDescription ?? ""
  )
  const [excerpt, setExcerpt] = React.useState(initialArticle.excerpt ?? "")
  const [tags, setTags] = React.useState(initialArticle.tags.join(", "))
  const [status, setStatus] = React.useState<ArticleStatus>(initialArticle.status)
  const [contentView, setContentView] = React.useState<ContentView>("preview")

  const [saving, setSaving] = React.useState(false)
  const [approvingStatus, setApprovingStatus] = React.useState<string | null>(null)
  const [regenerating, setRegenerating] = React.useState(false)
  const [connection, setConnection] = React.useState<ConnectionWithProject | null>(null)
  const [connectionLoading, setConnectionLoading] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const [imageJobPending, setImageJobPending] = React.useState(false)
  const [imageCacheBust, setImageCacheBust] = React.useState(0)
  React.useEffect(() => { setImageCacheBust(Date.now()) }, [])
  const [imageAlt, setImageAlt] = React.useState(initialArticle.imageAlt ?? "")
  const [generatingAlt, setGeneratingAlt] = React.useState(false)
  const [savingAlt, setSavingAlt] = React.useState(false)
  const [adapting, setAdapting] = React.useState(false)
  const [adaptationPending, setAdaptationPending] = React.useState(false)
  const [enhancing, setEnhancing] = React.useState(false)
  const [editorialPending, setEditorialPending] = React.useState(() =>
    initialArticle.generationJobs.some(
      (j) => j.type === "EDITORIAL_ENHANCEMENT" && (j.status === "PENDING" || j.status === "PROCESSING")
    )
  )

  const { data: adaptationStatus } = useSWR(
    adaptationPending ? `/api/articles/${initialArticle.id}/adaptation-status` : null,
    (url: string) => fetch(url).then((r) => r.json()) as Promise<{
      articleStatus: string
      contentHtml: string | null
      contentMarkdown: string | null
      jobStatus: string | null
      errorType: string | null
      errorMsg: string | null
    }>,
    {
      refreshInterval: (data) =>
        data?.jobStatus === "COMPLETED" || data?.jobStatus === "FAILED" ? 0 : 3000,
    }
  )

  const { data: editorialStatus } = useSWR(
    editorialPending ? `/api/articles/${initialArticle.id}/editorial-status` : null,
    (url: string) => fetch(url).then((r) => r.json()) as Promise<{
      articleStatus: string
      contentHtml: string | null
      contentMarkdown: string | null
      jobStatus: string | null
      errorType: string | null
      errorMsg: string | null
      editorialChanges: EditorialChange[] | null
    }>,
    {
      refreshInterval: (data) =>
        data?.jobStatus === "COMPLETED" || data?.jobStatus === "FAILED" ? 0 : 3000,
    }
  )

  React.useEffect(() => {
    if (editorialStatus?.jobStatus === "COMPLETED") {
      setEditorialPending(false)
      if (editorialStatus.contentHtml) setContentHtml(editorialStatus.contentHtml)
      if (editorialStatus.contentMarkdown) setContentMarkdown(editorialStatus.contentMarkdown)
      setStatus("AI_ENHANCED")
      const count = editorialStatus.editorialChanges?.length ?? 0
      toast.success(`Editorial enhancement complete. ${count} improvements applied.`)
      router.refresh()
    } else if (editorialStatus?.jobStatus === "FAILED") {
      setEditorialPending(false)
      toast.error("Editorial enhancement failed. You can retry manually.")
    }
  }, [editorialStatus?.jobStatus, editorialStatus?.contentHtml, editorialStatus?.contentMarkdown, router])

  React.useEffect(() => {
    if (adaptationStatus?.jobStatus === "COMPLETED") {
      setAdaptationPending(false)
      if (adaptationStatus.contentHtml) setContentHtml(adaptationStatus.contentHtml)
      if (adaptationStatus.contentMarkdown) setContentMarkdown(adaptationStatus.contentMarkdown)
      setStatus("ADAPTED")
      toast.success("Article adapted for blog.")
      router.refresh()
    } else if (adaptationStatus?.jobStatus === "FAILED") {
      setAdaptationPending(false)
      toast.error("Blog adaptation failed. Please try again.")
    }
  }, [adaptationStatus?.jobStatus, adaptationStatus?.contentHtml, adaptationStatus?.contentMarkdown, router])

  const { data: imageStatus } = useSWR(
    imageJobPending ? `/api/articles/${initialArticle.id}/image-status` : null,
    (url: string) => fetch(url).then((r) => r.json()) as Promise<{
      featuredImage: string | null
      jobStatus: string | null
      errorType: string | null
      errorMsg: string | null
    }>,
    {
      refreshInterval: (data) =>
        data?.jobStatus === "COMPLETED" || data?.jobStatus === "FAILED" ? 0 : 3000,
    }
  )

  React.useEffect(() => {
    if (imageStatus?.jobStatus === "COMPLETED") {
      setImageJobPending(false)
      setImageCacheBust(Date.now())
      toast.success("Featured image generated.")
    } else if (imageStatus?.jobStatus === "FAILED") {
      setImageJobPending(false)
      toast.error(
        ERROR_TYPE_MESSAGES[imageStatus.errorType ?? ""] ?? "Image generation failed."
      )
    }
  }, [imageStatus?.jobStatus, imageStatus?.errorType])

  const hasImage = !!initialArticle.featuredImage || imageStatus?.featuredImage

  React.useEffect(() => {
    async function loadConnection() {
      setConnectionLoading(true)
      try {
        const conn = await getConnectionByProject(initialArticle.projectId)
        setConnection(conn)
      } catch {
        // not critical
      } finally {
        setConnectionLoading(false)
      }
    }
    loadConnection()
  }, [initialArticle.projectId])

  const isDirty = React.useMemo(
    () =>
      title !== (initialArticle.title ?? "") ||
      slug !== (initialArticle.slug ?? "") ||
      contentHtml !== (initialArticle.contentHtml ?? "") ||
      contentMarkdown !== (initialArticle.contentMarkdown ?? "") ||
      metaTitle !== (initialArticle.metaTitle ?? "") ||
      metaDescription !== (initialArticle.metaDescription ?? "") ||
      excerpt !== (initialArticle.excerpt ?? "") ||
      tags !== initialArticle.tags.join(", "),
    [
      title,
      slug,
      contentHtml,
      contentMarkdown,
      metaTitle,
      metaDescription,
      excerpt,
      tags,
      initialArticle,
    ]
  )

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateArticle(initialArticle.id, {
        title: title || undefined,
        slug: slug || undefined,
        contentHtml,
        contentMarkdown,
        metaTitle,
        metaDescription,
        excerpt,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Article saved.")
      router.refresh()
    } catch {
      toast.error("Failed to save article.")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: ArticleStatus) {
    setApprovingStatus(newStatus)
    try {
      const result = await updateArticleStatus(initialArticle.id, newStatus)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setStatus(newStatus)
      toast.success(
        newStatus === "APPROVED"
          ? "Article approved."
          : newStatus === "NEEDS_REVIEW"
          ? "Marked as needs review."
          : "Status updated."
      )
    } catch {
      toast.error("Failed to update status.")
    } finally {
      setApprovingStatus(null)
    }
  }

  async function handleRegenerate() {
    if (!initialArticle.keywordId) {
      toast.error("No keyword associated with this article.")
      return
    }
    if (
      !confirm(
        "Regenerate this article? The current content will be overwritten by the new generation."
      )
    )
      return
    setRegenerating(true)
    try {
      const result = await generateArticleAction(initialArticle.keywordId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Regeneration started. Redirecting to new article...")
      router.push(`/articles/${result.articleId}`)
    } catch {
      toast.error("Failed to start regeneration.")
    } finally {
      setRegenerating(false)
    }
  }

  async function handleEnhance() {
    setEnhancing(true)
    try {
      const result = await enhanceArticleAction(initialArticle.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setEditorialPending(true)
      toast.success("Editorial enhancement started…")
    } catch {
      toast.error("Failed to start editorial enhancement.")
    } finally {
      setEnhancing(false)
    }
  }

  async function handleAdapt() {
    setAdapting(true)
    try {
      const result = await adaptArticleAction(initialArticle.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setAdaptationPending(true)
      toast.success("Blog adaptation started…")
    } catch {
      toast.error("Failed to start adaptation.")
    } finally {
      setAdapting(false)
    }
  }

  async function handlePublish() {
    if (!connection?.id) return
    setPublishing(true)
    try {
      const result = await publishArticleAction(initialArticle.id, connection.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Publish job queued. Article will be published shortly.")
      router.refresh()
    } catch {
      toast.error("Failed to start publish.")
    } finally {
      setPublishing(false)
    }
  }

  async function handleGenerateImage() {
    setGeneratingImage(true)
    try {
      const result = await generateImageAction(initialArticle.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setImageJobPending(true)
      toast.success("Image generation started.")
    } catch {
      toast.error("Failed to start image generation.")
    } finally {
      setGeneratingImage(false)
    }
  }

  async function handleGenerateAlt() {
    setGeneratingAlt(true)
    try {
      const result = await generateImageAltAction(initialArticle.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setImageAlt(result.alt)
      toast.success("Alt text generated.")
    } catch {
      toast.error("Failed to generate alt text.")
    } finally {
      setGeneratingAlt(false)
    }
  }

  async function handleSaveAlt() {
    setSavingAlt(true)
    try {
      await saveImageAltAction(initialArticle.id, imageAlt)
      toast.success("Alt text saved.")
    } catch {
      toast.error("Failed to save alt text.")
    } finally {
      setSavingAlt(false)
    }
  }

  const canApprove = status === "AI_GENERATED" || status === "AI_ENHANCED" || status === "ADAPTED" || status === "NEEDS_REVIEW"
  const canRequestReview = status === "AI_GENERATED" || status === "AI_ENHANCED" || status === "ADAPTED" || status === "APPROVED"

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 mt-0.5 flex-shrink-0"
            onClick={() => router.back()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Article"
              className="w-full text-xl font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-300 leading-tight"
            />
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={status} />
              {isDirty && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canRequestReview && (
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={approvingStatus !== null}
                    onClick={() => handleStatusChange("NEEDS_REVIEW")}
                  >
                    {approvingStatus === "NEEDS_REVIEW" ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Request Review
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as Needs Review</TooltipContent>
              </Tooltip>
            )}

            {canApprove && (
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-teal-200 text-teal-700 hover:bg-teal-50"
                    disabled={approvingStatus !== null}
                    onClick={() => handleStatusChange("APPROVED")}
                  >
                    {approvingStatus === "APPROVED" ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Approve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve this article</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={regenerating || !initialArticle.keywordId}
                  onClick={handleRegenerate}
                >
                  {regenerating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Regenerate
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {initialArticle.keywordId
                  ? "Generate a new version of this article"
                  : "No keyword linked — cannot regenerate"}
              </TooltipContent>
            </Tooltip>

            {hasEditorialTemplate && contentHtml && (
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-sky-200 text-sky-700 hover:bg-sky-50"
                    disabled={enhancing || editorialPending}
                    onClick={handleEnhance}
                  >
                    {enhancing || editorialPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {editorialPending ? "Enhancing…" : status === "AI_ENHANCED" ? "Re-enhance" : "Enhance"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Apply Editorial Intelligence — expert voice, practical depth, anti-generic
                </TooltipContent>
              </Tooltip>
            )}

            {hasAdaptationTemplate && contentHtml && (
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-violet-200 text-violet-700 hover:bg-violet-50"
                    disabled={adapting || adaptationPending}
                    onClick={handleAdapt}
                  >
                    {adapting || adaptationPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {adaptationPending ? "Adapting…" : "Adapt for Blog"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Restructure and format using the Blog Adaptation template
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              size="sm"
              className="h-8"
              disabled={saving || !isDirty}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="content">
          <TabsList className="h-8">
            <TabsTrigger value="content" className="text-xs h-6 px-3">
              Content
            </TabsTrigger>
            <TabsTrigger value="seo" className="text-xs h-6 px-3">
              SEO
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs h-6 px-3">
              Info
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs h-6 px-3">
              Image
            </TabsTrigger>
            <TabsTrigger value="publish" className="text-xs h-6 px-3">
              Publish
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-4 space-y-3">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
              {(
                [
                  { view: "preview", icon: Eye, label: "Preview" },
                  { view: "html", icon: Code2, label: "HTML Source" },
                  { view: "markdown", icon: FileText, label: "Markdown" },
                ] as const
              ).map(({ view, icon: Icon, label }) => (
                <button
                  key={view}
                  onClick={() => setContentView(view)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    contentView === view
                      ? "bg-white shadow-sm text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {contentView === "preview" && (
              <div className="border border-zinc-200 rounded-xl p-6 bg-white min-h-[400px]">
                {contentHtml ? (
                  <div
                    className="prose prose-zinc prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentHtml }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                    <FileText className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No content yet</p>
                  </div>
                )}
              </div>
            )}

            {contentView === "html" && (
              <Textarea
                value={contentHtml}
                onChange={(e) => setContentHtml(e.target.value)}
                placeholder="<h2>Article content goes here...</h2>"
                className="font-mono text-xs min-h-[400px] resize-y"
                spellCheck={false}
              />
            )}

            {contentView === "markdown" && (
              <Textarea
                value={contentMarkdown}
                onChange={(e) => setContentMarkdown(e.target.value)}
                placeholder="## Article content in Markdown..."
                className="font-mono text-xs min-h-[400px] resize-y"
                spellCheck={false}
              />
            )}

            <SuggestionsPanel article={initialArticle} />
          </TabsContent>

          <TabsContent value="seo" className="mt-4 space-y-4">
            <div className="grid gap-4 max-w-2xl">
              <div className="space-y-1.5">
                <Label htmlFor="seo-slug">URL Slug</Label>
                <Input
                  id="seo-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metatitle">Meta Title</Label>
                  <span
                    className={`text-xs ${
                      metaTitle.length > 60 ? "text-red-500" : "text-zinc-400"
                    }`}
                  >
                    {metaTitle.length}/60
                  </span>
                </div>
                <Input
                  id="seo-metatitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO meta title (max 60 characters)"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metadesc">Meta Description</Label>
                  <span
                    className={`text-xs ${
                      metaDescription.length > 160
                        ? "text-red-500"
                        : metaDescription.length > 140
                        ? "text-amber-500"
                        : "text-zinc-400"
                    }`}
                  >
                    {metaDescription.length}/160
                  </span>
                </div>
                <Textarea
                  id="seo-metadesc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO meta description (140-160 characters recommended)"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-excerpt">Excerpt</Label>
                <Textarea
                  id="seo-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Short article summary for listings..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-tags">Tags</Label>
                <Input
                  id="seo-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="seo, content-marketing, blog (comma-separated)"
                />
                <p className="text-xs text-zinc-400">Separate tags with commas</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-w-lg text-sm">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Project</p>
                <p className="text-zinc-900 font-medium">{initialArticle.project.name}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Keyword</p>
                <p className="text-zinc-900 font-medium">
                  {initialArticle.keyword?.keyword ?? (
                    <span className="text-zinc-400 italic">None</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Author</p>
                <p className="text-zinc-900 font-medium">
                  {initialArticle.author?.name ??
                    initialArticle.author?.email ?? (
                      <span className="text-zinc-400 italic">Unassigned</span>
                    )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Status</p>
                <StatusBadge status={status} />
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Created</p>
                <p className="text-zinc-700">
                  {format(new Date(initialArticle.createdAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Last Updated</p>
                <p className="text-zinc-700">
                  {format(new Date(initialArticle.updatedAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-zinc-900 mb-3">Generation History</h3>
              {initialArticle.generationJobs.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">No generation jobs yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Attempts
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Error
                        </th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {initialArticle.generationJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-zinc-50/50">
                          <td className="px-3 py-2.5 text-xs text-zinc-600">
                            {job.type
                              .replace("_GENERATION", "")
                              .toLowerCase()
                              .replace(/^\w/, (c) => c.toUpperCase())}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-500 tabular-nums">
                            {job.attempts}
                          </td>
                          <td className="px-3 py-2.5 text-xs max-w-[200px]">
                            {job.errorType ? (
                              <div className="flex items-start gap-1 text-red-600">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="truncate">
                                  {ERROR_TYPE_MESSAGES[job.errorType] ?? job.errorType}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-400">
                            {format(new Date(job.createdAt), "dd MMM, HH:mm")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="image" className="mt-4 space-y-4">
            <div className="max-w-lg space-y-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 mb-1">Featured Image</h3>
                <p className="text-xs text-zinc-400">
                  Generate an AI image based on the article title and keyword.
                  The image will be uploaded to your CMS when you publish.
                </p>
              </div>

              {imageJobPending ? (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Generating image…</p>
                    <p className="text-xs text-zinc-400 mt-0.5">This may take up to 3 minutes.</p>
                  </div>
                </div>
              ) : hasImage ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-video relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/articles/${initialArticle.id}/image?t=${imageCacheBust}`}
                      alt={imageAlt || "Featured image"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateImage}
                      disabled={generatingImage}
                    >
                      {generatingImage
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                      Regenerate
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`/api/articles/${initialArticle.id}/image?t=${imageCacheBust}`}
                        download={`featured-image-${initialArticle.id}.webp`}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <Label className="text-xs font-medium text-zinc-700">Alt Text (SEO)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        placeholder="Describe the image for SEO…"
                        className="text-sm flex-1"
                        maxLength={125}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateAlt}
                        disabled={generatingAlt}
                        title="Generate SEO alt text with AI"
                      >
                        {generatingAlt
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Sparkles className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveAlt}
                        disabled={savingAlt}
                      >
                        {savingAlt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-400">{imageAlt.length}/125 characters</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center space-y-3">
                  <ImageIcon className="w-8 h-8 text-zinc-300 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-zinc-600">No featured image yet</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Generate one with AI or add a URL manually.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                  >
                    {generatingImage
                      ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <ImageIcon className="w-3.5 h-3.5 mr-1.5" />}
                    Generate Image
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="publish" className="mt-4 space-y-4">
            <div className="max-w-sm space-y-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 mb-1">Publish to CMS</h3>
                <p className="text-xs text-zinc-400">
                  Send this article to the connected WordPress or custom API for your project.
                </p>
              </div>

              {connectionLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading connection...
                </div>
              ) : connection ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {connection.type === "WORDPRESS" ? "WordPress" : "Custom API"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {connection.project.blogUrl ?? "No URL set"}
                      </p>
                    </div>
                    {connection.isVerified ? (
                      <span className="text-xs text-emerald-600 font-medium">Verified</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">Not verified</span>
                    )}
                  </div>

                  {!connection.isVerified && (
                    <p className="text-xs text-amber-600">
                      This connection is not verified. Go to{" "}
                      <a href="/connections" className="underline">
                        Connections
                      </a>{" "}
                      and test it before publishing.
                    </p>
                  )}

                  {status === "PUBLISHED" && initialArticle.url && (
                    <div className="text-xs text-zinc-500">
                      Published at:{" "}
                      <a
                        href={initialArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {initialArticle.url}
                      </a>
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={publishing || !connection.isVerified}
                    onClick={handlePublish}
                    title={!connection.isVerified ? "Test the connection first to enable publishing" : undefined}
                  >
                    {publishing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {!connection.isVerified
                      ? "Connection not verified"
                      : status === "PUBLISHED" ? "Re-publish" : "Publish Article"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center space-y-2">
                  <p className="text-sm text-zinc-500">
                    No connection configured for this project.
                  </p>
                  <p className="text-xs text-zinc-400">
                    Go to{" "}
                    <a href="/connections" className="text-blue-600 hover:underline">
                      Connections
                    </a>{" "}
                    to add one.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
