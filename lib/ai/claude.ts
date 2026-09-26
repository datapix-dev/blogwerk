import Anthropic from "@anthropic-ai/sdk"
import { jsonrepair } from "jsonrepair"
import { buildSystemPrompt, buildUserPrompt, buildAdaptationSystemPrompt, buildAdaptationUserPrompt, buildEditorialSystemPrompt, buildEditorialUserPrompt } from "./prompts"
import { labelsFor } from "./i18n"
import { ADAPTATION_FORMAT } from "./schemas"

// ─── Model & request defaults ─────────────────────────────────────────────────

/**
 * Override per deployment via ANTHROPIC_MODEL. Defaults to the current
 * top-tier model; `claude-sonnet-5` is the cheaper option and is still both
 * newer and less expensive than the previously used `claude-sonnet-4-6`.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5"

/**
 * Thinking, search results and the full JSON article all count against this.
 * 16k was tight enough that a long article could be cut off mid-JSON — and
 * jsonrepair would then "fix" it into a silently truncated article. Requests
 * stream, so a large ceiling carries no timeout risk.
 */
const MAX_TOKENS = 64000

/** Resume limit for server-side tool loops that stop with `pause_turn`. */
const MAX_CONTINUATIONS = 3

/** Two-letter region hint for web search; shapes which sources surface. */
const SEARCH_COUNTRY = process.env.SEARCH_COUNTRY ?? "DE"

// ─── Content Block Types ──────────────────────────────────────────────────────

export interface ParagraphBlock       { type: "paragraph";        content: string }
export interface HeadingBlock         { type: "heading";          level: 2 | 3; content: string }
export interface TldrBlock            { type: "tldr";             content: string }
export interface KeyTakeawaysBlock    { type: "key_takeaways";    items: string[] }
export interface StatisticsBlock      { type: "statistics";       items: { stat: string; context: string; sourceTitle?: string; sourceUrl?: string }[] }
export interface QuoteBlock           { type: "quote";            content: string; attribution?: string; sourceUrl?: string }
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

export function blocksToMarkdown(blocks: ContentBlock[], language?: string | null): string {
  const L = labelsFor(language)
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph":
        return block.content
      case "heading":
        return `${"#".repeat(block.level)} ${block.content}`
      case "tldr":
        return `> **${L.tldr}:** ${block.content}`
      case "key_takeaways":
        return `**${L.keyTakeaways}:**\n${block.items.map(i => `- ${i}`).join("\n")}`
      case "statistics":
        return block.items.map(s => {
          const source = s.sourceUrl && s.sourceTitle ? ` ([${s.sourceTitle}](${s.sourceUrl}))` : ""
          return `**${s.stat}** — ${s.context}${source}`
        }).join("\n\n")
      case "quote":
        return `> ${block.content}${block.attribution ? `\n> — *${block.attribution}*` : ""}`
      case "comparison_table": {
        const head = `| ${block.headers.join(" | ")} |`
        const sep = `| ${block.headers.map(() => "---").join(" | ")} |`
        const rows = block.rows.map(r => `| ${r.join(" | ")} |`).join("\n")
        return `${head}\n${sep}\n${rows}`
      }
      case "pros_cons":
        return `**${L.pros}:**\n${block.pros.map(p => `- ${p}`).join("\n")}\n\n**${L.cons}:**\n${block.cons.map(c => `- ${c}`).join("\n")}`
      case "checklist": {
        const title = block.title ? `**${block.title}**\n\n` : ""
        return `${title}${block.items.map(i => `- [ ] ${i}`).join("\n")}`
      }
      case "faq":
        return block.items.map(f => `**${f.question}**\n\n${f.answer}`).join("\n\n")
      case "warning":
        return `> ⚠️ **${L.warning}:** ${block.content}`
      case "best_practices":
        return `**${L.bestPractices}:**\n${block.items.map(i => `- ${i}`).join("\n")}`
      case "cta":
        return `**${block.text}**${block.subtext ? `\n\n${block.subtext}` : ""}`
      case "sources":
        return `**${L.sources}:**\n${block.items.map(s => s.url ? `- [${s.title}](${s.url})` : `- ${s.title}`).join("\n")}`
      case "steps":
        return block.items.map((s, i) => `**${i + 1}. ${s.title}**\n\n${s.description}`).join("\n\n")
    }
  }).join("\n\n")
}

// ─── Block → HTML ─────────────────────────────────────────────────────────────

export function blocksToHtml(blocks: ContentBlock[], language?: string | null): string {
  const L = labelsFor(language)
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph":
        return `<p>${block.content}</p>`
      case "heading":
        return `<h${block.level}>${block.content}</h${block.level}>`
      case "tldr":
        return `<blockquote><strong>${L.tldr}:</strong> ${block.content}</blockquote>`
      case "key_takeaways":
        return `<ul>${block.items.map(i => `<li>${i}</li>`).join("")}</ul>`
      case "statistics":
        return `<ul>${block.items.map(s => {
          const source = s.sourceUrl && s.sourceTitle
            ? ` <cite><a href="${s.sourceUrl}" rel="nofollow noopener" target="_blank">${s.sourceTitle}</a></cite>`
            : ""
          return `<li><strong>${s.stat}</strong> — ${s.context}${source}</li>`
        }).join("")}</ul>`
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
        return `<blockquote><strong>⚠️ ${L.warning}:</strong> ${block.content}</blockquote>`
      case "best_practices":
        return `<h3>${L.bestPractices}</h3><ul>${block.items.map(i => `<li>${i}</li>`).join("")}</ul>`
      case "cta":
        return `<p><strong>${block.text}</strong>${block.subtext ? `<br>${block.subtext}` : ""}</p>`
      case "sources":
        return `<h3>${L.sources}</h3><ul>${block.items.map(s => s.url
          ? `<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${s.title}</a></li>`
          : `<li>${s.title}</li>`).join("")}</ul>`
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

/**
 * Pull the JSON payload out of a response.
 *
 * With server tools enabled the response interleaves `server_tool_use` and
 * `web_search_tool_result` blocks with text, and text that cites a search
 * result is split into several text blocks. The answer is therefore every
 * text block after the last tool block, joined — never content[0], and not
 * just the last text block.
 */
function extractPayloadText(content: Anthropic.ContentBlock[], phase: string): string {
  let lastTool = -1
  content.forEach((b, i) => { if (b.type !== "text" && b.type !== "thinking" && b.type !== "redacted_thinking") lastTool = i })
  const text = content
    .slice(lastTool + 1)
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
  if (!text.trim()) throw new Error(`No text block in Claude ${phase} response`)
  return stripJsonFences(text)
}

function parseJsonPayload(raw: string, phase: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    // Article and editorial run without structured outputs (grammar limit),
    // so this is the normal net for stray prose or a missing bracket.
    // Truncation never reaches here: runMessage throws on max_tokens.
    try {
      return JSON.parse(jsonrepair(raw)) as Record<string, unknown>
    } catch {
      throw new Error(`Failed to parse Claude ${phase} response as JSON: ${raw.slice(0, 200)}`)
    }
  }
}

/**
 * Stream a request to completion and refuse to hand back anything partial.
 *
 * - `pause_turn`: the server-side web search loop hit its iteration cap. The
 *   turn is resumed by re-sending it with the paused assistant content; the
 *   API picks up at the trailing server_tool_use block on its own.
 * - `max_tokens` / `refusal`: the JSON is incomplete or absent. Throwing here
 *   lets BullMQ retry, instead of jsonrepair closing the brackets on half an
 *   article and the pipeline publishing it.
 */
async function runMessage(
  client: Anthropic,
  params: Anthropic.MessageStreamParams,
  phase: string
): Promise<Anthropic.Message> {
  let messages = params.messages
  for (let attempt = 0; ; attempt++) {
    const message = await client.messages.stream({ ...params, messages }).finalMessage()

    if (message.stop_reason === "pause_turn" && attempt < MAX_CONTINUATIONS) {
      messages = [...messages, { role: "assistant", content: message.content }]
      continue
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error(`Claude ${phase} response hit max_tokens (${params.max_tokens}) — output truncated`)
    }
    if (message.stop_reason === "refusal") {
      throw new Error(`Claude declined the ${phase} request (${message.stop_details?.category ?? "no category"})`)
    }
    if (message.stop_reason === "pause_turn") {
      throw new Error(`Claude ${phase} response still paused after ${MAX_CONTINUATIONS} continuations`)
    }
    return message
  }
}

/** Cacheable system prompt block — the system prompt is identical per intent. */
function cachedSystem(text: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }]
}

// ─── generateArticle ─────────────────────────────────────────────────────────

export async function generateArticle(
  params: GenerateArticleParams
): Promise<GeneratedArticle> {
  const client = new Anthropic({ apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY })

  // Web search is what makes the grounding rules in the system prompt
  // enforceable: without it the model can only invent statistics, which is the
  // single biggest source of both hallucinated facts and generic-sounding copy.
  const message = await runMessage(client, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // No output_config.format here: the 15-variant block union exceeds the
    // structured-output grammar limit (400 "compiled grammar is too large", and
    // a flattened block is rejected as "too complex"). The JSON contract lives
    // in the system prompt; runMessage + parseJsonPayload guard the result.
    output_config: { effort: "high" },
    system: cachedSystem(buildSystemPrompt(params.intent)),
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 6,
        user_location: { type: "approximate", country: SEARCH_COUNTRY },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(params) }],
  }, "article")

  const parsed = parseJsonPayload(extractPayloadText(message.content, "article"), "article")

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
    contentMarkdown: blocksToMarkdown(blocks, params.language),
    contentHtml: blocksToHtml(blocks, params.language),
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

  // Pure rendering — no search, no thinking budget needed.
  const message = await runMessage(client, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "medium", format: ADAPTATION_FORMAT },
    system: cachedSystem(buildAdaptationSystemPrompt()),
    messages: [{ role: "user", content: buildAdaptationUserPrompt(params) }],
  }, "adaptation")

  const parsed = parseJsonPayload(extractPayloadText(message.content, "adaptation"), "adaptation")

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

  // The editorial pass may verify or add a fact, so it gets search too — but
  // fewer uses: its job is sharpening, not research.
  const message = await runMessage(client, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" }, // same grammar limit as generateArticle
    system: cachedSystem(buildEditorialSystemPrompt(params.editorialBrain)),
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 3,
        user_location: { type: "approximate", country: SEARCH_COUNTRY },
      },
    ],
    messages: [{ role: "user", content: buildEditorialUserPrompt(params) }],
  }, "editorial")

  const parsed = parseJsonPayload(extractPayloadText(message.content, "editorial"), "editorial")

  const blocks = parseArray<ContentBlock>(parsed.blocks)
  if (!blocks.length) {
    throw new Error("Claude editorial response contains no blocks")
  }

  return {
    blocks,
    editorialChanges: parseArray<EditorialChange>(parsed.editorialChanges),
  }
}
