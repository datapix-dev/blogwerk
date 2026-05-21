"use client"

import { useState } from "react"
import { Eye, EyeOff, Save, X, KeyRound, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveApiKeyVault, type VaultData, type VaultKeyInfo, type KeyUpdates } from "@/server/actions/api-keys"

type VaultField = "anthropicKey" | "openaiKey" | "googleAiKey" | "nanoBananaKey"
import { toast } from "sonner"

const KEY_META: { field: VaultField; label: string; hint: string }[] = [
  { field: "anthropicKey",  label: "Anthropic API Key",   hint: "Used for Claude article generation (sk-ant-…)" },
  { field: "openaiKey",     label: "OpenAI API Key",      hint: "Used for DALL-E 3 image generation (sk-…)" },
  { field: "googleAiKey",   label: "Google AI API Key",   hint: "Used for Imagen image generation fallback" },
  { field: "nanoBananaKey", label: "Nano Banana API Key", hint: "Used for Nano Banana image provider" },
]

interface KeyRowProps {
  field: VaultField
  label: string
  hint: string
  isSet: boolean
  preview: string | null
  value: string
  cleared: boolean
  onChange: (v: string) => void
  onClear: () => void
  onRestore: () => void
}

function KeyRow({ field, label, hint, isSet, preview, value, cleared, onChange, onClear, onRestore }: KeyRowProps) {
  const [visible, setVisible] = useState(false)

  const effectivelySet = isSet && !cleared
  const hasNewValue = value.length > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field} className="text-sm font-medium text-zinc-800">
          {label}
        </Label>
        {effectivelySet && !hasNewValue && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Set{preview ? ` · ends with ${preview}` : ""}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={field}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={effectivelySet && !hasNewValue ? "Leave blank to keep current key" : "Paste new key…"}
            className="pr-10 font-mono text-sm"
            autoComplete="off"
          />
          {(value.length > 0 || (effectivelySet && !hasNewValue)) && (
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              tabIndex={-1}
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {effectivelySet && !hasNewValue && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClear}
            className="shrink-0 text-zinc-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        {cleared && (
          <Button variant="ghost" size="sm" type="button" onClick={onRestore} className="shrink-0 text-zinc-400 hover:text-zinc-700 text-xs">
            Undo
          </Button>
        )}
      </div>
      <p className="text-xs text-zinc-400">{hint}</p>
    </div>
  )
}

interface ApiKeysPageProps {
  vault: VaultData
}

export function ApiKeysPage({ vault }: ApiKeysPageProps) {
  const [values, setValues] = useState<Partial<Record<VaultField, string>>>({})
  const [cleared, setCleared] = useState<Partial<Record<VaultField, boolean>>>({})
  const [saving, setSaving] = useState(false)

  function handleChange(field: VaultField, v: string) {
    setValues((prev) => ({ ...prev, [field]: v }))
    if (v) setCleared((prev) => ({ ...prev, [field]: false }))
  }

  function handleClear(field: VaultField) {
    setCleared((prev) => ({ ...prev, [field]: true }))
    setValues((prev) => ({ ...prev, [field]: "" }))
  }

  function handleRestore(field: VaultField) {
    setCleared((prev) => ({ ...prev, [field]: false }))
    setValues((prev) => ({ ...prev, [field]: "" }))
  }

  async function handleSave() {
    const updates: KeyUpdates = {}
    let hasChanges = false

    for (const { field } of KEY_META) {
      const c = (cleared as Record<string, boolean>)[field]
      const v = (values as Record<string, string>)[field]
      if (c) {
        ;(updates as Record<string, string | null>)[field] = null
        hasChanges = true
      } else if (v) {
        ;(updates as Record<string, string | null>)[field] = v
        hasChanges = true
      }
    }

    if (!hasChanges) {
      toast.info("No changes to save.")
      return
    }

    setSaving(true)
    try {
      await saveApiKeyVault(updates)
      toast.success("API keys saved.")
      setValues({})
      setCleared({})
    } catch {
      toast.error("Failed to save keys.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">AI API Keys</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Keys are encrypted at rest and override environment variables at runtime.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-6 max-w-2xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100">
          <div className="rounded-md bg-zinc-100 p-2">
            <KeyRound className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">Key Vault</p>
            <p className="text-xs text-zinc-400">Only visible to workspace admins</p>
          </div>
        </div>

        <div className="space-y-6">
          {KEY_META.map(({ field, label, hint }) => (
            <KeyRow
              key={field}
              field={field}
              label={label}
              hint={hint}
              isSet={(vault as Record<string, VaultKeyInfo>)[field].isSet}
              preview={(vault as Record<string, VaultKeyInfo>)[field].preview}
              value={(values as Record<string, string>)[field] ?? ""}
              cleared={!!(cleared as Record<string, boolean>)[field]}
              onChange={(v) => handleChange(field, v)}
              onClear={() => handleClear(field)}
              onRestore={() => handleRestore(field)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <p className="text-xs text-zinc-400">
            Blank inputs keep the existing key. Clear removes it.
          </p>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Saving…" : "Save Keys"}
          </Button>
        </div>
      </div>
    </div>
  )
}
