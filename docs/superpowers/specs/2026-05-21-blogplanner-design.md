# BlogPlanner — Design Spec
_2026-05-21 · rev 2_

## Overview

BlogPlanner is a production-quality SaaS platform for agencies, SEO teams, freelancers and content teams to plan, generate and publish SEO blog content with AI assistance. It is a **content operations system** — not a simple AI writer.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL · Prisma · Redis · BullMQ · NextAuth.js v5 · Anthropic Claude (text) · Nano Banana / Google AI Studio / OpenAI (images)

**Deployment:** Docker Compose (web + worker + postgres + redis) · nginx reverse proxy · blogwerk.astro-it.de

---

## Architecture

### Two-Container Design

| Container | Purpose |
|---|---|
| `web` | Next.js App Router, Server Actions, API Routes (Port 3000) |
| `worker` | BullMQ Worker — processes AI generation, image generation, publish jobs |
| `postgres` | PostgreSQL 16 |
| `redis` | Redis 7 — job queue + caching |

nginx on host proxies `blogwerk.astro-it.de` → web:3000. All containers isolated in their own Docker network, no interference with existing server projects.

### Folder Structure

```
blogwerk/
├── app/
│   ├── (auth)/                   # Login (public)
│   ├── (dashboard)/              # All protected pages
│   │   ├── dashboard/
│   │   ├── projects/[id]/
│   │   ├── keywords/
│   │   ├── articles/
│   │   ├── ai-templates/
│   │   ├── connections/
│   │   ├── reports/
│   │   ├── users/
│   │   └── settings/
│   └── api/                      # Webhooks, external callbacks
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── layout/                   # Sidebar, Topbar, DashboardShell
│   └── features/                 # Feature-specific components
├── lib/
│   ├── auth.ts                   # NextAuth v5 config
│   ├── db.ts                     # Prisma client singleton
│   ├── redis.ts                  # Redis + BullMQ connection
│   ├── storage.ts                # Local temp image storage + optimization
│   └── ai/
│       ├── claude.ts             # Anthropic Claude client
│       └── images.ts             # Image provider abstraction
├── server/
│   └── actions/                  # Server Actions (all DB mutations)
├── worker/
│   ├── queues/                   # BullMQ queue definitions
│   └── processors/               # article.ts, image.ts, publish.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
└── docker-compose.prod.yml
```

---

## Database Schema

### Models

**Workspace** — top-level tenant boundary. All data scoped to a workspace.
**User** — email, password (hashed), role, workspaceId
**Project** — name, client, blogUrl, language, tone, status, workspaceId + assignments
**ProjectAssignment** — userId × projectId join table
**Keyword** — keyword, volume, difficulty, intent, priority, cluster, status
**Article** — full article fields, contentHtml (primary), contentMarkdown (optional), status lifecycle, publishMode, publishAt, url, targetKeywords, external publish ID
**PromptTemplate** — article / formatting / image prompts, versioned
**ApiConnection** — WordPress or Custom API config (JSON, encrypted at rest), workspaceId
**GenerationJob** — tracks async jobs with typed error categories
**WorkspaceUsage** — monthly generation + cost tracking per workspace
**SearchConsoleConnection** — prepared for future GSC integration (DB only, no UI in V1)
**ArticleAnalytics** — prepared for future GSC data (DB only, no UI in V1)
**KeywordRanking** — prepared for future ranking tracking (DB only, no UI in V1)
**ActivityLog** — audit trail for all actions

### Key Enums

```
Role:          ADMIN | PROJECT_MANAGER | EDITOR | CUSTOMER
ArticleStatus: DRAFT | AI_GENERATED | NEEDS_REVIEW | APPROVED | SCHEDULED | PUBLISHED | FAILED
PublishMode:   DRAFT | SCHEDULED | PUBLISH          ← default: DRAFT globally
KeywordStatus: OPEN | PLANNED | IN_PROGRESS | GENERATED | PUBLISHED
JobType:       ARTICLE_GENERATION | IMAGE_GENERATION | PUBLISH
JobErrorType:  CLAUDE_TIMEOUT | CLAUDE_RATE_LIMIT | INVALID_WP_CREDENTIALS |
               IMAGE_GENERATION_FAILED | RATE_LIMIT_REACHED | NETWORK_ERROR | UNKNOWN
ConnectionType: WORDPRESS | CUSTOM_API
```

### Full Prisma Schema

```prisma
model Workspace {
  id                  String    @id @default(cuid())
  name                String
  slug                String    @unique
  monthlyGenLimit     Int       @default(100)
  createdAt           DateTime  @default(now())

  users               User[]
  projects            Project[]
  apiConnections      ApiConnection[]
  usage               WorkspaceUsage[]
  searchConsole       SearchConsoleConnection?
}

model WorkspaceUsage {
  id              String    @id @default(cuid())
  workspaceId     String
  month           String    // "2026-05" format
  articleCount    Int       @default(0)
  imageCount      Int       @default(0)
  estimatedCost   Float     @default(0)

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  @@unique([workspaceId, month])
}

model User {
  id            String    @id @default(cuid())
  workspaceId   String
  email         String    @unique
  name          String?
  password      String?
  role          Role      @default(EDITOR)
  createdAt     DateTime  @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id])
  projects      ProjectAssignment[]
  articles      Article[]
  activityLogs  ActivityLog[]
}

enum Role { ADMIN PROJECT_MANAGER EDITOR CUSTOMER }

model Project {
  id                  String        @id @default(cuid())
  workspaceId         String
  name                String
  clientName          String?
  blogUrl             String?
  language            String        @default("de")
  targetAudience      String?
  toneOfVoice         String?
  defaultPublishMode  PublishMode   @default(DRAFT)
  status              ProjectStatus @default(ACTIVE)
  createdAt           DateTime      @default(now())

  workspace           Workspace @relation(fields: [workspaceId], references: [id])
  assignments         ProjectAssignment[]
  keywords            Keyword[]
  articles            Article[]
  promptTemplates     PromptTemplate[]
  apiConnection       ApiConnection?
}

enum ProjectStatus { ACTIVE PAUSED ARCHIVED }
enum PublishMode   { DRAFT SCHEDULED PUBLISH }

model ProjectAssignment {
  userId      String
  projectId   String
  user        User    @relation(fields: [userId], references: [id])
  project     Project @relation(fields: [projectId], references: [id])
  @@id([userId, projectId])
}

model Keyword {
  id            String        @id @default(cuid())
  projectId     String
  keyword       String
  searchVolume  Int?
  difficulty    Int?
  intent        SearchIntent?
  priority      Priority      @default(MEDIUM)
  cluster       String?
  targetUrl     String?
  status        KeywordStatus @default(OPEN)
  createdAt     DateTime      @default(now())

  project       Project  @relation(fields: [projectId], references: [id])
  article       Article?
}

enum KeywordStatus  { OPEN PLANNED IN_PROGRESS GENERATED PUBLISHED }
enum SearchIntent   { INFORMATIONAL NAVIGATIONAL COMMERCIAL TRANSACTIONAL }
enum Priority       { LOW MEDIUM HIGH }

model Article {
  id              String        @id @default(cuid())
  projectId       String
  keywordId       String?       @unique
  authorId        String?
  title           String?
  slug            String?
  contentHtml     String?       @db.Text   // primary — WordPress-compatible
  contentMarkdown String?       @db.Text   // optional — for editor UX
  metaTitle       String?
  metaDescription String?
  excerpt         String?
  category        String?
  tags            String[]
  featuredImage   String?       // local temp path, then cleared after push
  status          ArticleStatus @default(DRAFT)
  publishMode     PublishMode   @default(DRAFT)
  publishAt       DateTime?     // for scheduling
  url             String?       // live URL after publishing
  targetKeywords  String[]      // for internal linking (future)
  externalId      String?       // WordPress post ID etc.
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  project         Project  @relation(fields: [projectId], references: [id])
  keyword         Keyword? @relation(fields: [keywordId], references: [id])
  author          User?    @relation(fields: [authorId], references: [id])
  generationJobs  GenerationJob[]
  analytics       ArticleAnalytics?
}

enum ArticleStatus {
  DRAFT AI_GENERATED NEEDS_REVIEW APPROVED SCHEDULED PUBLISHED FAILED
}

model PromptTemplate {
  id          String       @id @default(cuid())
  projectId   String
  type        TemplateType
  name        String
  content     String       @db.Text
  version     Int          @default(1)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())

  project     Project @relation(fields: [projectId], references: [id])
}

enum TemplateType { ARTICLE FORMATTING IMAGE }

model ApiConnection {
  id            String         @id @default(cuid())
  workspaceId   String
  projectId     String         @unique
  type          ConnectionType
  config        Json
  isVerified    Boolean        @default(false)
  lastTestedAt  DateTime?
  lastSyncAt    DateTime?
  createdAt     DateTime       @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id])
  project       Project   @relation(fields: [projectId], references: [id])
}

enum ConnectionType { WORDPRESS CUSTOM_API }

model GenerationJob {
  id          String        @id @default(cuid())
  articleId   String
  type        JobType
  status      JobStatus     @default(PENDING)
  errorType   JobErrorType?
  errorMsg    String?
  payload     Json?
  result      Json?
  attempts    Int           @default(0)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  article     Article @relation(fields: [articleId], references: [id])
}

enum JobType      { ARTICLE_GENERATION IMAGE_GENERATION PUBLISH }
enum JobStatus    { PENDING PROCESSING COMPLETED FAILED }
enum JobErrorType {
  CLAUDE_TIMEOUT CLAUDE_RATE_LIMIT INVALID_WP_CREDENTIALS
  IMAGE_GENERATION_FAILED RATE_LIMIT_REACHED NETWORK_ERROR UNKNOWN
}

// Search Console — DB prepared, no UI in V1
model SearchConsoleConnection {
  id            String    @id @default(cuid())
  workspaceId   String    @unique
  siteUrl       String?
  accessToken   String?
  refreshToken  String?
  isConnected   Boolean   @default(false)
  createdAt     DateTime  @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id])
}

model ArticleAnalytics {
  id          String    @id @default(cuid())
  articleId   String    @unique
  clicks      Int       @default(0)
  impressions Int       @default(0)
  position    Float?
  ctr         Float?
  updatedAt   DateTime  @updatedAt

  article     Article @relation(fields: [articleId], references: [id])
}

model KeywordRanking {
  id          String    @id @default(cuid())
  keywordId   String
  position    Float?
  url         String?
  recordedAt  DateTime  @default(now())
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

---

## Auth & Roles

**Provider:** NextAuth.js v5, Credentials (email + password, bcrypt). Role + workspaceId stored in JWT + session — no extra DB call per request.

**No self-registration.** Admin creates users and assigns roles. Customer accounts get automatic read-only dashboard access.

### Permissions Matrix

| Feature | ADMIN | PM | EDITOR | CUSTOMER |
|---|---|---|---|---|
| User management | ✓ | — | — | — |
| Create/delete projects | ✓ | ✓ | — | — |
| Upload/edit keywords | ✓ | ✓ | ✓ | — |
| Generate/edit articles | ✓ | ✓ | ✓ | — |
| Approve articles | ✓ | ✓ | — | — |
| API connections | ✓ | ✓ | — | — |
| Reports | ✓ | ✓ | — | ✓ (read) |
| Customer dashboard | ✓ | ✓ | — | ✓ |

---

## Core Features

### 1. Article Generation (Async)

```
Select keyword
  → Check workspace monthly limit (WorkspaceUsage)
  → Server Action: create Article (DRAFT) + GenerationJob (PENDING)
  → Enqueue BullMQ job in Redis
  → Worker: Claude API → contentHtml + contentMarkdown + SEO meta
  → Worker: Image API → generate image → save to /tmp/blogplanner/images/ (optimized)
  → Job → COMPLETED, Article → AI_GENERATED, WorkspaceUsage.articleCount++
  → Client polls via SWR (3s) — SSE upgrade path in V2
  → User edits → NEEDS_REVIEW → APPROVED
  → Publish → new PUBLISH job → push to WordPress/Custom API → clear local image
```

**AI Provider:** Anthropic Claude (claude-sonnet-4-6 default, configurable per project to claude-opus-4-7).

**Publishing Safety:** Default `publishMode = DRAFT` globally and per project. No article goes live without explicit user action.

### 2. Image Storage Strategy

Images never stored permanently on server — only as temporary working files:

```
Generate / upload image
  → Optimize for web: max 1920px, WebP, quality 85 (sharp.js)
  → Save to /tmp/blogplanner/images/{jobId}.webp
  → On publish: upload image to blog (WordPress media API or custom endpoint)
  → Store returned URL in Article.featuredImage
  → Delete local temp file
```

No S3 / R2 needed in V1. Local temp is sufficient — images exist only during the publish window.

### 3. Rich Text Strategy

- **`contentHtml`** — primary storage format. WordPress-compatible, Gutenberg-ready. Claude generates HTML directly per formatting prompt.
- **`contentMarkdown`** — optional secondary. Stored alongside for editor UX (markdown editor option) and future use. Generated by Claude in parallel.
- Article editor in UI: toggle between HTML source view and rich text preview. No heavy WYSIWYG in V1.

### 4. WordPress Integration

Dedicated connection UI — not treated as generic API.

- Fields: WordPress URL, Username, Application Password, default author, category, publishMode
- "Test Connection" button with live feedback + `lastTestedAt` timestamp
- Sync categories/tags from WordPress
- Push: title, contentHtml, slug, metaTitle, metaDescription, featuredImage, category, publishMode
- Update existing posts by `externalId`
- Error display: typed errors (invalid credentials, timeout, rate limit) with retry button

### 5. Custom API Connection

For headless CMS or custom backends.

- Fields: Base URL, auth type (API key / bearer), post endpoint, image endpoint
- Flexible field mapping: title, slug, content, excerpt, metaTitle, metaDescription, tags, category, featuredImage, status

### 6. Keyword Management

- CSV / XLSX drag & drop upload with column mapping UI
- Duplicate detection with warning
- Bulk actions: assign priority, change status, delete
- Filters: status, intent, priority, cluster
- Search + sorting on all columns

### 7. AI Template System

Per project:
- **Article prompt** — base generation instructions
- **Formatting prompt** — HTML structure, Gutenberg blocks, FAQ, CTA, headings, internal linking
- **Image prompt** — visual style for featured images

Prompts versioned. Previous versions accessible. Active flag per template.

### 8. Content Calendar

Integrated in Articles page and Dashboard:
- Calendar view (monthly) showing articles by `publishAt` date
- Drag articles to reschedule (updates `publishAt` + status → SCHEDULED)
- Color-coded by status
- Filter by project

### 9. Rate Limiting & Cost Protection

Per workspace:
- `monthlyGenLimit` — max article generations per month (default: 100)
- `WorkspaceUsage` tracks articleCount + imageCount + estimatedCost per month
- Worker checks limit before processing job → if exceeded: job fails with `RATE_LIMIT_REACHED`
- UI shows usage meter in Settings: "47 / 100 articles this month"
- Admin can adjust limit per workspace

### 10. Error Visibility

Every failed job shows:
- Typed error message (not just "FAILED")
- `errorType` maps to human-readable explanation: "WordPress credentials invalid — check Application Password"
- Retry button (re-enqueues job)
- `attempts` counter shown
- `lastSyncAt` for connection health

### 11. Customer Dashboard

Read-only. Premium feel. Shows:
- Keyword roadmap (status overview)
- Article progress (counts by status)
- Content calendar (published + scheduled)
- Published URLs with dates
- Monthly report summary

---

## UI Design System

**Palette:** zinc/slate/neutral — no gradients, no neon colors
**Cards:** rounded-xl, subtle border (zinc-200), soft shadow (shadow-sm)
**Typography:** Inter, tight tracking for headings, generous line-height for body
**Spacing:** 8px grid, generous whitespace
**Animations:** subtle only — fade-in, skeleton shimmer, sidebar collapse transition

**Components:**
- `DashboardShell` — sidebar + topbar wrapper
- `Sidebar` — collapsible, icons + labels, active indicator, smooth transition
- `Topbar` — cmd+k global search, notifications, user menu, project switcher
- `DataTable` — sticky header, bulk select, filters, pagination, loading skeleton
- `StatusBadge` — color-coded per status enum
- `EmptyState` — illustrated, with primary CTA
- `LoadingSkeleton` — every data-fetching view has one
- `UsageMeter` — workspace generation usage bar
- `ContentCalendar` — monthly calendar with article cards

---

## Background Jobs (BullMQ)

Three queues:
- `article-generation` — Claude API call, returns contentHtml + contentMarkdown + SEO meta
- `image-generation` — Image API call, optimizes with sharp, saves temp file, returns path
- `publish` — WordPress/Custom API push, uploads image, updates Article.externalId + url, clears temp image

Job retry: 3 attempts with exponential backoff. Error type stored on failure. UI shows typed error + retry button.

---

## Performance

- Server Actions for all mutations — no separate API layer overhead
- SWR for client-side data fetching with optimistic updates — SSE upgrade in V2
- Prisma query optimization: select only needed fields, pagination everywhere
- Redis caching for frequently read data (project list, user session)
- Loading skeletons on every page — no layout shift
- Lazy loading for heavy components (article editor, calendar)
- sharp.js for image optimization before any push

---

## Deployment

```yaml
# docker-compose.prod.yml (simplified)
services:
  web:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
    depends_on: [postgres, redis]
    volumes:
      - /tmp/blogplanner:/tmp/blogplanner   # shared temp image storage

  worker:
    build: .
    command: node worker/index.js
    env_file: .env.production
    depends_on: [postgres, redis]
    volumes:
      - /tmp/blogplanner:/tmp/blogplanner   # same temp volume

  postgres:
    image: postgres:16
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
```

nginx config: `proxy_pass http://127.0.0.1:3000` for `blogwerk.astro-it.de`. SSL via existing Certbot setup.

**Deploy workflow:**
```bash
git push origin main
./deploy.sh   # ssh → docker compose pull + up -d --build
```

---

## Out of Scope (V1)

- Billing / Stripe integration
- OAuth login (Google, GitHub) — credentials only
- Email notifications
- Multi-workspace — single workspace, multiple projects
- Mobile app
- Search Console UI — DB prepared, UI in V2
- SSE / WebSocket — SWR polling sufficient for V1
- Internal linking automation — fields prepared, logic in V2
