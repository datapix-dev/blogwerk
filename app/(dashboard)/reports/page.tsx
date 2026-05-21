import { getReportsData } from "@/server/actions/reports"
import { getSearchConsoleConnection } from "@/server/actions/search-console"
import { ReportsPage } from "@/components/features/reports/reports-page"

export const metadata = { title: "Reports — BlogPlanner" }

export default async function ReportsPageRoute() {
  const [data, connection] = await Promise.all([
    getReportsData(),
    getSearchConsoleConnection(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Analytics, keyword rankings, and workspace activity.
        </p>
      </div>
      <ReportsPage data={data} connection={connection} />
    </div>
  )
}
