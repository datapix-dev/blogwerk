"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateWorkspaceSettings, changePassword } from "@/server/actions/settings"
import type { WorkspaceSettingsData } from "@/server/actions/settings"

interface SettingsPageProps {
  data: WorkspaceSettingsData
  isAdmin: boolean
}

export function SettingsPage({ data, isAdmin }: SettingsPageProps) {
  const { workspace, currentMonthUsage } = data

  const [wsName, setWsName] = React.useState(workspace.name)
  const [monthlyLimit, setMonthlyLimit] = React.useState(String(workspace.monthlyGenLimit))
  const [savingWs, setSavingWs] = React.useState(false)

  const [oldPw, setOldPw] = React.useState("")
  const [newPw, setNewPw] = React.useState("")
  const [confirmPw, setConfirmPw] = React.useState("")
  const [savingPw, setSavingPw] = React.useState(false)

  const usagePercent = Math.min(
    100,
    Math.round((currentMonthUsage.articleCount / workspace.monthlyGenLimit) * 100)
  )

  async function handleSaveWorkspace() {
    const limit = parseInt(monthlyLimit, 10)
    if (isNaN(limit)) { toast.error("Monthly limit must be a number."); return }
    setSavingWs(true)
    try {
      const res = await updateWorkspaceSettings(wsName, limit)
      if (!res.success) { toast.error(res.error); return }
      toast.success("Workspace settings saved.")
    } finally {
      setSavingWs(false)
    }
  }

  async function handleChangePassword() {
    if (!oldPw || !newPw) { toast.error("All password fields are required."); return }
    if (newPw !== confirmPw) { toast.error("New passwords do not match."); return }
    if (newPw.length < 8) { toast.error("New password must be at least 8 characters."); return }
    setSavingPw(true)
    try {
      const res = await changePassword(oldPw, newPw)
      if (!res.success) { toast.error(res.error); return }
      toast.success("Password changed successfully.")
      setOldPw("")
      setNewPw("")
      setConfirmPw("")
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Workspace */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Workspace</h2>
          <p className="text-sm text-zinc-500">General workspace configuration.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Workspace Name</Label>
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={workspace.slug} readOnly className="text-zinc-400 bg-zinc-50" />
            <p className="text-xs text-zinc-400">Slug cannot be changed after creation.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Generation Limit</Label>
            <Input
              type="number"
              min={1}
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              disabled={!isAdmin}
              className="max-w-xs"
            />
            <p className="text-xs text-zinc-400">Maximum number of AI-generated articles per month.</p>
          </div>
          {isAdmin && (
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSaveWorkspace} disabled={savingWs}>
                {savingWs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Current Month Usage</h2>
          <p className="text-sm text-zinc-500">AI generation usage for the current billing month.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Articles generated</span>
            <span className="font-medium text-zinc-900">
              {currentMonthUsage.articleCount} / {workspace.monthlyGenLimit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-zinc-900"
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <p className="text-xs text-zinc-400">Articles</p>
              <p className="text-lg font-semibold text-zinc-900">{currentMonthUsage.articleCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Images</p>
              <p className="text-lg font-semibold text-zinc-900">{currentMonthUsage.imageCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Est. Cost</p>
              <p className="text-lg font-semibold text-zinc-900">
                ${currentMonthUsage.estimatedCost.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Change Password</h2>
          <p className="text-sm text-zinc-500">Update your account password.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleChangePassword} disabled={savingPw}>
              {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
