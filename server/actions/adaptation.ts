"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { adaptationQueue } from "@/worker/queues/index"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function adaptArticleAction(
  articleId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: {
      id: true,
      contentMarkdown: true,
      status: true,
      projectId: true,
    },
  })

  if (!article) return { success: false, error: "Article not found." }
  if (!article.contentMarkdown) return { success: false, error: "Article has no content to adapt." }

  const template = await db.promptTemplate.findFirst({
    where: { projectId: article.projectId, type: "FORMATTING", isActive: true },
    select: { id: true },
  })
  if (!template) return { success: false, error: "No active Blog Adaptation template for this project." }

  try {
    await db.generationJob.updateMany({
      where: { articleId, status: { in: ["PENDING", "PROCESSING"] }, type: "ADAPTATION" },
      data: { status: "FAILED" },
    })

    const job = await db.generationJob.create({
      data: {
        articleId,
        type: "ADAPTATION",
        status: "PENDING",
        payload: { projectId: article.projectId },
      },
      select: { id: true },
    })

    await adaptationQueue.add(
      "adapt",
      { articleId, projectId: article.projectId },
      { jobId: job.id }
    )

    return { success: true }
  } catch (err) {
    console.error("[adaptArticleAction]", err)
    return { success: false, error: "Failed to start adaptation." }
  }
}

export async function getAdaptationTemplateStatus(
  projectId: string
): Promise<{ hasTemplate: boolean }> {
  const session = await requireSession()
  const template = await db.promptTemplate.findFirst({
    where: {
      projectId,
      type: "FORMATTING",
      isActive: true,
      project: { workspaceId: session.user.workspaceId },
    },
    select: { id: true },
  })
  return { hasTemplate: !!template }
}
