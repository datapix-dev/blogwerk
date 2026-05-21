import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt, buildUserPrompt } from "./prompts"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

export async function generateArticle(
  params: GenerateArticleParams
): Promise<GeneratedArticle> {
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

  const cleaned = stripJsonFences(rawContent.text)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
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
