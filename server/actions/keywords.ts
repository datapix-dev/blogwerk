"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { KeywordStatus, SearchIntent, Priority } from "@prisma/client"

export type KeywordWithProject = {
  id: string
  projectId: string
  keyword: string
  searchVolume: number | null
  difficulty: number | null
  intent: SearchIntent | null
  priority: Priority
  cluster: string | null
  targetUrl: string | null
  status: KeywordStatus
  createdAt: Date
  project: { id: string; name: string }
}

export type KeywordFilters = {
  projectId?: string
  status?: KeywordStatus
  intent?: SearchIntent
  priority?: Priority
  search?: string
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.workspaceId) throw new Error("Unauthorized")
  return session
}

export async function getKeywords(filters?: KeywordFilters): Promise<KeywordWithProject[]> {
  const session = await requireSession()
  return db.keyword.findMany({
    where: {
      project: { workspaceId: session.user.workspaceId },
      ...(filters?.projectId && { projectId: filters.projectId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.intent && { intent: filters.intent }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.search && { keyword: { contains: filters.search, mode: "insensitive" } }),
    },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true } } },
  })
}

export type CreateKeywordInput = {
  projectId: string
  keyword: string
  searchVolume?: number
  difficulty?: number
  intent?: SearchIntent
  priority?: Priority
  cluster?: string
  targetUrl?: string
  status?: KeywordStatus
}

export async function createKeyword(
  data: CreateKeywordInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireSession()
  if (!data.keyword?.trim()) return { success: false, error: "Keyword is required." }
  const project = await db.project.findFirst({
    where: { id: data.projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) return { success: false, error: "Project not found." }
  try {
    const kw = await db.keyword.create({
      data: {
        projectId: data.projectId,
        keyword: data.keyword.trim(),
        searchVolume: data.searchVolume ?? null,
        difficulty: data.difficulty ?? null,
        intent: data.intent ?? null,
        priority: data.priority ?? "MEDIUM",
        cluster: data.cluster?.trim() || null,
        targetUrl: data.targetUrl?.trim() || null,
        status: data.status ?? "OPEN",
      },
    })
    revalidatePath("/keywords")
    revalidatePath(`/projects/${data.projectId}`)
    return { success: true, id: kw.id }
  } catch (err) {
    console.error("[createKeyword]", err)
    return { success: false, error: "Failed to create keyword." }
  }
}

export type UpdateKeywordInput = Partial<Omit<CreateKeywordInput, "projectId">>

export async function updateKeyword(
  id: string,
  data: UpdateKeywordInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession()
  const existing = await db.keyword.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    select: { id: true, projectId: true },
  })
  if (!existing) return { success: false, error: "Keyword not found." }
  try {
    await db.keyword.update({
      where: { id },
      data: {
        ...(data.keyword !== undefined && { keyword: data.keyword.trim() }),
        ...(data.searchVolume !== undefined && { searchVolume: data.searchVolume ?? null }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty ?? null }),
        ...(data.intent !== undefined && { intent: data.intent ?? null }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.cluster !== undefined && { cluster: data.cluster?.trim() || null }),
        ...(data.targetUrl !== undefined && { targetUrl: data.targetUrl?.trim() || null }),
        ...(data.status !== undefined && { status: data.status }),
      },
    })
    revalidatePath("/keywords")
    revalidatePath(`/projects/${existing.projectId}`)
    return { success: true }
  } catch (err) {
    console.error("[updateKeyword]", err)
    return { success: false, error: "Failed to update keyword." }
  }
}

export async function deleteKeywords(
  ids: string[]
): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  const session = await requireSession()
  if (!ids.length) return { success: false, error: "No keyword IDs provided." }
  const owned = await db.keyword.findMany({
    where: { id: { in: ids }, project: { workspaceId: session.user.workspaceId } },
    select: { id: true },
  })
  const ownedIds = owned.map((k) => k.id)
  if (!ownedIds.length) return { success: false, error: "No matching keywords found." }
  try {
    const { count } = await db.keyword.deleteMany({ where: { id: { in: ownedIds } } })
    revalidatePath("/keywords")
    return { success: true, deleted: count }
  } catch (err) {
    console.error("[deleteKeywords]", err)
    return { success: false, error: "Failed to delete keywords." }
  }
}

export type ImportKeywordRow = {
  keyword: string
  searchVolume?: number | null
  difficulty?: number | null
  intent?: SearchIntent | null
  priority?: Priority | null
  cluster?: string | null
  targetUrl?: string | null
}

export type ImportKeywordsResult = {
  imported: number
  duplicates: number
  errors: string[]
}

export async function importKeywords(
  projectId: string,
  rows: ImportKeywordRow[]
): Promise<{ success: true; result: ImportKeywordsResult } | { success: false; error: string }> {
  const session = await requireSession()
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: session.user.workspaceId },
    select: { id: true },
  })
  if (!project) return { success: false, error: "Project not found." }
  const validRows = rows.filter((r) => r.keyword?.trim())
  if (!validRows.length) return { success: false, error: "No valid keyword rows found." }
  const keywords = validRows.map((r) => r.keyword.trim().toLowerCase())
  const existing = await db.keyword.findMany({
    where: { projectId, keyword: { in: keywords, mode: "insensitive" } },
    select: { keyword: true },
  })
  const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()))
  const toInsert: ImportKeywordRow[] = []
  let duplicates = 0
  for (const row of validRows) {
    if (existingSet.has(row.keyword.trim().toLowerCase())) { duplicates++; continue }
    toInsert.push(row)
  }
  let imported = 0
  const errors: string[] = []
  for (const row of toInsert) {
    try {
      await db.keyword.create({
        data: {
          projectId,
          keyword: row.keyword.trim(),
          searchVolume: row.searchVolume ?? null,
          difficulty: row.difficulty ?? null,
          intent: row.intent ?? null,
          priority: row.priority ?? "MEDIUM",
          cluster: row.cluster?.trim() || null,
          targetUrl: row.targetUrl?.trim() || null,
          status: "OPEN",
        },
      })
      imported++
    } catch (err) {
      errors.push(`Failed to import "${row.keyword}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  revalidatePath("/keywords")
  revalidatePath(`/projects/${projectId}`)
  return { success: true, result: { imported, duplicates, errors } }
}
