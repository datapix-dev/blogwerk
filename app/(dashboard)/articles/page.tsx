import { getArticles } from "@/server/actions/articles"
import { getProjects } from "@/server/actions/projects"
import { getKeywords } from "@/server/actions/keywords"
import { getCalendarArticles } from "@/server/actions/calendar"
import { ArticlesTable } from "@/components/features/articles/articles-table"
import { ContentCalendar } from "@/components/features/calendar/content-calendar"
import { ViewToggle } from "@/components/features/articles/view-toggle"

export const metadata = { title: "Articles — BlogPlanner" }

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function ArticlesPage({ searchParams }: Props) {
  const { view } = await searchParams
  const isCalendar = view === "calendar"

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [articles, projects, keywords, calendarArticles] = await Promise.all([
    isCalendar ? Promise.resolve([]) : getArticles(),
    getProjects(),
    isCalendar ? Promise.resolve([]) : getKeywords({ status: "OPEN" }),
    isCalendar ? getCalendarArticles(year, month) : Promise.resolve([]),
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Articles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Generate and manage AI-written articles for your projects.
          </p>
        </div>
        <ViewToggle current={isCalendar ? "calendar" : "list"} />
      </div>

      {isCalendar ? (
        <ContentCalendar
          initialArticles={calendarArticles}
          initialYear={year}
          initialMonth={month}
        />
      ) : (
        <ArticlesTable
          initialData={articles}
          projects={projectOptions}
          keywords={keywordOptions}
        />
      )}
    </div>
  )
}
