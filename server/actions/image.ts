"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

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
