"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { encryptKey, getVaultPreview, type VaultField } from "@/lib/api-vault"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export type VaultKeyInfo = { isSet: boolean; preview: string | null }
export type VaultData = Record<VaultField, VaultKeyInfo>

export async function getApiKeyVault(): Promise<VaultData> {
  const session = await requireAdmin()
  return getVaultPreview(session.user.workspaceId)
}

export type KeyUpdates = Partial<Record<VaultField, string | null>>

export async function testApiKey(
  field: VaultField
): Promise<{ success: boolean; message: string }> {
  const session = await requireAdmin()
  const vault = await db.apiKeyVault.findUnique({ where: { workspaceId: session.user.workspaceId } })
  const { decryptKey } = await import("@/lib/api-vault")

  function getKey(f: VaultField): string | null {
    const enc = vault?.[f]
    if (!enc) return null
    try { return decryptKey(enc) } catch { return null }
  }

  const key = getKey(field)
  if (!key) return { success: false, message: "No key stored." }

  try {
    if (field === "anthropicKey") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status === 401) return { success: false, message: "Invalid Anthropic key (401)." }
      if (!res.ok) return { success: false, message: `Anthropic API returned ${res.status}.` }
      return { success: true, message: "Anthropic key is valid." }
    }

    if (field === "openaiKey") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status === 401) return { success: false, message: "Invalid OpenAI key (401)." }
      if (!res.ok) return { success: false, message: `OpenAI API returned ${res.status}.` }
      return { success: true, message: "OpenAI key is valid." }
    }

    if (field === "googleAiKey" || field === "nanoBananaKey") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (res.status === 400 || res.status === 403) return { success: false, message: "Invalid Google AI key." }
      if (!res.ok) return { success: false, message: `Google AI API returned ${res.status}.` }
      const label = field === "nanoBananaKey" ? "Nano Banana (Gemini)" : "Google AI"
      return { success: true, message: `${label} key is valid.` }
    }

    return { success: false, message: "Unknown key type." }
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : "unknown"}` }
  }
}

export async function saveApiKeyVault(updates: KeyUpdates): Promise<void> {
  const session = await requireAdmin()
  const workspaceId = session.user.workspaceId

  const data: Partial<Record<VaultField, string | null>> = {}

  for (const [field, value] of Object.entries(updates) as [VaultField, string | null][]) {
    if (value === null || value === "") {
      data[field] = null
    } else {
      data[field] = encryptKey(value)
    }
  }

  if (Object.keys(data).length === 0) return

  await db.apiKeyVault.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  })
}
