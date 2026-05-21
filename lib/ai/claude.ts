import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt, buildUserPrompt } from "./prompts"

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
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

// Escape literal newlines/tabs inside JSON string values so JSON.parse succeeds
// when Claude emits multi-line HTML/markdown within a string field.
function fixUnescapedControlChars(raw: string): string {
  let inString = false
  let escaped = false
  let out = ""
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (escaped) { out += c; escaped = false; continue }
    if (c === "\\") { escaped = true; out += c; continue }
    if (c === '"') { inString = !inString; out += c; continue }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue }
      if (c === "\r") { out += "\\r"; continue }
      if (c === "\t") { out += "\\t"; continue }
    }
    out += c
  }
  return out
}

export async function generateArticle(
  params: GenerateArticleParams
): Promise<GeneratedArticle> {
  const client = new Anthropic({ apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY })
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(params)

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== "text") {
    throw new Error("Unexpected response type from Claude API")
  }

  if (message.stop_reason === "max_tokens") {
    console.warn(`[claude] Response truncated at max_tokens (${rawContent.text.length} chars)`)
  }

  const cleaned = stripJsonFences(rawContent.text)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(fixUnescapedControlChars(cleaned))
  } catch (parseErr) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
    const posMatch = errMsg.match(/position (\d+)/)
    const pos = posMatch ? parseInt(posMatch[1]) : -1
    console.error(`[claude] JSON parse error: ${errMsg}`)
    if (pos >= 0) {
      const fixed = fixUnescapedControlChars(cleaned)
      console.error(`[claude] Context at pos ${pos}: ...${JSON.stringify(fixed.slice(Math.max(0, pos - 50), pos + 50))}...`)
    }
    throw new Error(`Failed to parse Claude response as JSON: ${cleaned.slice(0, 200)}`)
  }

  const required = [
    "title",
    "slug",
    "contentHtml",
    "contentMarkdown",
    "metaTitle",
    "metaDescription",
    "excerpt",
  ]
  for (const field of required) {
    if (!parsed[field] || typeof parsed[field] !== "string") {
      throw new Error(`Missing or invalid field in Claude response: ${field}`)
    }
  }

  return {
    title: parsed.title as string,
    slug: parsed.slug as string,
    contentHtml: parsed.contentHtml as string,
    contentMarkdown: parsed.contentMarkdown as string,
    metaTitle: parsed.metaTitle as string,
    metaDescription: parsed.metaDescription as string,
    excerpt: parsed.excerpt as string,
    tags: Array.isArray(parsed.tags)
      ? (parsed.tags as string[]).filter((t) => typeof t === "string")
      : [],
  }
}
