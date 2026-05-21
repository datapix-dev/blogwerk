import { notFound } from "next/navigation"
import { getArticleById } from "@/server/actions/articles"
import { getAdaptationTemplateStatus } from "@/server/actions/adaptation"
import { ArticleEditor } from "@/components/features/articles/article-editor"

export const metadata = { title: "Article — BlogPlanner" }

interface ArticlePageProps {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params
  const article = await getArticleById(id)
  if (!article) notFound()

  const { hasTemplate } = await getAdaptationTemplateStatus(article.projectId)

  return (
    <div className="space-y-5">
      <ArticleEditor article={article} hasAdaptationTemplate={hasTemplate} />
    </div>
  )
}
