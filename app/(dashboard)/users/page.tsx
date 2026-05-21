import { auth } from "@/lib/auth"
import { getUsers } from "@/server/actions/users"
import { UsersTable } from "@/components/features/users/users-table"

export const metadata = { title: "Users — BlogPlanner" }

export default async function UsersPage() {
  const [session, users] = await Promise.all([auth(), getUsers()])
  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Users</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage workspace members and their roles.
        </p>
      </div>
      <UsersTable
        initialData={users}
        currentUserId={session?.user?.id ?? ""}
        isAdmin={isAdmin}
      />
    </div>
  )
}
