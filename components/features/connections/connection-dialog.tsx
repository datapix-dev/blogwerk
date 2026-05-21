"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, Zap, ArrowRight, ArrowLeft } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  upsertConnection,
  testConnection,
  getConnections,
} from "@/server/actions/connections"
import { getProjects } from "@/server/actions/projects"
import type { ConnectionWithProject } from "@/server/actions/connections"
import type { ConnectionType } from "@prisma/client"

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: ConnectionWithProject | null
  onSuccess?: () => void
}

type Step = "config" | "fields"
type TestStatus = "idle" | "testing" | "success" | "error"

interface ProjectOption {
  id: string
  name: string
}

function getConfigString(config: unknown, key: string): string {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const val = (config as Record<string, unknown>)[key]
    return typeof val === "string" ? val : ""
  }
  return ""
}

export function ConnectionDialog({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: ConnectionDialogProps) {
  const router = useRouter()
  const isEditing = !!connection

  const [step, setStep] = React.useState<Step>("config")
  const [projects, setProjects] = React.useState<ProjectOption[]>([])
  const [projectId, setProjectId] = React.useState("")
  const [connType, setConnType] = React.useState<ConnectionType>("WORDPRESS")

  const [wpUrl, setWpUrl] = React.useState("")
  const [wpUsername, setWpUsername] = React.useState("")
  const [wpAppPassword, setWpAppPassword] = React.useState("")
  const [wpPublishMode, setWpPublishMode] = React.useState<"draft" | "publish">("draft")

  const [apiBaseUrl, setApiBaseUrl] = React.useState("")
  const [apiAuthType, setApiAuthType] = React.useState<"api_key" | "bearer">("bearer")
  const [apiAuthValue, setApiAuthValue] = React.useState("")
  const [apiPostEndpoint, setApiPostEndpoint] = React.useState("")
  const [apiImageEndpoint, setApiImageEndpoint] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [testStatus, setTestStatus] = React.useState<TestStatus>("idle")
  const [testMessage, setTestMessage] = React.useState("")
  const [savedId, setSavedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return

    async function load() {
      const [allProjects, existingConnections] = await Promise.all([
        getProjects(),
        getConnections(),
      ])
      const takenProjectIds = new Set(existingConnections.map((c) => c.projectId))
      const available = allProjects.filter(
        (p) =>
          !takenProjectIds.has(p.id) ||
          (isEditing && connection?.projectId === p.id)
      )
      setProjects(available.map((p) => ({ id: p.id, name: p.name })))
    }
    load()
  }, [open, isEditing, connection?.projectId])

  React.useEffect(() => {
    if (!open) return

    if (connection) {
      setStep("config")
      setProjectId(connection.projectId)
      setConnType(connection.type)
      setTestStatus("idle")
      setTestMessage("")
      setSavedId(connection.id)

      const cfg = connection.config as Record<string, unknown>
      if (connection.type === "WORDPRESS") {
        setWpUrl(getConfigString(cfg, "url"))
        setWpUsername(getConfigString(cfg, "username"))
        setWpAppPassword("")
        setWpPublishMode(
          (getConfigString(cfg, "publishMode") as "draft" | "publish") || "draft"
        )
      } else {
        setApiBaseUrl(getConfigString(cfg, "baseUrl"))
        setApiAuthType(
          (getConfigString(cfg, "authType") as "api_key" | "bearer") || "bearer"
        )
        setApiAuthValue("")
        setApiPostEndpoint(getConfigString(cfg, "postEndpoint"))
        setApiImageEndpoint(getConfigString(cfg, "imageEndpoint"))
      }
    } else {
      setStep("config")
      setProjectId("")
      setConnType("WORDPRESS")
      setWpUrl("")
      setWpUsername("")
      setWpAppPassword("")
      setWpPublishMode("draft")
      setApiBaseUrl("")
      setApiAuthType("bearer")
      setApiAuthValue("")
      setApiPostEndpoint("")
      setApiImageEndpoint("")
      setTestStatus("idle")
      setTestMessage("")
      setSavedId(null)
    }
    setError("")
  }, [open, connection])

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) {
      setError("Please select a project.")
      return
    }
    setError("")
    setStep("fields")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let config: Record<string, unknown>

      if (connType === "WORDPRESS") {
        if (!wpUrl || !wpUsername) {
          setError("WordPress URL and Username are required.")
          return
        }
        const existingPassword = isEditing
          ? getConfigString(connection!.config as unknown, "applicationPassword")
          : ""
        const finalPassword = wpAppPassword || existingPassword
        if (!finalPassword) {
          setError("Application Password is required.")
          return
        }
        config = {
          url: wpUrl.trim(),
          username: wpUsername.trim(),
          applicationPassword: finalPassword,
          publishMode: wpPublishMode,
        }
      } else {
        if (!apiBaseUrl || !apiPostEndpoint) {
          setError("Base URL and Post Endpoint are required.")
          return
        }
        const existingAuth = isEditing
          ? getConfigString(connection!.config as unknown, "authValue")
          : ""
        const finalAuth = apiAuthValue || existingAuth
        if (!finalAuth) {
          setError("Auth Value is required.")
          return
        }
        config = {
          baseUrl: apiBaseUrl.trim(),
          authType: apiAuthType,
          authValue: finalAuth,
          postEndpoint: apiPostEndpoint.trim(),
          fieldMapping: {},
          ...(apiImageEndpoint ? { imageEndpoint: apiImageEndpoint.trim() } : {}),
        }
      }

      const result = await upsertConnection(
        projectId,
        connType,
        config as Parameters<typeof upsertConnection>[2]
      )
      if (!result.success) {
        setError(result.error)
        return
      }
      setSavedId(result.id)
      toast.success(isEditing ? "Connection updated." : "Connection created.")
      onSuccess?.()
      onOpenChange(false)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  async function handleTestInline() {
    const idToTest = savedId ?? connection?.id
    if (!idToTest) {
      toast.error("Save the connection first before testing.")
      return
    }
    setTestStatus("testing")
    setTestMessage("")
    try {
      const result = await testConnection(idToTest)
      setTestStatus(result.success ? "success" : "error")
      setTestMessage(result.message)
      if (result.success) router.refresh()
    } catch {
      setTestStatus("error")
      setTestMessage("Test failed unexpectedly.")
    }
  }

  const canTest = !!(savedId ?? connection?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Connection" : "New Connection"}</DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <form onSubmit={handleNextStep} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>
                Project <span className="text-red-500">*</span>
              </Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  if (v) setProjectId(v)
                }}
                disabled={isEditing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      All projects have connections
                    </SelectItem>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {isEditing && (
                <p className="text-xs text-zinc-400">
                  Project cannot be changed after creation.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Connection Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={connType}
                onValueChange={(v) => {
                  if (v) setConnType(v as ConnectionType)
                }}
                disabled={isEditing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORDPRESS">WordPress</SelectItem>
                  <SelectItem value="CUSTOM_API">Custom API</SelectItem>
                </SelectContent>
              </Select>
              {isEditing && (
                <p className="text-xs text-zinc-400">Connection type cannot be changed.</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!projectId}>
                Next
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "fields" && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {connType === "WORDPRESS" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="wp-url">
                    WordPress URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="wp-url"
                    type="url"
                    placeholder="https://yourblog.com"
                    value={wpUrl}
                    onChange={(e) => setWpUrl(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-zinc-400">
                    Root URL of the WordPress site (no trailing slash)
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wp-username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="wp-username"
                    placeholder="admin"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wp-app-password">
                    Application Password{" "}
                    {!isEditing && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="wp-app-password"
                    type="password"
                    placeholder={
                      isEditing
                        ? "Leave blank to keep existing password"
                        : "xxxx xxxx xxxx xxxx xxxx xxxx"
                    }
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                  />
                  <p className="text-xs text-zinc-400">
                    Generate at WordPress → Users → Profile → Application Passwords
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Default Publish Mode</Label>
                  <Select
                    value={wpPublishMode}
                    onValueChange={(v) => {
                      if (v) setWpPublishMode(v as "draft" | "publish")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="publish">Publish immediately</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="api-base-url">
                    Base URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="api-base-url"
                    type="url"
                    placeholder="https://api.yourblog.com"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Auth Type</Label>
                    <Select
                      value={apiAuthType}
                      onValueChange={(v) => {
                        if (v) setApiAuthType(v as "api_key" | "bearer")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="api-auth-value">
                      Auth Value{" "}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="api-auth-value"
                      type="password"
                      placeholder={
                        isEditing ? "Leave blank to keep existing" : "Token or key"
                      }
                      value={apiAuthValue}
                      onChange={(e) => setApiAuthValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-post-endpoint">
                    Post Endpoint <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="api-post-endpoint"
                    placeholder="/api/posts"
                    value={apiPostEndpoint}
                    onChange={(e) => setApiPostEndpoint(e.target.value)}
                    required
                  />
                  <p className="text-xs text-zinc-400">
                    Relative path or full URL for creating posts
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-image-endpoint">Image Endpoint (optional)</Label>
                  <Input
                    id="api-image-endpoint"
                    placeholder="/api/media"
                    value={apiImageEndpoint}
                    onChange={(e) => setApiImageEndpoint(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-700">Test Connection</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={testStatus === "testing" || !canTest}
                  onClick={handleTestInline}
                >
                  {testStatus === "testing" ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3 mr-1" />
                  )}
                  {canTest ? "Test" : "Save first"}
                </Button>
              </div>
              {testStatus !== "idle" && testMessage && (
                <div
                  className={`flex items-start gap-1.5 text-xs ${
                    testStatus === "success" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {testStatus === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  )}
                  {testMessage}
                </div>
              )}
              {!canTest && (
                <p className="text-xs text-zinc-400">
                  Save the connection first, then test it.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("config")}
                disabled={loading || isEditing}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Connection"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
