import type { GenerateArticleParams } from "./claude"

export function buildSystemPrompt(): string {
  return `You are an expert SEO content writer who produces high-quality, engaging articles.

CRITICAL: You MUST respond ONLY with a valid JSON object. No markdown fences, no prose, no explanation. Just JSON.

The JSON must have exactly these fields:
{
  "title": "string — the article title",
  "slug": "string — URL-friendly slug (lowercase, hyphens, no special chars)",
  "contentHtml": "string — full article HTML content (NO <html>/<head>/<body> wrappers)",
  "contentMarkdown": "string — full article in Markdown",
  "metaTitle": "string — SEO meta title (max 60 chars)",
  "metaDescription": "string — SEO meta description (140–160 chars)",
  "excerpt": "string — 2–3 sentence article summary",
  "tags": ["array", "of", "relevant", "tag", "strings"]
}

HTML rules:
- Use only: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>
- No <h1> (title is separate), no <html>/<head>/<body>/<div>/<span>
- WordPress-compatible block HTML only
- Include 4–8 headings for structure

Content rules:
- Minimum 800 words of content
- Include practical examples and actionable advice
- Naturally integrate the keyword 3–5 times
- Write in the specified language`
}

export function buildUserPrompt(params: GenerateArticleParams): string {
  const lines: string[] = [
    `Write a comprehensive SEO article for the following keyword:`,
    ``,
    `Keyword: ${params.keyword}`,
    `Language: ${params.language}`,
    `Project: ${params.projectName}`,
  ]

  if (params.targetAudience) {
    lines.push(`Target Audience: ${params.targetAudience}`)
  }
  if (params.toneOfVoice) {
    lines.push(`Tone of Voice: ${params.toneOfVoice}`)
  }
  if (params.intent) {
    lines.push(`Search Intent: ${params.intent}`)
  }
  if (params.searchVolume != null) {
    lines.push(`Search Volume: ${params.searchVolume.toLocaleString()}`)
  }
  if (params.difficulty != null) {
    lines.push(`Keyword Difficulty: ${params.difficulty}/100`)
  }
  if (params.cluster) {
    lines.push(`Topic Cluster: ${params.cluster}`)
  }

  if (params.customPromptTemplate) {
    lines.push(``, `Additional Instructions:`, params.customPromptTemplate)
  }

  lines.push(
    ``,
    `Remember: Respond ONLY with the JSON object. No markdown fences, no explanation.`
  )

  return lines.join("\n")
}
