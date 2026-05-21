import { notFound } from "next/navigation"
import { getArticleById } from "@/server/actions/articles"
import { ArticleEditor } from "@/components/features/articles/article-editor"

export const metadata = { title: "Article — BlogPlanner" }

interface ArticlePageProps {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params
  const article = await getArticleById(id)
  if (!article) notFound()

  return (
    <div className="space-y-5">
      <ArticleEditor article={article} />
    </div>
  )
}
