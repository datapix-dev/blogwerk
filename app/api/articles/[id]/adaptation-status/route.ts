import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const article = await db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: {
      status: true,
      contentHtml: true,
      contentMarkdown: true,
      generationJobs: {
        where: { type: "ADAPTATION" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, errorType: true, errorMsg: true },
      },
    },
  })

  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const latestJob = article.generationJobs[0] ?? null

  return NextResponse.json({
    articleStatus: article.status,
    contentHtml: latestJob?.status === "COMPLETED" ? article.contentHtml : null,
    contentMarkdown: latestJob?.status === "COMPLETED" ? article.contentMarkdown : null,
    jobStatus: latestJob?.status ?? null,
    errorType: latestJob?.errorType ?? null,
    errorMsg: latestJob?.errorMsg ?? null,
  })
}
