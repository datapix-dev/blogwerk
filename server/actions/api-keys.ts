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
