import { getConnections } from "@/server/actions/connections"
import { ConnectionsList } from "@/components/features/connections/connections-list"

export const metadata = { title: "Connections — BlogPlanner" }

export default async function ConnectionsPage() {
  const connections = await getConnections()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">API Connections</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Connect WordPress sites and custom blog APIs to publish articles directly.
        </p>
      </div>
      <ConnectionsList initialData={connections} />
    </div>
  )
}
