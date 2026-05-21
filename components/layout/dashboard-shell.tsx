import { auth } from "@/lib/auth"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = session?.user?.role ?? "EDITOR"

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar role={role} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
