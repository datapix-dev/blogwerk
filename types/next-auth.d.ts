import type { Role } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: Role
      workspaceId: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    workspaceId: string
  }
}
