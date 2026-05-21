"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== "ADMIN") throw new Error("Forbidden: Admin only")
  return session
}

export type WorkspaceSettingsData = {
  workspace: {
    id: string
    name: string
    slug: string
    monthlyGenLimit: number
  }
  currentMonthUsage: {
    articleCount: number
    imageCount: number
    estimatedCost: number
  }
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettingsData> {
  const session = await requireSession()
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [workspace, usage] = await Promise.all([
    db.workspace.findUniqueOrThrow({
      where: { id: session.user.workspaceId },
      select: { id: true, name: true, slug: true, monthlyGenLimit: true },
    }),
    db.workspaceUsage.findUnique({
      where: {
        workspaceId_month: {
          workspaceId: session.user.workspaceId,
          month: currentMonth,
        },
      },
      select: { articleCount: true, imageCount: true, estimatedCost: true },
    }),
  ])

  return {
    workspace,
    currentMonthUsage: {
      articleCount: usage?.articleCount ?? 0,
      imageCount: usage?.imageCount ?? 0,
      estimatedCost: usage?.estimatedCost ?? 0,
    },
  }
}

export async function updateWorkspaceSettings(
  name: string,
  monthlyGenLimit: number
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireAdmin()

  if (!name?.trim()) return { success: false, error: "Workspace name is required." }
  if (!Number.isInteger(monthlyGenLimit) || monthlyGenLimit < 1) {
    return { success: false, error: "Monthly generation limit must be a positive integer." }
  }

  try {
    await db.workspace.update({
      where: { id: session.user.workspaceId },
      data: { name: name.trim(), monthlyGenLimit },
    })
    revalidatePath("/settings")
    return { success: true }
  } catch (err) {
    console.error("[updateWorkspaceSettings]", err)
    return { success: false, error: "Failed to update workspace settings." }
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  if (!oldPassword || !newPassword) {
    return { success: false, error: "Both passwords are required." }
  }
  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." }
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })

  if (!user?.password) {
    return { success: false, error: "User not found." }
  }

  const valid = await bcrypt.compare(oldPassword, user.password)
  if (!valid) {
    return { success: false, error: "Current password is incorrect." }
  }

  const hashed = await bcrypt.hash(newPassword, 12)

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    })
    return { success: true }
  } catch (err) {
    console.error("[changePassword]", err)
    return { success: false, error: "Failed to change password." }
  }
}
