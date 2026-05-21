import type { NextAuthConfig } from "next-auth"
import type { Role } from "@prisma/client"

// Edge-compatible auth config (no database imports)
export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith("/login")
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth")

      if (isApiAuth) return true
      if (!isLoggedIn && !isAuthPage) return Response.redirect(new URL("/login", nextUrl))
      if (isLoggedIn && isAuthPage) return Response.redirect(new URL("/dashboard", nextUrl))
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role as Role
        token.workspaceId = (user as any).workspaceId as string
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as Role
      session.user.workspaceId = token.workspaceId as string
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
}
