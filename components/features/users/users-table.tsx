"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "../data-table"
import { InviteUserDialog } from "./invite-user-dialog"
import { updateUserRole, deleteUser } from "@/server/actions/users"
import type { UserRow } from "@/server/actions/users"
import type { Role } from "@prisma/client"

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  EDITOR: "Editor",
  CUSTOMER: "Customer",
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-zinc-900 text-white",
  PROJECT_MANAGER: "bg-blue-100 text-blue-800",
  EDITOR: "bg-green-100 text-green-800",
  CUSTOMER: "bg-zinc-100 text-zinc-700",
}

const ALL_ROLES: Role[] = ["ADMIN", "PROJECT_MANAGER", "EDITOR", "CUSTOMER"]

interface UsersTableProps {
  initialData: UserRow[]
  currentUserId: string
  isAdmin: boolean
}

export function UsersTable({ initialData, currentUserId, isAdmin }: UsersTableProps) {
  const router = useRouter()
  const [data, setData] = React.useState<UserRow[]>(initialData)
  const [inviteOpen, setInviteOpen] = React.useState(false)

  function handleSuccess() {
    router.refresh()
  }

  async function handleRoleChange(id: string, role: Role) {
    const res = await updateUserRole(id, role)
    if (!res.success) { toast.error(res.error); return }
    toast.success("Role updated.")
    setData((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
  }

  async function handleDelete(id: string) {
    const res = await deleteUser(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success("User removed.")
    setData((prev) => prev.filter((u) => u.id !== id))
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-zinc-900">{row.original.name ?? "—"}</p>
          <p className="text-xs text-zinc-400">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge className={`text-xs ${ROLE_COLORS[row.original.role]}`}>
          {ROLE_LABELS[row.original.role]}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-xs text-zinc-500">
          {format(new Date(row.original.createdAt), "MMM d, yyyy")}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "actions",
            cell: ({ row }: { row: { original: UserRow } }) => {
              const isSelf = row.original.id === currentUserId
              return (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-zinc-100 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ALL_ROLES.filter((r) => r !== row.original.role).map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => handleRoleChange(row.original.id, r)}
                        >
                          Set as {ROLE_LABELS[r]}
                        </DropdownMenuItem>
                      ))}
                      {!isSelf && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(row.original.id)}
                          >
                            Remove
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            },
          } satisfies ColumnDef<UserRow>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite User
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        emptyTitle="No users yet"
        emptyDescription="Invite team members to collaborate on this workspace."
        enableRowSelection={false}
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
