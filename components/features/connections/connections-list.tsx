"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { Plug, Pencil, Trash2, Zap, CheckCircle2, XCircle, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/features/empty-state"
import { ConnectionDialog } from "./connection-dialog"
import { deleteConnection, testConnection } from "@/server/actions/connections"
import type { ConnectionWithProject } from "@/server/actions/connections"

interface ConnectionsListProps {
  initialData: ConnectionWithProject[]
}

export function ConnectionsList({ initialData }: ConnectionsListProps) {
  const router = useRouter()
  const [data, setData] = React.useState<ConnectionWithProject[]>(initialData)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingConnection, setEditingConnection] =
    React.useState<ConnectionWithProject | null>(null)
  const [testingId, setTestingId] = React.useState<string | null>(null)

  function handleSuccess() {
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this connection? This cannot be undone.")) return
    const result = await deleteConnection(id)
    if (result.success) {
      setData((prev) => prev.filter((c) => c.id !== id))
      toast.success("Connection deleted.")
    } else {
      toast.error(result.error)
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const result = await testConnection(id)
      if (result.success) {
        toast.success(result.message)
        // Optimistically update isVerified
        setData((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, isVerified: true, lastTestedAt: new Date() } : c
          )
        )
        router.refresh()
      } else {
        toast.error(result.message)
        setData((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, isVerified: false, lastTestedAt: new Date() } : c
          )
        )
      }
    } catch {
      toast.error("Test failed unexpectedly.")
    } finally {
      setTestingId(null)
    }
  }

  return (
    <>
      {data.length === 0 ? (
        <EmptyState
          icon={<Plug className="w-8 h-8" />}
          title="No connections yet"
          description="Connect a WordPress site or custom API to start publishing articles directly."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingConnection(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Connection
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => {
                setEditingConnection(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Connection
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((conn) => (
              <div
                key={conn.id}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col"
              >
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Plug className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <span className="font-medium text-zinc-900 truncate text-sm">
                        {conn.project.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        conn.type === "WORDPRESS"
                          ? "bg-blue-50 text-blue-700 border-blue-200 text-xs flex-shrink-0"
                          : "bg-violet-50 text-violet-700 border-violet-200 text-xs flex-shrink-0"
                      }
                    >
                      {conn.type === "WORDPRESS" ? "WordPress" : "Custom API"}
                    </Badge>
                  </div>

                  <p className="text-xs text-zinc-400 truncate mb-3">
                    {conn.project.blogUrl ?? "No blog URL set"}
                  </p>

                  <div className="flex items-center gap-1.5 text-sm">
                    {conn.isVerified ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-emerald-700 text-xs">Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        <span className="text-zinc-500 text-xs">Not verified</span>
                      </>
                    )}
                  </div>

                  {conn.lastTestedAt && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Tested {format(new Date(conn.lastTestedAt), "dd MMM yyyy, HH:mm")}
                    </p>
                  )}
                </div>

                <div className="border-t border-zinc-100 px-4 py-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={testingId === conn.id}
                    onClick={() => handleTest(conn.id)}
                  >
                    {testingId === conn.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditingConnection(conn)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:border-red-200 ml-auto"
                    onClick={() => handleDelete(conn.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingConnection(null)
        }}
        connection={editingConnection}
        onSuccess={handleSuccess}
      />
    </>
  )
}
