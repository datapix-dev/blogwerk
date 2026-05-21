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
import { publishArticleAction } from "@/server/actions/publish"
import { getConnectionByProject } from "@/server/actions/connections"
import type { ConnectionWithProject } from "@/server/actions/connections"
import type { ArticleWithRelations } from "@/server/actions/articles"
import type { ArticleStatus } from "@prisma/client"
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
} from "lucide-react"

interface ArticleEditorProps {
  article: ArticleWithRelations
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

export function ArticleEditor({ article: initialArticle }: ArticleEditorProps) {
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

  const canApprove = status === "AI_GENERATED" || status === "NEEDS_REVIEW"
  const canRequestReview = status === "AI_GENERATED" || status === "APPROVED"

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
                  >
                    {publishing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {status === "PUBLISHED" ? "Re-publish" : "Publish Article"}
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
