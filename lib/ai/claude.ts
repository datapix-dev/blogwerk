import Anthropic from "@anthropic-ai/sdk"
import { jsonrepair } from "jsonrepair"
import { buildSystemPrompt, buildUserPrompt, buildAdaptationSystemPrompt, buildAdaptationUserPrompt } from "./prompts"

export interface FaqSuggestion { question: string; answer: string }
export interface InternalLinkSuggestion { anchorText: string; suggestedTopic: string }
export interface CtaSuggestion { position: string; text: string }

export interface AdaptArticleParams {
  contentMarkdown: string
  adaptationTemplate: string
  keyword: string
  language: string
  faqSuggestions?: FaqSuggestion[]
  internalLinkSuggestions?: InternalLinkSuggestion[]
  ctaSuggestions?: CtaSuggestion[]
  apiKey?: string
}

export interface AdaptedArticle {
  contentHtml: string
  contentMarkdown: string
}

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
  contentHtml: string
  contentMarkdown: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  tags: string[]
  faqSuggestions: FaqSuggestion[]
  internalLinkSuggestions: InternalLinkSuggestion[]
  ctaSuggestions: CtaSuggestion[]
}

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

  for (const field of ["title", "slug", "contentMarkdown", "metaTitle", "metaDescription", "excerpt"]) {
    if (!parsed[field] || typeof parsed[field] !== "string") {
      throw new Error(`Missing or invalid field in Claude response: ${field}`)
    }
  }

  // contentHtml is optional in Phase 1 — fall back to empty string if not provided
  const contentHtml = typeof parsed.contentHtml === "string" ? parsed.contentHtml : ""

  return {
    title: parsed.title as string,
    slug: parsed.slug as string,
    contentHtml,
    contentMarkdown: parsed.contentMarkdown as string,
    metaTitle: parsed.metaTitle as string,
    metaDescription: parsed.metaDescription as string,
    excerpt: parsed.excerpt as string,
    tags: parseArray<string>(parsed.tags).filter((t) => typeof t === "string"),
    faqSuggestions: parseArray<FaqSuggestion>(parsed.faqSuggestions),
    internalLinkSuggestions: parseArray<InternalLinkSuggestion>(parsed.internalLinkSuggestions),
    ctaSuggestions: parseArray<CtaSuggestion>(parsed.ctaSuggestions),
  }
}

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
