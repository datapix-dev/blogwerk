import type { ContentBlock, FaqBlock, StepsBlock, SourcesBlock } from "../ai/claude"

// Schema.org JSON-LD built from the blocks we already generate.
//
// The data was always there — faq blocks are a FAQPage, steps blocks are a
// HowTo — it just never left the system. These are the two formats AI
// Overviews and answer engines quote from most readily.

export interface JsonLdInput {
  title: string
  slug: string
  excerpt: string
  blocks: ContentBlock[]
  blogUrl: string
  language: string
  publisherName: string
  authorName: string
  authorUrl?: string | null
  publishedAt: Date
  modifiedAt: Date
  featuredImage?: string | null
  imageAlt?: string | null
}

type Node = Record<string, unknown>

function articleUrl(blogUrl: string, slug: string): string {
  return `${blogUrl.replace(/\/+$/, "")}/blog/${slug}`
}

export function canonicalUrl(blogUrl: string, slug: string): string {
  return articleUrl(blogUrl, slug)
}

export function buildJsonLd(input: JsonLdInput): Node {
  const url = articleUrl(input.blogUrl, input.slug)
  const base = input.blogUrl.replace(/\/+$/, "")
  const graph: Node[] = []

  const author: Node = { "@type": "Person", name: input.authorName }
  if (input.authorUrl) author.url = input.authorUrl

  const article: Node = {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title.slice(0, 110), // Google ignores longer headlines
    description: input.excerpt,
    inLanguage: input.language,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author,
    publisher: { "@type": "Organization", name: input.publisherName },
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.modifiedAt.toISOString(),
  }

  if (input.featuredImage) {
    article.image = {
      "@type": "ImageObject",
      url: input.featuredImage,
      ...(input.imageAlt && { caption: input.imageAlt }),
    }
  }

  // Cited sources become citation entries — a direct trust signal for both
  // crawlers and answer engines.
  const sources = input.blocks.find((b): b is SourcesBlock => b.type === "sources")
  const cited = sources?.items.filter((s) => !!s.url) ?? []
  if (cited.length) {
    article.citation = cited.map((s) => ({
      "@type": "CreativeWork",
      name: s.title,
      url: s.url,
    }))
  }

  graph.push(article)

  const faq = input.blocks.find((b): b is FaqBlock => b.type === "faq")
  if (faq?.items.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      inLanguage: input.language,
      mainEntity: faq.items.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    })
  }

  const steps = input.blocks.find((b): b is StepsBlock => b.type === "steps")
  if (steps?.items.length) {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: input.title,
      inLanguage: input.language,
      step: steps.items.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: s.description,
      })),
    })
  }

  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Blog", item: `${base}/blog` },
      { "@type": "ListItem", position: 2, name: input.title, item: url },
    ],
  })

  return { "@context": "https://schema.org", "@graph": graph }
}
