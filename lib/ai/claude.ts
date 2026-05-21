import Anthropic from "@anthropic-ai/sdk"
import { jsonrepair } from "jsonrepair"
import { buildSystemPrompt, buildUserPrompt, buildAdaptationSystemPrompt, buildAdaptationUserPrompt, buildEditorialSystemPrompt, buildEditorialUserPrompt } from "./prompts"

// ─── Content Block Types ──────────────────────────────────────────────────────

export interface ParagraphBlock       { type: "paragraph";        content: string }
export interface HeadingBlock         { type: "heading";          level: 2 | 3; content: string }
export interface TldrBlock            { type: "tldr";             content: string }
export interface KeyTakeawaysBlock    { type: "key_takeaways";    items: string[] }
export interface StatisticsBlock      { type: "statistics";       items: { stat: string; context: string }[] }
export interface QuoteBlock           { type: "quote";            content: string; attribution?: string }
export interface ComparisonTableBlock { type: "comparison_table"; headers: string[]; rows: string[][] }
export interface ProsConsBlock        { type: "pros_cons";        pros: string[]; cons: string[] }
export interface ChecklistBlock       { type: "checklist";        title?: string; items: string[] }
export interface FaqBlock             { type: "faq";              items: { question: string; answer: string }[] }
export interface WarningBlock         { type: "warning";          content: string }
export interface BestPracticesBlock   { type: "best_practices";   items: string[] }
export interface CtaBlock             { type: "cta";              text: string; subtext?: string }
export interface SourcesBlock         { type: "sources";          items: { title: string; url?: string }[] }
export interface StepsBlock           { type: "steps";            items: { title: string; description: string }[] }

export type ContentBlock =
  | ParagraphBlock | HeadingBlock | TldrBlock | KeyTakeawaysBlock
  | StatisticsBlock | QuoteBlock | ComparisonTableBlock | ProsConsBlock
  | ChecklistBlock | FaqBlock | WarningBlock | BestPracticesBlock
  | CtaBlock | SourcesBlock | StepsBlock

// ─── Block → Markdown ─────────────────────────────────────────────────────────

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph":
        return block.content
      case "heading":
        return `${"#".repeat(block.level)} ${block.content}`
      case "tldr":
        return `> **TL;DR:** ${block.content}`
      case "key_takeaways":
        return `**Key Takeaways:**\n${block.items.map(i => `- ${i}`).join("\n")}`
      case "statistics":
        return block.items.map(s => `**${s.stat}** — ${s.context}`).join("\n\n")
      case "quote":
        return `> ${block.content}${block.attribution ? `\n> — *${block.attribution}*` : ""}`
      case "comparison_table": {
        const head = `| ${block.headers.join(" | ")} |`
        const sep = `| ${block.headers.map(() => "---").join(" | ")} |`
        const rows = block.rows.map(r => `| ${r.join(" | ")} |`).join("\n")
        return `${head}\n${sep}\n${rows}`
      }
      case "pros_cons":
        return `**Pros:**\n${block.pros.map(p => `- ${p}`).join("\n")}\n\n**Cons:**\n${block.cons.map(c => `- ${c}`).join("\n")}`
      case "checklist": {
        const title = block.title ? `**${block.title}**\n\n` : ""
        return `${title}${block.items.map(i => `- [ ] ${i}`).join("\n")}`
      }
      case "faq":
        return block.items.map(f => `**${f.question}**\n\n${f.answer}`).join("\n\n")
      case "warning":
        return `> ⚠️ **Warning:** ${block.content}`
      case "best_practices":
        return `**Best Practices:**\n${block.items.map(i => `- ${i}`).join("\n")}`
      case "cta":
        return `**${block.text}**${block.subtext ? `\n\n${block.subtext}` : ""}`
      case "sources":
        return `**Sources:**\n${block.items.map(s => s.url ? `- [${s.title}](${s.url})` : `- ${s.title}`).join("\n")}`
      case "steps":
        return block.items.map((s, i) => `**${i + 1}. ${s.title}**\n\n${s.description}`).join("\n\n")
    }
  }).join("\n\n")
}

// ─── Block → HTML ─────────────────────────────────────────────────────────────

export function blocksToHtml(blocks: ContentBlock[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph":
        return `<p>${block.content}</p>`
      case "heading":
        return `<h${block.level}>${block.content}</h${block.level}>`
      case "tldr":
        return `<blockquote><strong>TL;DR:</strong> ${block.content}</blockquote>`
      case "key_takeaways":
        return `<ul>${block.items.map(i => `<li>${i}</li>`).join("")}</ul>`
      case "statistics":
        return `<ul>${block.items.map(s => `<li><strong>${s.stat}</strong> — ${s.context}</li>`).join("")}</ul>`
      case "quote":
        return `<blockquote><p>${block.content}</p>${block.attribution ? `<cite>— ${block.attribution}</cite>` : ""}</blockquote>`
      case "comparison_table": {
        const head = `<thead><tr>${block.headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`
        const body = `<tbody>${block.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`
        return `<table>${head}${body}</table>`
      }
      case "pros_cons":
        return [
          `<ul>${block.pros.map(p => `<li>✓ ${p}</li>`).join("")}</ul>`,
          `<ul>${block.cons.map(c => `<li>✗ ${c}</li>`).join("")}</ul>`,
        ].join("\n")
      case "checklist":
        return `<ul>${block.items.map(i => `<li>${i}</li>`).join("")}</ul>`
      case "faq":
        return block.items.map(f => `<h3>${f.question}</h3><p>${f.answer}</p>`).join("\n")
      case "warning":
        return `<blockquote><strong>⚠️ Warning:</strong> ${block.content}</blockquote>`
      case "best_practices":
        return `<ul>${block.items.map(i => `<li>${i}</li>`).join("")}</ul>`
      case "cta":
        return `<p><strong>${block.text}</strong>${block.subtext ? `<br>${block.subtext}` : ""}</p>`
      case "sources":
        return `<ul>${block.items.map(s => s.url ? `<li><a href="${s.url}">${s.title}</a></li>` : `<li>${s.title}</li>`).join("")}</ul>`
      case "steps":
        return `<ol>${block.items.map(s => `<li><strong>${s.title}</strong><p>${s.description}</p></li>`).join("")}</ol>`
    }
  }).join("\n")
}

// ─── Remaining suggestion types (internal links only — FAQ/CTA are now blocks) ─

export interface InternalLinkSuggestion { anchorText: string; suggestedTopic: string }

// ─── Legacy types kept for backward compat (old articles may have them in DB) ─
export interface FaqSuggestion  { question: string; answer: string }
export interface CtaSuggestion  { position: string; text: string }

// ─── Editorial Enhancement Types ─────────────────────────────────────────────

export interface EnhanceArticleParams {
  blocks: ContentBlock[]
  keyword: string
  language: string
  intent?: string | null
  targetAudience?: string | null
  toneOfVoice?: string | null
  editorialBrain: string
  apiKey?: string
}

export interface EditorialChange {
  blockIndex: number
  changeType: string
  summary: string
}

export interface EnhancedArticle {
  blocks: ContentBlock[]
  editorialChanges: EditorialChange[]
}

// ─── Generation ───────────────────────────────────────────────────────────────

export interface GenerateArticleParams {
  keyword: string
  projectName: string
  language: string
  targetAudience?: string | null
  toneOfVoice?: string | null
  searchVolume?: number | null
  difficulty?: number | null
  intent?: string | null
  cluster?: string | null
  customPromptTemplate?: string | null
  apiKey?: string
}

export interface GeneratedArticle {
  title: string
  slug: string
  blocks: ContentBlock[]
  contentHtml: string     // derived from blocks via blocksToHtml()
  contentMarkdown: string // derived from blocks via blocksToMarkdown()
  metaTitle: string
  metaDescription: string
  excerpt: string
  tags: string[]
  internalLinkSuggestions: InternalLinkSuggestion[]
}

// ─── Adaptation ───────────────────────────────────────────────────────────────

export interface AdaptArticleParams {
  blocks: ContentBlock[]
  contentMarkdown: string  // fallback when blocks is empty (old articles)
  adaptationTemplate: string
  keyword: string
  language: string
  internalLinkSuggestions?: InternalLinkSuggestion[]
  apiKey?: string
}

export interface AdaptedArticle {
  contentHtml: string
  contentMarkdown: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function parseArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : []
}

// ─── generateArticle ─────────────────────────────────────────────────────────

export async function generateArticle(
  params: GenerateArticleParams
): Promise<GeneratedArticle> {
  const client = new Anthropic({ apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: buildSystemPrompt(params.intent),
    messages: [{ role: "user", content: buildUserPrompt(params) }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== "text") throw new Error("Unexpected response type from Claude API")

  const cleaned = stripJsonFences(rawContent.text)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonrepair(cleaned))
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${cleaned.slice(0, 200)}`)
  }

  for (const field of ["title", "slug", "metaTitle", "metaDescription", "excerpt"]) {
    if (!parsed[field] || typeof parsed[field] !== "string") {
      throw new Error(`Missing or invalid field in Claude response: ${field}`)
    }
  }

  const blocks = parseArray<ContentBlock>(parsed.blocks)
  if (!blocks.length) {
    throw new Error("Claude response contains no content blocks")
  }

  return {
    title: parsed.title as string,
    slug: parsed.slug as string,
    blocks,
    contentMarkdown: blocksToMarkdown(blocks),
    contentHtml: blocksToHtml(blocks),
    metaTitle: parsed.metaTitle as string,
    metaDescription: parsed.metaDescription as string,
    excerpt: parsed.excerpt as string,
    tags: parseArray<string>(parsed.tags).filter((t) => typeof t === "string"),
    internalLinkSuggestions: parseArray<InternalLinkSuggestion>(parsed.internalLinkSuggestions),
  }
}

// ─── adaptArticle ─────────────────────────────────────────────────────────────

export async function adaptArticle(params: AdaptArticleParams): Promise<AdaptedArticle> {
  const client = new Anthropic({ apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: buildAdaptationSystemPrompt(),
    messages: [{ role: "user", content: buildAdaptationUserPrompt(params) }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== "text") throw new Error("Unexpected response type from Claude API")

  const cleaned = stripJsonFences(rawContent.text)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonrepair(cleaned))
  } catch {
    throw new Error(`Failed to parse Claude adaptation response: ${cleaned.slice(0, 200)}`)
  }

  if (!parsed.contentHtml || typeof parsed.contentHtml !== "string") {
    throw new Error("Missing contentHtml in Claude adaptation response")
  }
  if (!parsed.contentMarkdown || typeof parsed.contentMarkdown !== "string") {
    throw new Error("Missing contentMarkdown in Claude adaptation response")
  }

  return {
    contentHtml: parsed.contentHtml as string,
    contentMarkdown: parsed.contentMarkdown as string,
  }
}

// ─── enhanceArticle ───────────────────────────────────────────────────────────

export async function enhanceArticle(params: EnhanceArticleParams): Promise<EnhancedArticle> {
  const client = new Anthropic({ apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: buildEditorialSystemPrompt(params.editorialBrain),
    messages: [{ role: "user", content: buildEditorialUserPrompt(params) }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== "text") throw new Error("Unexpected response type from Claude API")

  const cleaned = stripJsonFences(rawContent.text)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonrepair(cleaned))
  } catch {
    throw new Error(`Failed to parse Claude editorial response: ${cleaned.slice(0, 200)}`)
  }

  const blocks = parseArray<ContentBlock>(parsed.blocks)
  if (!blocks.length) {
    throw new Error("Claude editorial response contains no blocks")
  }

  return {
    blocks,
    editorialChanges: parseArray<EditorialChange>(parsed.editorialChanges),
  }
}
