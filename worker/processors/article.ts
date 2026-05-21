import type { Job } from "bullmq"
import { db } from "../../lib/db"
import { generateArticle } from "../../lib/ai/claude"
import { resolveWorkspaceApiKey } from "../../lib/api-vault"
import type { JobErrorType } from "@prisma/client"

interface ArticleJobData {
  articleId: string
  keywordId: string
  projectId: string
}

function classifyError(err: unknown): JobErrorType {
  const message = err instanceof Error ? err.message.toLowerCase() : ""
  if (message.includes("timeout") || message.includes("timed out")) {
    return "CLAUDE_TIMEOUT"
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return "CLAUDE_RATE_LIMIT"
  }
  return "UNKNOWN"
}

export async function processArticleJob(job: Job<ArticleJobData>): Promise<void> {
  const { articleId, keywordId, projectId } = job.data

  // Find and mark the GenerationJob as PROCESSING
  const genJob = await db.generationJob.findFirst({
    where: { articleId, status: "PENDING", type: "ARTICLE_GENERATION" },
  })

  if (!genJob) {
    console.warn(`[article-processor] No PENDING job found for article ${articleId}`)
    return
  }

  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  // Fetch context
  const [article, keyword, project, templates] = await Promise.all([
    db.article.findUnique({ where: { id: articleId } }),
    db.keyword.findUnique({ where: { id: keywordId } }),
    db.project.findUnique({ where: { id: projectId } }),
    db.promptTemplate.findMany({
      where: { projectId, isActive: true, type: "ARTICLE" },
      orderBy: { version: "desc" },
      take: 1,
    }),
  ])

  if (!article || !keyword || !project) {
    throw new Error(`Missing DB records for articleId=${articleId}`)
  }

  const customTemplate = templates[0]?.content ?? null

  const anthropicKey = await resolveWorkspaceApiKey(
    project.workspaceId,
    "anthropicKey",
    process.env.ANTHROPIC_API_KEY
  )

  let generated
  try {
    generated = await generateArticle({
      keyword: keyword.keyword,
      projectName: project.name,
      language: project.language,
      targetAudience: project.targetAudience,
      toneOfVoice: project.toneOfVoice,
      searchVolume: keyword.searchVolume,
      difficulty: keyword.difficulty,
      intent: keyword.intent,
      cluster: keyword.cluster,
      customPromptTemplate: customTemplate,
      apiKey: anthropicKey,
    })
  } catch (err) {
    const errorType = classifyError(err)
    const errorMsg = err instanceof Error ? err.message : "Unknown error"

    await db.$transaction([
      db.generationJob.update({
        where: { id: genJob.id },
        data: { status: "FAILED", errorType, errorMsg },
      }),
      db.article.update({
        where: { id: articleId },
        data: { status: "FAILED" },
      }),
    ])

    throw err // BullMQ will handle retries
  }

  // Persist generated content + update usage in a transaction
  const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const workspaceId = project.workspaceId

  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: {
        title: generated.title,
        slug: generated.slug,
        contentHtml: generated.contentHtml,
        contentMarkdown: generated.contentMarkdown,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        excerpt: generated.excerpt,
        tags: generated.tags,
        status: "AI_GENERATED",
      faqSuggestions: generated.faqSuggestions.length ? (generated.faqSuggestions as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      internalLinkSuggestions: generated.internalLinkSuggestions.length ? (generated.internalLinkSuggestions as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      ctaSuggestions: generated.ctaSuggestions.length ? (generated.ctaSuggestions as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      },
    }),
    db.generationJob.update({
      where: { id: genJob.id },
      data: {
        status: "COMPLETED",
        result: {
          title: generated.title,
          slug: generated.slug,
        },
      },
    }),
    db.workspaceUsage.upsert({
      where: { workspaceId_month: { workspaceId, month: currentMonth } },
      create: { workspaceId, month: currentMonth, articleCount: 1 },
      update: { articleCount: { increment: 1 } },
    }),
    db.keyword.update({
      where: { id: keywordId },
      data: { status: "GENERATED" },
    }),
  ])

  console.log(`[article-processor] Article ${articleId} generated: "${generated.title}"`)
}
