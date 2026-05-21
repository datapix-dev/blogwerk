import { getArticles } from "@/server/actions/articles"
import { getProjects } from "@/server/actions/projects"
import { getKeywords } from "@/server/actions/keywords"
import { ArticlesTable } from "@/components/features/articles/articles-table"

export const metadata = { title: "Articles — BlogPlanner" }

export default async function ArticlesPage() {
  const [articles, projects, keywords] = await Promise.all([
    getArticles(),
    getProjects(),
    getKeywords({ status: "OPEN" }),
  ])

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))
  const keywordOptions = keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    projectId: k.projectId,
    projectName: k.project.name,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty,
    intent: k.intent,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Articles</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Generate and manage AI-written articles for your projects.
        </p>
      </div>
      <ArticlesTable
        initialData={articles}
        projects={projectOptions}
        keywords={keywordOptions}
      />
    </div>
  )
}
