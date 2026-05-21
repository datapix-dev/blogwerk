"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { ProjectStatus, PublishMode } from "@prisma/client"

export type ProjectWithCounts = {
  id: string
  workspaceId: string
  name: string
  clientName: string | null
  blogUrl: string | null
  language: string
  targetAudience: string | null
  toneOfVoice: string | null
  defaultPublishMode: PublishMode
  status: ProjectStatus
  createdAt: Date
  _count: {
    keywords: number
    articles: number
  }
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function getProjects(): Promise<ProjectWithCounts[]> {
  const session = await requireSession()
  return db.project.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { keywords: true, articles: true } },
    },
  })
}

export async function getProjectById(id: string): Promise<ProjectWithCounts | null> {
  const session = await requireSession()
  return db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    include: {
      _count: { select: { keywords: true, articles: true } },
    },
  })
}

export type CreateProjectInput = {
  name: string
  clientName?: string
  blogUrl?: string
  language?: string
  targetAudience?: string
  toneOfVoice?: string
  defaultPublishMode?: PublishMode
}

export async function createProject(
  data: CreateProjectInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()
  if (!data.name?.trim()) return { success: false, error: "Project name is required." }
  try {
    const project = await db.project.create({
      data: {
        workspaceId: session.user.workspaceId,
        name: data.name.trim(),
        clientName: data.clientName?.trim() || null,
        blogUrl: data.blogUrl?.trim() || null,
        language: data.language ?? "de",
        targetAudience: data.targetAudience?.trim() || null,
        toneOfVoice: data.toneOfVoice?.trim() || null,
        defaultPublishMode: data.defaultPublishMode ?? "DRAFT",
      },
    })
    revalidatePath("/projects")
    return { success: true, id: project.id }
  } catch (err) {
    console.error("[createProject]", err)
    return { success: false, error: "Failed to create project." }
  }
}

export type UpdateProjectInput = Partial<CreateProjectInput> & { status?: ProjectStatus }

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "Project not found." }
  try {
    await db.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.clientName !== undefined && { clientName: data.clientName?.trim() || null }),
        ...(data.blogUrl !== undefined && { blogUrl: data.blogUrl?.trim() || null }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.targetAudience !== undefined && { targetAudience: data.targetAudience?.trim() || null }),
        ...(data.toneOfVoice !== undefined && { toneOfVoice: data.toneOfVoice?.trim() || null }),
        ...(data.defaultPublishMode !== undefined && { defaultPublishMode: data.defaultPublishMode }),
        ...(data.status !== undefined && { status: data.status }),
      },
    })
    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    return { success: true }
  } catch (err) {
    console.error("[updateProject]", err)
    return { success: false, error: "Failed to update project." }
  }
}

export async function deleteProject(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.project.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "Project not found." }
  try {
    await db.project.delete({ where: { id } })
    revalidatePath("/projects")
    return { success: true }
  } catch (err) {
    console.error("[deleteProject]", err)
    return { success: false, error: "Failed to delete project." }
  }
}
