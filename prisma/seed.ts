import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  const workspace = await db.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Workspace", slug: "default", monthlyGenLimit: 500 },
  })

  await db.user.upsert({
    where: { email: "admin@blogplanner.io" },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: "admin@blogplanner.io",
      name: "Admin",
      password: await bcrypt.hash("admin123", 12),
      role: "ADMIN",
    },
  })

  console.log("Seeded: admin@blogplanner.io / admin123")
}

main().finally(() => db.$disconnect())
