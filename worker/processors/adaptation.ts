import type { Job } from "bullmq"
import { db } from "../../lib/db"
import { adaptArticle, type FaqSuggestion, type InternalLinkSuggestion, type CtaSuggestion } from "../../lib/ai/claude"
import { resolveWorkspaceApiKey } from "../../lib/api-vault"

interface AdaptationJobData {
  articleId: string
  projectId: string
}

export async function processAdaptationJob(job: Job<AdaptationJobData>): Promise<void> {
  const { articleId, projectId } = job.data

  const genJob = await db.generationJob.findFirst({
    where: { articleId, status: "PENDING", type: "ADAPTATION" },
  })
  if (!genJob) {
    console.warn(`[adaptation-processor] No PENDING ADAPTATION job for article ${articleId}`)
    return
  }

  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  const [article, adaptationTemplate] = await Promise.all([
    db.article.findUnique({
      where: { id: articleId },
      select: {
        contentMarkdown: true,
        faqSuggestions: true,
        internalLinkSuggestions: true,
        ctaSuggestions: true,
        project: {
          select: {
            workspaceId: true,
            language: true,
          },
        },
        keyword: { select: { keyword: true } },
      },
    }),
    db.promptTemplate.findFirst({
      where: { projectId, type: "FORMATTING", isActive: true },
      select: { content: true },
    }),
  ])

  if (!article) throw new Error(`Article not found: ${articleId}`)
  if (!article.contentMarkdown) throw new Error(`Article ${articleId} has no content to adapt`)
  if (!adaptationTemplate) throw new Error(`No active FORMATTING template for project ${projectId}`)

  const anthropicKey = await resolveWorkspaceApiKey(
    article.project.workspaceId,
    "anthropicKey",
    process.env.ANTHROPIC_API_KEY
  )

  let adapted
  try {
    adapted = await adaptArticle({
      contentMarkdown: article.contentMarkdown,
      adaptationTemplate: adaptationTemplate.content,
      keyword: article.keyword?.keyword ?? "",
      language: article.project.language,
      faqSuggestions: article.faqSuggestions as unknown as FaqSuggestion[] | undefined,
      internalLinkSuggestions: article.internalLinkSuggestions as unknown as InternalLinkSuggestion[] | undefined,
      ctaSuggestions: article.ctaSuggestions as unknown as CtaSuggestion[] | undefined,
      apiKey: anthropicKey,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"
    await db.generationJob.update({
      where: { id: genJob.id },
      data: { status: "FAILED", errorType: "UNKNOWN", errorMsg },
    })
    throw err
  }

  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: {
        contentHtml: adapted.contentHtml,
        contentMarkdown: adapted.contentMarkdown,
        status: "ADAPTED",
      },
    }),
    db.generationJob.update({
      where: { id: genJob.id },
      data: { status: "COMPLETED" },
    }),
  ])

  console.log(`[adaptation-processor] Article ${articleId} adapted successfully`)
}
