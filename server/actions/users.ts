"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import type { Role } from "@prisma/client"

export type UserRow = {
  id: string
  email: string
  name: string | null
  role: Role
  workspaceId: string
  createdAt: Date
}

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

export async function getUsers(): Promise<UserRow[]> {
  const session = await requireSession()
  return db.user.findMany({
    where: { workspaceId: session.user.workspaceId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      workspaceId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function inviteUser(
  email: string,
  name: string,
  role: Role
): Promise<{ success: true; tempPassword: string } | { success: false; error: string }> {
  const session = await requireAdmin()

  if (!email?.trim()) return { success: false, error: "Email is required." }
  if (!name?.trim()) return { success: false, error: "Name is required." }

  const existing = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  })
  if (existing) return { success: false, error: "A user with this email already exists." }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"
  let tempPassword = ""
  for (let i = 0; i < 16; i++) {
    tempPassword += chars[Math.floor(Math.random() * chars.length)]
  }

  const hashed = await bcrypt.hash(tempPassword, 12)

  try {
    await db.user.create({
      data: {
        workspaceId: session.user.workspaceId,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: hashed,
        role,
      },
    })
    revalidatePath("/users")
    return { success: true, tempPassword }
  } catch (err) {
    console.error("[inviteUser]", err)
    return { success: false, error: "Failed to create user." }
  }
}

export async function updateUserRole(
  id: string,
  role: Role
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireAdmin()

  const existing = await db.user.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "User not found." }

  try {
    await db.user.update({ where: { id }, data: { role } })
    revalidatePath("/users")
    return { success: true }
  } catch (err) {
    console.error("[updateUserRole]", err)
    return { success: false, error: "Failed to update user role." }
  }
}

export async function deleteUser(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireAdmin()

  if (id === session.user.id) {
    return { success: false, error: "You cannot delete your own account." }
  }

  const existing = await db.user.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "User not found." }

  try {
    await db.user.delete({ where: { id } })
    revalidatePath("/users")
    return { success: true }
  } catch (err) {
    console.error("[deleteUser]", err)
    return { success: false, error: "Failed to delete user." }
  }
}
