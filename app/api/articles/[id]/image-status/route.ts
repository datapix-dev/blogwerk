import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const article = await db.article.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: {
      featuredImage: true,
      generationJobs: {
        where: { type: "IMAGE_GENERATION" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          errorType: true,
          errorMsg: true,
          attempts: true,
        },
      },
    },
  })

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const latestJob = article.generationJobs[0] ?? null

  return NextResponse.json({
    featuredImage: article.featuredImage,
    jobStatus: latestJob?.status ?? null,
    errorType: latestJob?.errorType ?? null,
    errorMsg: latestJob?.errorMsg ?? null,
  })
}
