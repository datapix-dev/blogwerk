"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import type { ConnectionType, ApiConnection } from "@prisma/client"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export type ConnectionWithProject = ApiConnection & {
  project: { id: string; name: string; blogUrl: string | null }
}

export type WordPressConfig = {
  url: string
  username: string
  applicationPassword: string
  defaultAuthorId?: number
  defaultCategoryId?: number
  publishMode: "draft" | "publish"
}

export type CustomApiConfig = {
  baseUrl: string
  authType: "api_key" | "bearer"
  authValue: string
  postEndpoint: string
  imageEndpoint?: string
  fieldMapping: Record<string, string>
}

export async function getConnections(): Promise<ConnectionWithProject[]> {
  const session = await requireSession()
  return db.apiConnection.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: {
      project: { select: { id: true, name: true, blogUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<ConnectionWithProject[]>
}

export async function getConnectionByProject(
  projectId: string
): Promise<ConnectionWithProject | null> {
  const session = await requireSession()
  return db.apiConnection.findFirst({
    where: {
      projectId,
      workspaceId: session.user.workspaceId,
    },
    include: {
      project: { select: { id: true, name: true, blogUrl: true } },
    },
  }) as Promise<ConnectionWithProject | null>
}

export async function upsertConnection(
  projectId: string,
  type: ConnectionType,
  config: WordPressConfig | CustomApiConfig
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) return { success: false, error: "Project not found." }

  try {
    const connection = await db.apiConnection.upsert({
      where: { projectId },
      create: {
        workspaceId: session.user.workspaceId,
        projectId,
        type,
        config: config as object,
        isVerified: false,
      },
      update: {
        type,
        config: config as object,
        isVerified: false,
        lastTestedAt: null,
      },
    })
    revalidatePath("/connections")
    return { success: true, id: connection.id }
  } catch (err) {
    console.error("[upsertConnection]", err)
    return { success: false, error: "Failed to save connection." }
  }
}

export async function deleteConnection(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()

  const existing = await db.apiConnection.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: "Connection not found." }

  try {
    await db.apiConnection.delete({ where: { id } })
    revalidatePath("/connections")
    return { success: true }
  } catch (err) {
    console.error("[deleteConnection]", err)
    return { success: false, error: "Failed to delete connection." }
  }
}

export async function testConnection(
  id: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession()

  const connection = await db.apiConnection.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })
  if (!connection) return { success: false, message: "Connection not found." }

  try {
    if (connection.type === "WORDPRESS") {
      const cfg = connection.config as WordPressConfig
      const url = cfg.url.replace(/\/$/, "")
      const credentials = Buffer.from(
        `${cfg.username}:${cfg.applicationPassword}`
      ).toString("base64")

      const res = await fetch(`${url}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.status === 401) {
        await db.apiConnection.update({
          where: { id },
          data: { isVerified: false, lastTestedAt: new Date() },
        })
        return { success: false, message: "Invalid WordPress credentials (401)." }
      }
      if (!res.ok) {
        await db.apiConnection.update({
          where: { id },
          data: { isVerified: false, lastTestedAt: new Date() },
        })
        return { success: false, message: `WordPress returned HTTP ${res.status}.` }
      }

      await db.apiConnection.update({
        where: { id },
        data: { isVerified: true, lastTestedAt: new Date() },
      })
      return { success: true, message: "WordPress connection verified." }
    }

    if (connection.type === "CUSTOM_API") {
      const cfg = connection.config as CustomApiConfig
      const authHeader =
        cfg.authType === "bearer" ? `Bearer ${cfg.authValue}` : cfg.authValue

      const res = await fetch(cfg.baseUrl, {
        method: "HEAD",
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.status === 405) {
        const getRes = await fetch(cfg.baseUrl, {
          method: "GET",
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(10_000),
        })
        if (!getRes.ok) {
          await db.apiConnection.update({
            where: { id },
            data: { isVerified: false, lastTestedAt: new Date() },
          })
          return { success: false, message: `API returned HTTP ${getRes.status}.` }
        }
      } else if (!res.ok) {
        await db.apiConnection.update({
          where: { id },
          data: { isVerified: false, lastTestedAt: new Date() },
        })
        return { success: false, message: `API returned HTTP ${res.status}.` }
      }

      await db.apiConnection.update({
        where: { id },
        data: { isVerified: true, lastTestedAt: new Date() },
      })
      return { success: true, message: "Custom API connection verified." }
    }

    return { success: false, message: "Unknown connection type." }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error"
    await db.apiConnection
      .update({
        where: { id },
        data: { isVerified: false, lastTestedAt: new Date() },
      })
      .catch(() => {})
    return { success: false, message: `Connection failed: ${message}` }
  }
}
