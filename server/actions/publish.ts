"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { publishQueue } from "@/worker/queues/index"
import { revalidatePath } from "next/cache"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function publishArticleAction(
  articleId: string,
  connectionId: string,
  publishLive = false
): Promise<{ success: true; jobId: string } | { success: false; error: string }> {
  const session = await requireSession()

  const article = await db.article.findFirst({
    where: {
      id: articleId,
      project: { workspaceId: session.user.workspaceId },
    },
    select: { id: true, status: true, projectId: true },
  })
  if (!article) return { success: false, error: "Article not found." }

  const connection = await db.apiConnection.findFirst({
    where: {
      id: connectionId,
      workspaceId: session.user.workspaceId,
    },
    select: { id: true, isVerified: true },
  })
  if (!connection) return { success: false, error: "Connection not found." }
  if (!connection.isVerified) {
    return {
      success: false,
      error: "Connection is not verified. Please test the connection first.",
    }
  }

  try {
    const job = await db.generationJob.create({
      data: {
        articleId,
        type: "PUBLISH",
        status: "PENDING",
        payload: { articleId, connectionId, publishLive },
      },
      select: { id: true },
    })

    await publishQueue.add(
      "publish",
      { articleId, connectionId, publishLive },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      }
    )

    revalidatePath("/articles")
    revalidatePath(`/articles/${articleId}`)
    return { success: true, jobId: job.id }
  } catch (err) {
    console.error("[publishArticleAction]", err)
    return { success: false, error: "Failed to start publish job." }
  }
}
