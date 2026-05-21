"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { editorialQueue } from "@/worker/queues/index"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function enhanceArticleAction(
  articleId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: { id: articleId, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, blocks: true, status: true, projectId: true },
  })

  if (!article) return { success: false, error: "Article not found." }
  if (!article.blocks) return { success: false, error: "Article has no content blocks to enhance." }

  const template = await db.promptTemplate.findFirst({
    where: { projectId: article.projectId, type: "EDITORIAL", isActive: true },
    select: { id: true },
  })
  if (!template) return { success: false, error: "No active Editorial Brain template for this project." }

  try {
    await db.generationJob.updateMany({
      where: { articleId, status: { in: ["PENDING", "PROCESSING"] }, type: "EDITORIAL_ENHANCEMENT" },
      data: { status: "FAILED" },
    })

    const job = await db.generationJob.create({
      data: {
        articleId,
        type: "EDITORIAL_ENHANCEMENT",
        status: "PENDING",
        payload: { projectId: article.projectId },
      },
      select: { id: true },
    })

    await editorialQueue.add(
      "enhance",
      { articleId, projectId: article.projectId },
      { jobId: job.id, attempts: 2, backoff: { type: "exponential", delay: 5000 } }
    )

    revalidatePath("/articles")
    revalidatePath(`/articles/${articleId}`)
    return { success: true }
  } catch (err) {
    console.error("[enhanceArticleAction]", err)
    return { success: false, error: "Failed to start editorial enhancement." }
  }
}

export async function getEditorialTemplateStatus(
  projectId: string
): Promise<{ hasTemplate: boolean }> {
  const session = await requireSession()
  const template = await db.promptTemplate.findFirst({
    where: {
      projectId,
      type: "EDITORIAL",
      isActive: true,
      project: { workspaceId: session.user.workspaceId },
    },
    select: { id: true },
  })
  return { hasTemplate: !!template }
}
