import { auth } from "@/lib/auth"
import { getWorkspaceSettings } from "@/server/actions/settings"
import { SettingsPage } from "@/components/features/settings/settings-page"

export const metadata = { title: "Settings — BlogPlanner" }

export default async function SettingsPageRoute() {
  const [session, data] = await Promise.all([auth(), getWorkspaceSettings()])
  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Workspace configuration and account settings.
        </p>
      </div>
      <SettingsPage data={data} isAdmin={isAdmin} />
    </div>
  )
}
