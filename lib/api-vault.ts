import crypto from "crypto"
import { db } from "./db"

function getKey(): Buffer {
  const secret = process.env.API_VAULT_SECRET ?? "blogplanner-vault-secret-32chars!!"
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptKey(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

export function decryptKey(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(":")
  if (parts.length !== 3) throw new Error("Invalid ciphertext format")
  const [ivHex, tagHex, encHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const enc = Buffer.from(encHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString("utf8") + decipher.final("utf8")
}

function safeDecrypt(val: string | null | undefined): string | undefined {
  if (!val) return undefined
  try {
    return decryptKey(val)
  } catch {
    return undefined
  }
}

export type VaultField = "anthropicKey" | "openaiKey" | "googleAiKey" | "nanoBananaKey"

export async function resolveWorkspaceApiKey(
  workspaceId: string,
  field: VaultField,
  envFallback: string | undefined
): Promise<string | undefined> {
  try {
    const vault = await db.apiKeyVault.findUnique({ where: { workspaceId } })
    if (vault) {
      const decrypted = safeDecrypt(vault[field])
      if (decrypted) return decrypted
    }
  } catch {
    // DB unavailable — fall through to env
  }
  return envFallback
}

export async function getVaultPreview(workspaceId: string): Promise<
  Record<VaultField, { isSet: boolean; preview: string | null }>
> {
  const vault = await db.apiKeyVault.findUnique({ where: { workspaceId } })

  function preview(encrypted: string | null | undefined) {
    if (!encrypted) return { isSet: false, preview: null }
    const plain = safeDecrypt(encrypted)
    if (!plain) return { isSet: false, preview: null }
    return { isSet: true, preview: plain.length >= 6 ? "..." + plain.slice(-6) : plain }
  }

  return {
    anthropicKey: preview(vault?.anthropicKey),
    openaiKey: preview(vault?.openaiKey),
    googleAiKey: preview(vault?.googleAiKey),
    nanoBananaKey: preview(vault?.nanoBananaKey),
  }
}
