import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { FileText, FolderOpen, Users, Link2 } from "lucide-react"
import { getCustomerData } from "@/server/actions/customer"
import { CustomerDashboard } from "@/components/features/customer/customer-dashboard"
import type { ArticleStatus } from "@prisma/client"

export const metadata = { title: "Dashboard — BlogPlanner" }

const STATUS_LABELS: Partial<Record<ArticleStatus, string>> = {
  DRAFT: "Draft",
  AI_GENERATED: "AI Generated",
  NEEDS_REVIEW: "Needs Review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  FAILED: "Failed",
}

const STATUS_COLORS: Partial<Record<ArticleStatus, string>> = {
  DRAFT: "bg-zinc-200",
  AI_GENERATED: "bg-blue-400",
  NEEDS_REVIEW: "bg-amber-400",
  APPROVED: "bg-green-400",
  PUBLISHED: "bg-emerald-600",
  FAILED: "bg-red-400",
}

interface StatCardProps {
  href: string
  icon: React.ElementType
  label: string
  value: number
}

function StatCard({ href, icon: Icon, label, value }: StatCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-5 flex items-center gap-4 hover:border-zinc-300 transition-colors"
    >
      <div className="rounded-md bg-zinc-100 p-2.5">
        <Icon className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const workspaceId = session?.user?.workspaceId
  if (!workspaceId) return null

  // CUSTOMER role gets a simplified read-only view
  if (session?.user?.role === "CUSTOMER") {
    const data = await getCustomerData()
    return (
      <CustomerDashboard
        data={data}
        userName={session.user.name ?? null}
      />
    )
  }

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [
    projectCount,
    userCount,
    connectionCount,
    articleGroups,
    usage,
    recentArticles,
  ] = await Promise.all([
    db.project.count({ where: { workspaceId } }),
    db.user.count({ where: { workspaceId } }),
    db.apiConnection.count({ where: { workspaceId } }),
    db.article.groupBy({
      by: ["status"],
      where: { project: { workspaceId } },
      _count: { id: true },
    }),
    db.workspaceUsage.findUnique({
      where: { workspaceId_month: { workspaceId, month: currentMonth } },
      select: { articleCount: true, imageCount: true, estimatedCost: true },
    }),
    db.article.findMany({
      where: { project: { workspaceId } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        project: { select: { name: true } },
      },
    }),
  ])

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { monthlyGenLimit: true },
  })

  const totalArticles = articleGroups.reduce((sum, g) => sum + g._count.id, 0)
  const monthlyUsed = usage?.articleCount ?? 0
  const monthlyLimit = workspace?.monthlyGenLimit ?? 100
  const usagePercent = Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Welcome back, {session?.user?.name ?? session?.user?.email}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard href="/articles" icon={FileText} label="Total Articles" value={totalArticles} />
        <StatCard href="/projects" icon={FolderOpen} label="Projects" value={projectCount} />
        <StatCard href="/users" icon={Users} label="Team Members" value={userCount} />
        <StatCard href="/connections" icon={Link2} label="Connections" value={connectionCount} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Article Status Breakdown */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Article Status</h2>
          {articleGroups.length === 0 ? (
            <p className="text-sm text-zinc-400">No articles yet.</p>
          ) : (
            <div className="space-y-2.5">
              {articleGroups.map((g) => {
                const pct = totalArticles > 0 ? Math.round((g._count.id / totalArticles) * 100) : 0
                return (
                  <div key={g.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600">{STATUS_LABELS[g.status] ?? g.status}</span>
                      <span className="font-medium text-zinc-900">{g._count.id}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[g.status] ?? "bg-zinc-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Monthly Usage */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Monthly Usage</h2>
            <span className="text-xs text-zinc-400">{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600">Articles generated</span>
              <span className="font-medium text-zinc-900">{monthlyUsed} / {monthlyLimit}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-zinc-900"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400">{usagePercent}% used</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs text-zinc-400">Images</p>
              <p className="text-lg font-semibold text-zinc-900">{usage?.imageCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Est. Cost</p>
              <p className="text-lg font-semibold text-zinc-900">${(usage?.estimatedCost ?? 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-700">Recent Articles</h2>
          <Link href="/articles" className="text-xs text-zinc-400 hover:text-zinc-600">
            View all →
          </Link>
        </div>
        {recentArticles.length === 0 ? (
          <p className="text-sm text-zinc-400 px-5 py-8 text-center">No articles yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recentArticles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/articles/${a.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {a.title ?? "Untitled"}
                    </p>
                    <p className="text-xs text-zinc-400">{a.project.name}</p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0 ml-4">
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
