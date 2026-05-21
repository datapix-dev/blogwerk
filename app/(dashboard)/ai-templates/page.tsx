import { getTemplates } from "@/server/actions/templates"
import { getProjects } from "@/server/actions/projects"
import { TemplatesPage } from "@/components/features/templates/templates-page"

export const metadata = { title: "AI Templates — BlogPlanner" }

interface Props {
  searchParams: Promise<{ projectId?: string }>
}

export default async function AITemplatesPage({ searchParams }: Props) {
  const { projectId } = await searchParams

  const projects = await getProjects()
  const activeProjectId = projectId ?? projects[0]?.id ?? ""
  const templates = activeProjectId ? await getTemplates(activeProjectId) : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">AI Templates</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage prompt templates for AI article and image generation.
        </p>
      </div>
      <TemplatesPage
        projects={projects}
        initialProjectId={activeProjectId}
        initialTemplates={templates}
      />
    </div>
  )
}
