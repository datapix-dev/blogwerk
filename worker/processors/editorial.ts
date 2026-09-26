import type { Job } from "bullmq"
import { db } from "../../lib/db"
import { enhanceArticle, type ContentBlock, blocksToMarkdown, blocksToHtml } from "../../lib/ai/claude"
import { DEFAULT_EDITORIAL_BRAIN } from "../../lib/ai/prompts"
import { resolveWorkspaceApiKey } from "../../lib/api-vault"
import type { Prisma } from "@prisma/client"

interface EditorialJobData {
  articleId: string
  projectId: string
}

export async function processEditorialJob(job: Job<EditorialJobData>): Promise<void> {
  const { articleId, projectId } = job.data

  const genJob = await db.generationJob.findFirst({
    where: { articleId, status: "PENDING", type: "EDITORIAL_ENHANCEMENT" },
  })
  if (!genJob) {
    console.warn(`[editorial-processor] No PENDING EDITORIAL_ENHANCEMENT job for article ${articleId}`)
    return
  }

  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  const [article, editorialTemplate] = await Promise.all([
    db.article.findUnique({
      where: { id: articleId },
      select: {
        blocks: true,
        project: {
          select: {
            workspaceId: true,
            language: true,
            targetAudience: true,
            toneOfVoice: true,
          },
        },
        keyword: { select: { keyword: true, intent: true } },
      },
    }),
    db.promptTemplate.findFirst({
      where: { projectId, type: "EDITORIAL", isActive: true },
      // Without an explicit order, two active versions make the winner depend
      // on whatever Postgres returns first. ARTICLE already ordered by version;
      // the other types did not.
      orderBy: { version: "desc" },
      select: { content: true },
    }),
  ])

  if (!article) throw new Error(`Article not found: ${articleId}`)
  if (!article.blocks) throw new Error(`Article ${articleId} has no blocks for editorial enhancement`)

  // The de-slop pass runs for every article now. A project template refines
  // this stage; its absence no longer skips it.
  const editorialBrain = editorialTemplate?.content ?? DEFAULT_EDITORIAL_BRAIN
  if (!editorialTemplate) {
    console.log(`[editorial-processor] No EDITORIAL template for project ${projectId} — using default brain`)
  }

  const anthropicKey = await resolveWorkspaceApiKey(
    article.project.workspaceId,
    "anthropicKey",
    process.env.ANTHROPIC_API_KEY
  )

  let enhanced
  try {
    enhanced = await enhanceArticle({
      blocks: article.blocks as unknown as ContentBlock[],
      keyword: article.keyword?.keyword ?? "",
      language: article.project.language,
      intent: article.keyword?.intent ?? null,
      targetAudience: article.project.targetAudience ?? null,
      toneOfVoice: article.project.toneOfVoice ?? null,
      editorialBrain,
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

  const enhancedBlocks = enhanced.blocks as unknown as Prisma.InputJsonValue

  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: {
        blocks: enhancedBlocks,
        contentMarkdown: blocksToMarkdown(enhanced.blocks, article.project.language),
        contentHtml: blocksToHtml(enhanced.blocks, article.project.language),
        status: "AI_ENHANCED",
      },
    }),
    db.generationJob.update({
      where: { id: genJob.id },
      data: {
        status: "COMPLETED",
        result: { editorialChanges: enhanced.editorialChanges } as unknown as Prisma.InputJsonValue,
      },
    }),
  ])

  console.log(`[editorial-processor] Article ${articleId} enhanced: ${enhanced.editorialChanges.length} changes`)
}
