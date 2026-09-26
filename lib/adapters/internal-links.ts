import type { InternalLinkSuggestion } from "../ai/claude"

// Turns the model's internal-link *suggestions* (anchor text + a topic, never a
// URL — it is explicitly told not to invent one) into real links.
//
// Two sources of truth, both already in the database and both previously unused
// at publish time:
//   1. Keyword.targetUrl — URLs an editor mapped by hand
//   2. Articles this project already published — the growing cluster graph

export interface LinkTarget {
  url: string
  /** Primary keyword of the target page. */
  keyword: string
  cluster?: string | null
  title?: string | null
}

export interface ResolvedLink {
  anchorText: string
  url: string
}

const STOPWORDS = new Set([
  // de
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer",
  "und", "oder", "aber", "für", "von", "mit", "auf", "aus", "bei", "nach", "über",
  "was", "wie", "ist", "sind", "im", "in", "zu", "zum", "zur", "am", "an",
  // en
  "the", "a", "an", "and", "or", "but", "for", "of", "with", "on", "from", "at",
  "to", "in", "is", "are", "what", "how", "your", "you",
])

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  )
}

/** Overlap biased toward covering the shorter side. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / Math.min(a.size, b.size)
}

const MIN_SCORE = 0.5

export function resolveInternalLinks(
  suggestions: InternalLinkSuggestion[],
  targets: LinkTarget[],
  opts: { excludeUrl?: string | null; max?: number } = {},
): ResolvedLink[] {
  const max = opts.max ?? 5
  if (!suggestions.length || !targets.length) return []

  const candidates = targets
    .filter((t) => t.url && t.url !== opts.excludeUrl)
    .map((t) => ({
      target: t,
      tokens: tokenize([t.keyword, t.title ?? "", t.cluster ?? ""].join(" ")),
    }))

  const usedUrls = new Set<string>()
  const usedAnchors = new Set<string>()
  const resolved: ResolvedLink[] = []

  for (const suggestion of suggestions) {
    if (resolved.length >= max) break

    const anchor = suggestion.anchorText?.trim()
    if (!anchor) continue

    const anchorKey = anchor.toLowerCase()
    if (usedAnchors.has(anchorKey)) continue

    // The topic describes the destination; the anchor is how it is phrased in
    // the body. Both are signal, the topic more so.
    const topicTokens = tokenize(suggestion.suggestedTopic ?? "")
    const anchorTokens = tokenize(anchor)

    let best: { url: string; score: number } | null = null
    for (const c of candidates) {
      if (usedUrls.has(c.target.url)) continue
      const score = Math.max(
        similarity(topicTokens, c.tokens),
        similarity(anchorTokens, c.tokens) * 0.8,
      )
      if (score >= MIN_SCORE && (!best || score > best.score)) {
        best = { url: c.target.url, score }
      }
    }

    if (best) {
      resolved.push({ anchorText: anchor, url: best.url })
      usedUrls.add(best.url)
      usedAnchors.add(anchorKey)
    }
  }

  return resolved
}
