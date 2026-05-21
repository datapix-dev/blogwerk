import { getProjects } from "@/server/actions/projects"
import { ProjectsTable } from "@/components/features/projects/projects-table"

export const metadata = { title: "Projects — BlogPlanner" }

export default async function ProjectsPage() {
  const projects = await getProjects()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Projects</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your content projects and their settings.</p>
      </div>
      <ProjectsTable initialData={projects} />
    </div>
  )
}
