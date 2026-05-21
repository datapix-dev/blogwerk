# BlogPlanner — Design Spec
_2026-05-21_

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

**User** — email, password (hashed), role, workspace assignment
**Project** — name, client, blogUrl, language, tone, status + assignments
**ProjectAssignment** — userId × projectId join table
**Keyword** — keyword, volume, difficulty, intent, priority, cluster, status
**Article** — full article fields, status lifecycle, external publish ID
**PromptTemplate** — article / formatting / image prompts, versioned
**ApiConnection** — WordPress or Custom API config (JSON, encrypted at rest)
**GenerationJob** — tracks async jobs (article gen, image gen, publish)
**ActivityLog** — audit trail for all actions

### Key Enums

```
Role:          ADMIN | PROJECT_MANAGER | EDITOR | CUSTOMER
ArticleStatus: DRAFT | AI_GENERATED | NEEDS_REVIEW | APPROVED | SCHEDULED | PUBLISHED | FAILED
KeywordStatus: OPEN | PLANNED | IN_PROGRESS | GENERATED | PUBLISHED
JobType:       ARTICLE_GENERATION | IMAGE_GENERATION | PUBLISH
ConnectionType: WORDPRESS | CUSTOM_API
```

---

## Auth & Roles

**Provider:** NextAuth.js v5, Credentials (email + password, bcrypt). Role stored in JWT + session — no extra DB call per request.

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
  → Server Action: create Article (DRAFT) + GenerationJob (PENDING)
  → Enqueue BullMQ job in Redis
  → Worker: Claude API → article content + SEO meta
  → Worker: Image API → featured image
  → Job → COMPLETED, Article → AI_GENERATED
  → Client polls via SWR (3s interval) or SSE
  → User edits → NEEDS_REVIEW → APPROVED
  → Publish → new PUBLISH job → WordPress / Custom API
```

**AI Provider:** Anthropic Claude (claude-sonnet-4-6 default, configurable per project to claude-opus-4-7 for higher quality).

### 2. WordPress Integration

Dedicated connection UI — not treated as generic API.

- Fields: WordPress URL, Username, Application Password, default author, category, publish status
- "Test Connection" button with live feedback
- Sync categories/tags from WordPress
- Push: title, content, slug, meta title/description, featured image, category, status
- Update existing posts by external ID

### 3. Custom API Connection

For headless CMS or custom backends.

- Fields: Base URL, auth type (API key / bearer), post endpoint, image endpoint
- Flexible field mapping: title, slug, content, excerpt, metaTitle, metaDescription, tags, category, featuredImage, status

### 4. Keyword Management

- CSV / XLSX drag & drop upload with column mapping UI
- Duplicate detection with warning
- Bulk actions: assign priority, change status, delete
- Filters: status, intent, priority, cluster
- Search + sorting on all columns

### 5. AI Template System

Per project:
- **Article prompt** — base generation instructions
- **Formatting prompt** — HTML structure, Gutenberg blocks, FAQ, CTA, headings, internal linking
- **Image prompt** — visual style for featured images

Prompts are versioned. Previous versions accessible. Active flag per template.

### 6. Image Generation

Providers (configurable per project):
- Nano Banana
- Google AI Studio
- OpenAI DALL-E

Features: generate, regenerate, prompt history, upload custom image. Runs as background job.

### 7. Customer Dashboard

Read-only. Premium feel. Shows:
- Keyword roadmap (status overview)
- Article progress (counts by status)
- Publishing calendar
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

---

## Background Jobs (BullMQ)

Three queues:
- `article-generation` — Claude API call, returns structured article JSON
- `image-generation` — Image API call, uploads to storage, returns URL
- `publish` — WordPress/Custom API push, updates Article.externalId

Job retry: 3 attempts with exponential backoff. Failed jobs → Article status FAILED + error stored in GenerationJob.error. UI shows error message with "Retry" button.

---

## Performance

- Server Actions for all mutations (no separate API layer overhead)
- SWR for client-side data fetching with optimistic updates
- Prisma query optimization: select only needed fields, pagination everywhere
- Redis caching for frequently read data (project list, user session)
- Loading skeletons on every page — no layout shift
- Lazy loading for heavy components (article editor, image gallery)

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

  worker:
    build: .
    command: node worker/index.js
    env_file: .env.production
    depends_on: [postgres, redis]

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

## Out of Scope (v1)

- Billing / Stripe integration
- OAuth login (Google, GitHub) — credentials only for now
- Email notifications
- Multi-workspace (single workspace, multiple projects)
- Mobile app
