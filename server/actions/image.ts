"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"
import Anthropic from "@anthropic-ai/sdk"
import { resolveWorkspaceApiKey } from "@/lib/api-vault"

const imageQueue = new Queue("image-generation", { connection: redis })

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function generateImageAction(
  articleId: string
): Promise<{ success: true; jobId: string } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, projectId: true },
  })
  if (!article) return { success: false, error: "Article not found." }

  // Cancel any existing pending image job
  await db.generationJob.updateMany({
    where: { articleId, type: "IMAGE_GENERATION", status: "PENDING" },
    data: { status: "FAILED", errorMsg: "Superseded by new image generation request" },
  })

  const job = await db.generationJob.create({
    data: {
      articleId,
      type: "IMAGE_GENERATION",
      status: "PENDING",
    },
  })

  await imageQueue.add(
    "generate-image",
    { articleId },
    {
      jobId: `image-${articleId}-${job.id}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    }
  )

  return { success: true, jobId: job.id }
}

export async function generateImageAltAction(
  articleId: string
): Promise<{ success: true; alt: string } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: {
      title: true,
      metaDescription: true,
      excerpt: true,
      keyword: { select: { keyword: true } },
      project: { select: { workspaceId: true, name: true, targetAudience: true } },
    },
  })
  if (!article) return { success: false, error: "Article not found." }

  const anthropicKey = await resolveWorkspaceApiKey(
    article.project.workspaceId,
    "anthropicKey",
    process.env.ANTHROPIC_API_KEY
  )
  if (!anthropicKey) return { success: false, error: "No Anthropic API key configured." }

  const client = new Anthropic({ apiKey: anthropicKey })

  const context = [
    article.title && `Title: ${article.title}`,
    article.keyword?.keyword && `Focus keyword: ${article.keyword.keyword}`,
    article.metaDescription && `Meta description: ${article.metaDescription}`,
    article.excerpt && `Excerpt: ${article.excerpt}`,
    article.project.targetAudience && `Target audience: ${article.project.targetAudience}`,
  ]
    .filter(Boolean)
    .join("\n")

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Write an SEO-optimized alt text for the featured image of this blog article. The alt text should:\n- Be concise (max 125 characters)\n- Include the focus keyword naturally\n- Describe what the image likely shows (professional blog header image)\n- Be in the same language as the article title\n\nArticle info:\n${context}\n\nRespond with ONLY the alt text, no quotes, no explanation.`,
      },
    ],
  })

  const alt = msg.content[0].type === "text" ? msg.content[0].text.trim() : ""
  if (!alt) return { success: false, error: "Failed to generate alt text." }

  await db.article.update({
    where: { id: articleId },
    data: { imageAlt: alt },
  })

  return { success: true, alt }
}

export async function saveImageAltAction(
  articleId: string,
  alt: string
): Promise<{ success: boolean }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  if (!article) return { success: false }

  await db.article.update({
    where: { id: articleId },
    data: { imageAlt: alt.trim() || null },
  })

  return { success: true }
}
