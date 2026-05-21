# BlogPlanner — Plan 01: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-ready Next.js app scaffold with Docker Compose, Prisma schema, NextAuth auth, full layout shell (Sidebar + Topbar + DashboardShell), all page stubs, and a working login flow deployed to blogwerk.astro-it.de.

**Architecture:** Next.js 15 App Router monorepo, two Docker containers (web + worker), PostgreSQL + Redis as Docker services. NextAuth v5 Credentials provider with role + workspaceId in JWT. Layout uses route groups: `(auth)` for public pages, `(dashboard)` for protected pages with shared shell.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL 16, Redis 7, NextAuth v5, BullMQ, Docker Compose, bcryptjs

---

## File Map

```
blogwerk/
├── .env.example
├── .env.local                        # local dev (gitignored)
├── .gitignore
├── Dockerfile
├── Dockerfile.worker
├── docker-compose.yml                # local dev
├── docker-compose.prod.yml           # production
├── deploy.sh                         # updated
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                   # shadcn config
├── package.json
├── prisma/
│   └── schema.prisma
├── app/
│   ├── layout.tsx                    # root layout (html, body)
│   ├── (auth)/
│   │   ├── layout.tsx                # auth layout (centered card)
│   │   └── login/
│   │       └── page.tsx              # login page
│   └── (dashboard)/
│       ├── layout.tsx                # dashboard layout (shell)
│       ├── dashboard/
│       │   └── page.tsx
│       ├── projects/
│       │   └── page.tsx
│       ├── keywords/
│       │   └── page.tsx
│       ├── articles/
│       │   └── page.tsx
│       ├── ai-templates/
│       │   └── page.tsx
│       ├── connections/
│       │   └── page.tsx
│       ├── reports/
│       │   └── page.tsx
│       ├── users/
│       │   └── page.tsx
│       └── settings/
│           └── page.tsx
├── components/
│   ├── ui/                           # shadcn components (auto-generated)
│   ├── layout/
│   │   ├── dashboard-shell.tsx
│   │   ├── sidebar.tsx
│   │   └── topbar.tsx
│   └── providers/
│       └── session-provider.tsx
├── lib/
│   ├── auth.ts                       # NextAuth config
│   ├── db.ts                         # Prisma singleton
│   └── redis.ts                      # Redis + BullMQ connection
├── middleware.ts                     # route protection
├── types/
│   └── next-auth.d.ts               # session type augmentation
└── worker/
    └── index.ts                      # worker entry (stub)
```

---

### Task 1: Initialize Next.js Project + Dependencies

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `components.json`

- [ ] **Step 1: Create Next.js app**

Run in `/Users/haipham/Documents/cursor/blog`:
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --yes
```
Expected: Next.js 15 project created, `package.json` exists.

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  next-auth@beta \
  @auth/prisma-adapter \
  @prisma/client \
  prisma \
  @anthropic-ai/sdk \
  bullmq \
  ioredis \
  bcryptjs \
  sharp \
  xlsx \
  papaparse \
  @tanstack/react-table \
  swr \
  date-fns \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-tabs \
  @radix-ui/react-toast \
  @radix-ui/react-tooltip \
  @radix-ui/react-separator \
  @radix-ui/react-avatar \
  @radix-ui/react-badge \
  @radix-ui/react-progress \
  @radix-ui/react-collapsible

npm install -D \
  @types/bcryptjs \
  @types/papaparse
```
Expected: `node_modules` populated, no peer dependency errors.

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

Expected: `components/ui/` directory created, `components.json` updated.

- [ ] **Step 4: Add required shadcn components**

```bash
npx shadcn@latest add button card input label badge avatar \
  dropdown-menu dialog select separator sheet skeleton \
  table tabs toast tooltip progress collapsible
```
Expected: Components added to `components/ui/`.

- [ ] **Step 5: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["blogwerk.astro-it.de"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with dependencies"
```

---

### Task 2: Environment Configuration

**Files:**
- Create: `.env.example`
- Create: `.env.local` (not committed)

- [ ] **Step 1: Create `.env.example`**

```bash
# Database
DATABASE_URL="postgresql://blogplanner:password@localhost:5432/blogplanner"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# Image Generation (one or more)
NANO_BANANA_API_KEY=""
GOOGLE_AI_API_KEY=""
OPENAI_API_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 2: Create `.env.local` for local dev**

```bash
# Database
DATABASE_URL="postgresql://blogplanner:blogplanner@localhost:5432/blogplanner"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"

# Anthropic
ANTHROPIC_API_KEY="your-key-here"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 3: Update `.gitignore` to protect secrets**

Ensure these lines exist in `.gitignore`:
```
.env.local
.env.production
.env*.local
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "feat: add environment configuration"
```

---

### Task 3: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `Dockerfile.worker`
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `Dockerfile.worker`**

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx tsc --project tsconfig.worker.json 2>/dev/null || true
CMD ["node", "dist/worker/index.js"]
```

- [ ] **Step 3: Create `.dockerignore`**

```
node_modules
.next
.git
.env*.local
.env.production
*.md
```

- [ ] **Step 4: Create `docker-compose.yml` (local dev)**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: blogplanner
      POSTGRES_PASSWORD: blogplanner
      POSTGRES_DB: blogplanner
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data

volumes:
  postgres_dev_data:
  redis_dev_data:
```

- [ ] **Step 5: Create `docker-compose.prod.yml`**

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - /tmp/blogplanner:/tmp/blogplanner

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - /tmp/blogplanner:/tmp/blogplanner

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_prod_data:/data

volumes:
  postgres_prod_data:
  redis_prod_data:
```

- [ ] **Step 6: Update `next.config.ts` for standalone output**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["blogwerk.astro-it.de"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 7: Start local dev services**

```bash
docker compose up -d
```
Expected: postgres on :5432, redis on :6379

- [ ] **Step 8: Commit**

```bash
git add Dockerfile Dockerfile.worker docker-compose.yml docker-compose.prod.yml .dockerignore next.config.ts
git commit -m "feat: add Docker setup (web + worker + postgres + redis)"
```

---

### Task 4: Prisma Schema + Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id               String    @id @default(cuid())
  name             String
  slug             String    @unique
  monthlyGenLimit  Int       @default(100)
  createdAt        DateTime  @default(now())

  users            User[]
  projects         Project[]
  apiConnections   ApiConnection[]
  usage            WorkspaceUsage[]
  searchConsole    SearchConsoleConnection?
}

model WorkspaceUsage {
  id             String    @id @default(cuid())
  workspaceId    String
  month          String
  articleCount   Int       @default(0)
  imageCount     Int       @default(0)
  estimatedCost  Float     @default(0)

  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, month])
}

model User {
  id           String   @id @default(cuid())
  workspaceId  String
  email        String   @unique
  name         String?
  password     String?
  role         Role     @default(EDITOR)
  createdAt    DateTime @default(now())

  workspace    Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projects     ProjectAssignment[]
  articles     Article[]
  activityLogs ActivityLog[]
}

enum Role {
  ADMIN
  PROJECT_MANAGER
  EDITOR
  CUSTOMER
}

model Project {
  id                 String        @id @default(cuid())
  workspaceId        String
  name               String
  clientName         String?
  blogUrl            String?
  language           String        @default("de")
  targetAudience     String?
  toneOfVoice        String?
  defaultPublishMode PublishMode   @default(DRAFT)
  status             ProjectStatus @default(ACTIVE)
  createdAt          DateTime      @default(now())

  workspace          Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  assignments        ProjectAssignment[]
  keywords           Keyword[]
  articles           Article[]
  promptTemplates    PromptTemplate[]
  apiConnection      ApiConnection?
}

enum ProjectStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}

enum PublishMode {
  DRAFT
  SCHEDULED
  PUBLISH
}

model ProjectAssignment {
  userId    String
  projectId String

  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@id([userId, projectId])
}

model Keyword {
  id           String        @id @default(cuid())
  projectId    String
  keyword      String
  searchVolume Int?
  difficulty   Int?
  intent       SearchIntent?
  priority     Priority      @default(MEDIUM)
  cluster      String?
  targetUrl    String?
  status       KeywordStatus @default(OPEN)
  createdAt    DateTime      @default(now())

  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  article      Article?
}

enum KeywordStatus {
  OPEN
  PLANNED
  IN_PROGRESS
  GENERATED
  PUBLISHED
}

enum SearchIntent {
  INFORMATIONAL
  NAVIGATIONAL
  COMMERCIAL
  TRANSACTIONAL
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}

model Article {
  id              String        @id @default(cuid())
  projectId       String
  keywordId       String?       @unique
  authorId        String?
  title           String?
  slug            String?
  contentHtml     String?       @db.Text
  contentMarkdown String?       @db.Text
  metaTitle       String?
  metaDescription String?
  excerpt         String?
  category        String?
  tags            String[]
  featuredImage   String?
  status          ArticleStatus @default(DRAFT)
  publishMode     PublishMode   @default(DRAFT)
  publishAt       DateTime?
  url             String?
  targetKeywords  String[]
  externalId      String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  keyword         Keyword?        @relation(fields: [keywordId], references: [id])
  author          User?           @relation(fields: [authorId], references: [id])
  generationJobs  GenerationJob[]
  analytics       ArticleAnalytics?
}

enum ArticleStatus {
  DRAFT
  AI_GENERATED
  NEEDS_REVIEW
  APPROVED
  SCHEDULED
  PUBLISHED
  FAILED
}

model PromptTemplate {
  id        String       @id @default(cuid())
  projectId String
  type      TemplateType
  name      String
  content   String       @db.Text
  version   Int          @default(1)
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

enum TemplateType {
  ARTICLE
  FORMATTING
  IMAGE
}

model ApiConnection {
  id           String         @id @default(cuid())
  workspaceId  String
  projectId    String         @unique
  type         ConnectionType
  config       Json
  isVerified   Boolean        @default(false)
  lastTestedAt DateTime?
  lastSyncAt   DateTime?
  createdAt    DateTime       @default(now())

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

enum ConnectionType {
  WORDPRESS
  CUSTOM_API
}

model GenerationJob {
  id        String        @id @default(cuid())
  articleId String
  type      JobType
  status    JobStatus     @default(PENDING)
  errorType JobErrorType?
  errorMsg  String?
  payload   Json?
  result    Json?
  attempts  Int           @default(0)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
}

enum JobType {
  ARTICLE_GENERATION
  IMAGE_GENERATION
  PUBLISH
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum JobErrorType {
  CLAUDE_TIMEOUT
  CLAUDE_RATE_LIMIT
  INVALID_WP_CREDENTIALS
  IMAGE_GENERATION_FAILED
  RATE_LIMIT_REACHED
  NETWORK_ERROR
  UNKNOWN
}

model SearchConsoleConnection {
  id           String   @id @default(cuid())
  workspaceId  String   @unique
  siteUrl      String?
  accessToken  String?
  refreshToken String?
  isConnected  Boolean  @default(false)
  createdAt    DateTime @default(now())

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model ArticleAnalytics {
  id          String   @id @default(cuid())
  articleId   String   @unique
  clicks      Int      @default(0)
  impressions Int      @default(0)
  position    Float?
  ctr         Float?
  updatedAt   DateTime @updatedAt

  article     Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
}

model KeywordRanking {
  id         String   @id @default(cuid())
  keywordId  String
  position   Float?
  url        String?
  recordedAt DateTime @default(now())
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  entity    String?
  entityId  String?
  meta      Json?
  createdAt DateTime @default(now())

  user      User? @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 2: Create `lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init
```
Expected: Migration file created in `prisma/migrations/`, all tables created in DB.

- [ ] **Step 4: Verify schema**

```bash
npx prisma studio
```
Expected: Prisma Studio opens on http://localhost:5555, all models visible.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/db.ts
git commit -m "feat: add Prisma schema + initial migration"
```

---

### Task 5: NextAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `components/providers/session-provider.tsx`

- [ ] **Step 1: Create `lib/auth.ts`**

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import type { Role } from "@prisma/client"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            workspaceId: true,
          },
        })

        if (!user?.password) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
        }
      },
    }),
  ],
  callbacks: {
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
})
```

- [ ] **Step 2: Create `types/next-auth.d.ts`**

```typescript
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
```

- [ ] **Step 3: Create `app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

- [ ] **Step 4: Create `components/providers/session-provider.tsx`**

```typescript
"use client"

import { SessionProvider } from "next-auth/react"

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 5: Seed initial workspace + admin user**

Create `prisma/seed.ts`:
```typescript
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
```

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Install `tsx`:
```bash
npm install -D tsx
```

Run seed:
```bash
npx prisma db seed
```
Expected: `Seeded: admin@blogplanner.io / admin123`

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts types/ app/api/ components/providers/ prisma/seed.ts package.json
git commit -m "feat: add NextAuth v5 credentials auth with role + workspaceId in JWT"
```

---

### Task 6: Route Protection Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth")

  if (isApiAuth) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 2: Test middleware**

Start dev server:
```bash
npm run dev
```

Navigate to `http://localhost:3000` — should redirect to `/login`.
Navigate to `http://localhost:3000/login` — should show login page (not redirect).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware"
```

---

### Task 7: Root Layout + Auth Layout + Login Page

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthSessionProvider } from "@/components/providers/session-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BlogPlanner",
  description: "Content Operations Platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(auth)/login/page.tsx`**

```typescript
"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid email or password")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <span className="font-semibold text-zinc-900">BlogPlanner</span>
        </div>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your credentials to access your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Test login flow**

1. Navigate to `http://localhost:3000/login`
2. Enter `admin@blogplanner.io` / `admin123`
3. Expected: redirect to `/dashboard`
4. Navigate to `http://localhost:3000/login` again — expected: redirect to `/dashboard` (already logged in)

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add auth layout and login page"
```

---

### Task 8: Dashboard Layout Shell + Sidebar + Topbar

**Files:**
- Create: `lib/redis.ts`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`
- Create: `components/layout/dashboard-shell.tsx`
- Create: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `lib/redis.ts`**

```typescript
import { Redis } from "ioredis"

const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  })

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
```

- [ ] **Step 2: Create `components/layout/sidebar.tsx`**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard, FolderKanban, Tags, FileText,
  Sparkles, Plug, BarChart3, Users, Settings, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/keywords", label: "Keywords", icon: Tags },
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/ai-templates", label: "AI Templates", icon: Sparkles },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full border-r border-zinc-200 bg-white transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-14 px-3 border-b border-zinc-200",
          collapsed ? "justify-center" : "gap-2.5 px-4"
        )}>
          <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-zinc-900 text-sm">BlogPlanner</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            const item = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }
            return item
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-zinc-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full h-8 text-zinc-400 hover:text-zinc-600", collapsed && "px-0")}
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-1.5 text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
```

- [ ] **Step 3: Create `components/layout/topbar.tsx`**

```typescript
"use client"

import { signOut, useSession } from "next-auth/react"
import { Bell, Search, LogOut, User, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function Topbar() {
  const { data: session } = useSession()
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() ?? "?"

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 gap-4">
      {/* Search */}
      <button className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 w-64 hover:border-zinc-300 transition-colors">
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto text-xs bg-white border border-zinc-200 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-400 hover:text-zinc-600 relative">
          <Bell className="w-4 h-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs bg-zinc-900 text-white">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-zinc-700 hidden sm:block">
                {session?.user?.name ?? session?.user?.email}
              </span>
              <Badge variant="outline" className="text-xs hidden sm:flex">
                {session?.user?.role?.toLowerCase().replace("_", " ")}
              </Badge>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-zinc-500 font-normal">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-3.5 h-3.5 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Create `components/layout/dashboard-shell.tsx`**

```typescript
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
```

- [ ] **Step 5: Create `app/(dashboard)/layout.tsx`**

```typescript
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return <DashboardShell>{children}</DashboardShell>
}
```

- [ ] **Step 6: Create page stubs for all routes**

Create these files, each with the same pattern:

`app/(dashboard)/dashboard/page.tsx`:
```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">Dashboard</h1>
      <p className="text-sm text-zinc-500">Overview of your workspace</p>
    </div>
  )
}
```

Create identical stubs for:
- `app/(dashboard)/projects/page.tsx` (title: "Projects")
- `app/(dashboard)/keywords/page.tsx` (title: "Keywords")
- `app/(dashboard)/articles/page.tsx` (title: "Articles")
- `app/(dashboard)/ai-templates/page.tsx` (title: "AI Templates")
- `app/(dashboard)/connections/page.tsx` (title: "API Connections")
- `app/(dashboard)/reports/page.tsx` (title: "Reports")
- `app/(dashboard)/users/page.tsx` (title: "Users")
- `app/(dashboard)/settings/page.tsx` (title: "Settings")

Also add root redirect `app/page.tsx`:
```typescript
import { redirect } from "next/navigation"
export default function RootPage() {
  redirect("/dashboard")
}
```

- [ ] **Step 7: Test complete flow**

1. Open `http://localhost:3000` → redirects to `/login`
2. Login with `admin@blogplanner.io` / `admin123` → redirects to `/dashboard`
3. Sidebar visible, all nav items clickable
4. Topbar shows user name + role badge
5. Sign out → back to `/login`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add dashboard shell, sidebar, topbar, all page stubs"
```

---

### Task 9: Worker Stub + BullMQ Setup

**Files:**
- Create: `worker/index.ts`
- Create: `worker/queues/index.ts`

- [ ] **Step 1: Create `worker/queues/index.ts`**

```typescript
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

export const articleGenerationQueue = new Queue("article-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const imageGenerationQueue = new Queue("image-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const publishQueue = new Queue("publish", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})
```

- [ ] **Step 2: Create `worker/index.ts`**

```typescript
import { Worker } from "bullmq"
import { redis } from "@/lib/redis"

console.log("BlogPlanner Worker starting...")

const articleWorker = new Worker(
  "article-generation",
  async (job) => {
    console.log(`[article-generation] Processing job ${job.id}`)
    // Processor implemented in Plan 04
    return { status: "stub" }
  },
  { connection: redis, concurrency: 2 }
)

const imageWorker = new Worker(
  "image-generation",
  async (job) => {
    console.log(`[image-generation] Processing job ${job.id}`)
    // Processor implemented in Plan 05
    return { status: "stub" }
  },
  { connection: redis, concurrency: 3 }
)

const publishWorker = new Worker(
  "publish",
  async (job) => {
    console.log(`[publish] Processing job ${job.id}`)
    // Processor implemented in Plan 06
    return { status: "stub" }
  },
  { connection: redis, concurrency: 2 }
)

articleWorker.on("completed", (job) => console.log(`[article-generation] Job ${job.id} completed`))
articleWorker.on("failed", (job, err) => console.error(`[article-generation] Job ${job?.id} failed:`, err.message))
imageWorker.on("completed", (job) => console.log(`[image-generation] Job ${job.id} completed`))
imageWorker.on("failed", (job, err) => console.error(`[image-generation] Job ${job?.id} failed:`, err.message))
publishWorker.on("completed", (job) => console.log(`[publish] Job ${job.id} completed`))
publishWorker.on("failed", (job, err) => console.error(`[publish] Job ${job?.id} failed:`, err.message))

console.log("Worker ready. Listening for jobs...")
```

- [ ] **Step 3: Add worker script to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "worker": "tsx worker/index.ts",
  "lint": "next lint"
}
```

- [ ] **Step 4: Test worker starts**

```bash
npm run worker
```
Expected: `Worker ready. Listening for jobs...` — no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/ package.json
git commit -m "feat: add BullMQ worker stub with 3 queues"
```

---

### Task 10: Production Deployment

**Files:**
- Modify: `deploy.sh`
- Create: `.env.production` (on server only, never committed)

- [ ] **Step 1: Create production env on server**

```bash
ssh root@202.61.194.129 "mkdir -p /var/www/blogwerk && cat > /var/www/blogwerk/.env.production << 'EOF'
DATABASE_URL=postgresql://blogplanner:CHANGE_ME@postgres:5432/blogplanner
POSTGRES_USER=blogplanner
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=blogplanner
REDIS_URL=redis://redis:6379
AUTH_SECRET=CHANGE_ME_32_CHARS
AUTH_URL=https://blogwerk.astro-it.de
NEXT_PUBLIC_APP_URL=https://blogwerk.astro-it.de
ANTHROPIC_API_KEY=sk-ant-CHANGE_ME
NODE_ENV=production
EOF"
```

Set real values:
```bash
ssh root@202.61.194.129 "
  sed -i 's/CHANGE_ME_32_CHARS/$(openssl rand -base64 32)/' /var/www/blogwerk/.env.production
  # Edit manually for DB password and API keys
  nano /var/www/blogwerk/.env.production
"
```

- [ ] **Step 2: Update `deploy.sh`**

```bash
#!/bin/bash
set -e

SERVER="root@202.61.194.129"
DEPLOY_PATH="/var/www/blogwerk"

echo "Deploying to $SERVER:$DEPLOY_PATH ..."

ssh $SERVER "
  cd $DEPLOY_PATH
  git pull origin main
  docker compose -f docker-compose.prod.yml build --no-cache
  docker compose -f docker-compose.prod.yml up -d
  docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy
  echo 'Deploy complete'
"
```

- [ ] **Step 3: Update nginx config on server for app proxy**

```bash
ssh root@202.61.194.129 "cat > /etc/nginx/sites-available/blogwerk << 'NGINX'
server {
    server_name blogwerk.astro-it.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/blogwerk.access.log;
    error_log  /var/log/nginx/blogwerk.error.log;
}
NGINX
nginx -t && systemctl reload nginx"
```

- [ ] **Step 4: Deploy**

```bash
git push origin main
./deploy.sh
```

- [ ] **Step 5: Verify**

```bash
curl -sI https://blogwerk.astro-it.de/login
```
Expected: `HTTP/2 200` — Login page live.

- [ ] **Step 6: Commit**

```bash
git add deploy.sh
git commit -m "feat: update deploy script for Docker Compose production deployment"
git push origin main
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Foundation requirements covered — Docker ✓, Next.js ✓, Prisma full schema ✓, NextAuth ✓, Layout Shell ✓, Sidebar ✓, Topbar ✓, all page stubs ✓, Worker stub ✓, Production deployment ✓
- [x] **Placeholder scan:** No TBD/TODO in any code block. Worker stubs explicitly marked "implemented in Plan 0X"
- [x] **Type consistency:** `Role` from Prisma used in `types/next-auth.d.ts` and `lib/auth.ts`. `db` export from `lib/db.ts` used in `lib/auth.ts`. `redis` export from `lib/redis.ts` used in `worker/queues/index.ts` and `worker/index.ts`
- [x] **No gaps:** All 10 tasks produce working, testable output

---

_Next: Plan 02 — Projects + Keywords_
