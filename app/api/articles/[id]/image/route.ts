import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import fs from "fs/promises"
import { getImagePath } from "@/lib/ai/images"

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
    select: { featuredImage: true },
  })

  if (!article?.featuredImage) {
    return NextResponse.json({ error: "No image" }, { status: 404 })
  }

  const imagePath = getImagePath(id)

  try {
    const buffer = await fs.readFile(imagePath)
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Image file not found" }, { status: 404 })
  }
}
