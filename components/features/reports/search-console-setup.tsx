"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Search, ExternalLink, Unlink, RefreshCw, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  saveSearchConsoleConnection,
  disconnectSearchConsole,
  syncSearchConsoleData,
} from "@/server/actions/search-console"
import type { SearchConsoleConnectionData } from "@/server/actions/search-console"

interface SearchConsoleSetupProps {
  connection: SearchConsoleConnectionData | null
}

export function SearchConsoleSetup({ connection }: SearchConsoleSetupProps) {
  const router = useRouter()
  const isConnected = connection?.isConnected === true

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [siteUrl, setSiteUrl] = React.useState("")
  const [accessToken, setAccessToken] = React.useState("")
  const [refreshToken, setRefreshToken] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (dialogOpen && connection?.siteUrl) setSiteUrl(connection.siteUrl)
    if (!dialogOpen) {
      setSiteUrl("")
      setAccessToken("")
      setRefreshToken("")
      setError("")
    }
  }, [dialogOpen, connection?.siteUrl])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await saveSearchConsoleConnection(siteUrl, accessToken, refreshToken)
      if (!res.success) { setError(res.error); return }
      toast.success("Google Search Console connected.")
      setDialogOpen(false)
      router.refresh()
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Search Console? Analytics data will be retained.")) return
    setDisconnecting(true)
    try {
      const res = await disconnectSearchConsole()
      if (!res.success) { toast.error(res.error); return }
      toast.success("Disconnected.")
      router.refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await syncSearchConsoleData()
      if (!res.success) { toast.error(res.error); return }
      toast.success(
        `Sync complete — ${res.articlesUpdated} articles, ${res.keywordsUpdated} keywords updated.`
      )
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Google Search Console connected
            </p>
            {connection?.siteUrl && (
              <p className="text-xs text-emerald-700 mt-0.5">{connection.siteUrl}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing
              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              : <RefreshCw className="w-3 h-3 mr-1" />}
            Sync Now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-500 hover:text-red-600"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting
              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              : <Unlink className="w-3 h-3 mr-1" />}
            Disconnect
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-zinc-700">
              Connect Google Search Console
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Import real click and ranking data for your articles and keywords.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Connect
          <ExternalLink className="w-3 h-3 ml-1.5" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Google Search Console</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Enter your Search Console site URL and a service account access token.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="gsc-site-url">
                Site URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="gsc-site-url"
                type="url"
                placeholder="https://yourblog.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gsc-access-token">
                Access Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="gsc-access-token"
                type="password"
                placeholder="ya29.xxx..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gsc-refresh-token">Refresh Token (optional)</Label>
              <Input
                id="gsc-refresh-token"
                type="password"
                placeholder="1//xxx..."
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save Connection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
