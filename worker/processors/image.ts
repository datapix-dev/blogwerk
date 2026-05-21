import type { Job } from "bullmq"
import { db } from "../../lib/db"
import { generateAndSaveImage } from "../../lib/ai/images"
import type { JobErrorType } from "@prisma/client"

interface ImageJobData {
  articleId: string
}

function classifyImageError(err: unknown): JobErrorType {
  const msg = err instanceof Error ? err.message.toLowerCase() : ""
  if (msg.includes("rate limit") || msg.includes("429")) return "RATE_LIMIT_REACHED"
  if (msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("fetch failed")) {
    return "NETWORK_ERROR"
  }
  return "IMAGE_GENERATION_FAILED"
}

function buildImagePrompt(
  title: string | null,
  keyword: string | null,
  projectDescription: string | null,
  templateContent: string | null
): string {
  if (templateContent?.trim()) {
    return templateContent
      .replace(/\{title\}/gi, title ?? "")
      .replace(/\{keyword\}/gi, keyword ?? "")
      .replace(/\{description\}/gi, projectDescription ?? "")
  }

  const parts: string[] = []
  if (title) parts.push(`Blog article titled: "${title}"`)
  if (keyword) parts.push(`main topic: ${keyword}`)
  if (projectDescription) parts.push(`context: ${projectDescription}`)

  const base = parts.length > 0 ? parts.join(", ") : "professional blog article"
  return `Create a high-quality featured image for a ${base}. Professional photography style, clean composition, suitable for a blog header. Wide format 16:9.`
}

export async function processImageJob(job: Job<ImageJobData>): Promise<void> {
  const { articleId } = job.data

  const genJob = await db.generationJob.findFirst({
    where: { articleId, status: "PENDING", type: "IMAGE_GENERATION" },
  })
  if (!genJob) {
    console.warn(`[image-processor] No PENDING IMAGE_GENERATION job for article ${articleId}`)
    return
  }

  await db.generationJob.update({
    where: { id: genJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  })

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: {
        select: {
          name: true,
          targetAudience: true,
          toneOfVoice: true,
          workspaceId: true,
          promptTemplates: {
            where: { type: "IMAGE", isActive: true },
            select: { content: true },
            take: 1,
          },
        },
      },
      keyword: { select: { keyword: true } },
    },
  })

  if (!article) throw new Error(`Article not found: ${articleId}`)

  const imageTemplate = article.project.promptTemplates[0]?.content ?? null

  const projectContext = [
    article.project.targetAudience && `audience: ${article.project.targetAudience}`,
    article.project.toneOfVoice && `tone: ${article.project.toneOfVoice}`,
  ]
    .filter(Boolean)
    .join(", ")

  const prompt = buildImagePrompt(
    article.title,
    article.keyword?.keyword ?? null,
    projectContext || null,
    imageTemplate
  )

  let imagePath: string
  try {
    imagePath = await generateAndSaveImage(prompt, articleId)
  } catch (err) {
    const errorType = classifyImageError(err)
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
    throw err
  }

  const currentMonth = new Date().toISOString().slice(0, 7)

  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: { featuredImage: imagePath },
    }),
    db.generationJob.update({
      where: { id: genJob.id },
      data: { status: "COMPLETED", result: { imagePath } },
    }),
    db.workspaceUsage.upsert({
      where: {
        workspaceId_month: {
          workspaceId: article.project.workspaceId,
          month: currentMonth,
        },
      },
      create: {
        workspaceId: article.project.workspaceId,
        month: currentMonth,
        imageCount: 1,
      },
      update: { imageCount: { increment: 1 } },
    }),
  ])

  console.log(`[image-processor] Image generated for article ${articleId} → ${imagePath}`)
}
