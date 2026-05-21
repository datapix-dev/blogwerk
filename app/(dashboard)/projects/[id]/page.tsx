import { notFound } from "next/navigation"
import Link from "next/link"
import { getProjectById } from "@/server/actions/projects"
import { StatusBadge } from "@/components/features/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tags, FileText, Globe, ArrowLeft, ExternalLink } from "lucide-react"
import { format } from "date-fns"

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  const publishModeLabels: Record<string, string> = {
    DRAFT: "Draft", SCHEDULED: "Scheduled", PUBLISH: "Publish immediately",
  }
  const languageLabels: Record<string, string> = {
    de: "Deutsch", en: "English", fr: "Français", es: "Español",
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mb-1">
            <ArrowLeft className="w-3 h-3" />All Projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.clientName && <p className="text-sm text-zinc-500">Client: {project.clientName}</p>}
        </div>
        {project.blogUrl && (
          <a href={project.blogUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white hover:border-zinc-300 transition-colors">
            <ExternalLink className="w-3 h-3" />Visit Blog
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1"><Tags className="w-3.5 h-3.5" /><span className="text-xs">Keywords</span></div>
            <p className="text-2xl font-semibold text-zinc-900 tabular-nums">{project._count.keywords}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1"><FileText className="w-3.5 h-3.5" /><span className="text-xs">Articles</span></div>
            <p className="text-2xl font-semibold text-zinc-900 tabular-nums">{project._count.articles}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1"><Globe className="w-3.5 h-3.5" /><span className="text-xs">Language</span></div>
            <p className="text-sm font-medium text-zinc-900">{languageLabels[project.language] ?? project.language}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1"><FileText className="w-3.5 h-3.5" /><span className="text-xs">Publish Mode</span></div>
            <p className="text-sm font-medium text-zinc-900">{publishModeLabels[project.defaultPublishMode] ?? project.defaultPublishMode}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-zinc-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-700">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {project.targetAudience && (
              <div className="col-span-2"><p className="text-xs text-zinc-400 mb-0.5">Target Audience</p><p className="text-zinc-700">{project.targetAudience}</p></div>
            )}
            {project.toneOfVoice && (
              <div className="col-span-2"><p className="text-xs text-zinc-400 mb-0.5">Tone of Voice</p><p className="text-zinc-700">{project.toneOfVoice}</p></div>
            )}
            <div><p className="text-xs text-zinc-400 mb-0.5">Created</p><p className="text-zinc-700">{format(new Date(project.createdAt), "dd MMM yyyy")}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href={`/keywords?projectId=${project.id}`}
          className="inline-flex items-center gap-2 h-8 px-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground transition-colors">
          <Tags className="w-3.5 h-3.5" />Go to Keywords ({project._count.keywords})
        </Link>
        <Link href={`/articles?projectId=${project.id}`}
          className="inline-flex items-center gap-2 h-8 px-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground transition-colors">
          <FileText className="w-3.5 h-3.5" />Go to Articles ({project._count.articles})
        </Link>
      </div>
    </div>
  )
}
