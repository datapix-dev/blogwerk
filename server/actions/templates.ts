"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { TemplateType } from "@prisma/client"

export type PromptTemplateRow = {
  id: string
  projectId: string
  type: TemplateType
  name: string
  content: string
  version: number
  isActive: boolean
  createdAt: Date
  project: { id: string; name: string }
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function getTemplates(projectId: string): Promise<PromptTemplateRow[]> {
  const session = await requireSession()
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) return []

  return db.promptTemplate.findMany({
    where: { projectId },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    include: { project: { select: { id: true, name: true } } },
  }) as Promise<PromptTemplateRow[]>
}

export type CreateTemplateInput = {
  projectId: string
  type: TemplateType
  name: string
  content: string
}

export async function createTemplate(
  data: CreateTemplateInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()
  if (!data.name?.trim()) return { success: false, error: "Template name is required." }
  if (!data.content?.trim()) return { success: false, error: "Template content is required." }

  const project = await db.project.findFirst({
    where: { id: data.projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) return { success: false, error: "Project not found." }

  try {
    const template = await db.promptTemplate.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        name: data.name.trim(),
        content: data.content.trim(),
        version: 1,
        isActive: false,
      },
    })
    revalidatePath("/ai-templates")
    return { success: true, id: template.id }
  } catch (err) {
    console.error("[createTemplate]", err)
    return { success: false, error: "Failed to create template." }
  }
}

export type UpdateTemplateInput = {
  name?: string
  content?: string
}

export async function updateTemplate(
  id: string,
  data: UpdateTemplateInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.promptTemplate.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, version: true },
  })
  if (!existing) return { success: false, error: "Template not found." }

  try {
    await db.promptTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.content !== undefined && {
          content: data.content.trim(),
          version: existing.version + 1,
        }),
      },
    })
    revalidatePath("/ai-templates")
    return { success: true }
  } catch (err) {
    console.error("[updateTemplate]", err)
    return { success: false, error: "Failed to update template." }
  }
}

export async function deleteTemplate(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.promptTemplate.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "Template not found." }

  try {
    await db.promptTemplate.delete({ where: { id } })
    revalidatePath("/ai-templates")
    return { success: true }
  } catch (err) {
    console.error("[deleteTemplate]", err)
    return { success: false, error: "Failed to delete template." }
  }
}

export async function setActiveTemplate(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.promptTemplate.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, projectId: true, type: true },
  })
  if (!existing) return { success: false, error: "Template not found." }

  try {
    await db.$transaction([
      db.promptTemplate.updateMany({
        where: {
          projectId: existing.projectId,
          type: existing.type,
          id: { not: id },
        },
        data: { isActive: false },
      }),
      db.promptTemplate.update({
        where: { id },
        data: { isActive: true },
      }),
    ])
    revalidatePath("/ai-templates")
    return { success: true }
  } catch (err) {
    console.error("[setActiveTemplate]", err)
    return { success: false, error: "Failed to set active template." }
  }
}
