import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
