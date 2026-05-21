import { getKeywords } from "@/server/actions/keywords"
import { getProjects } from "@/server/actions/projects"
import { KeywordsTable } from "@/components/features/keywords/keywords-table"

export const metadata = { title: "Keywords — BlogPlanner" }

interface KeywordsPageProps {
  searchParams: Promise<{ projectId?: string }>
}

export default async function KeywordsPage({ searchParams }: KeywordsPageProps) {
  const { projectId } = await searchParams
  const [keywords, projects] = await Promise.all([
    getKeywords(projectId ? { projectId } : undefined),
    getProjects(),
  ])
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Keywords</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage keywords across all projects. Import from CSV or XLSX.</p>
      </div>
      <KeywordsTable initialData={keywords} projects={projectOptions} defaultProjectId={projectId} />
    </div>
  )
}
