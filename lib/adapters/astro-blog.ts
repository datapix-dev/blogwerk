import type { ContentBlock } from "@/lib/ai/claude"

type AstroBlock = Record<string, unknown>

export function transformBlocksToAstro(blocks: ContentBlock[]): AstroBlock[] {
  return blocks.flatMap((block): AstroBlock[] => {
    switch (block.type) {
      case "paragraph":
        return [{ type: "paragraph", text: block.content }]

      case "heading":
        return [{ type: "heading", level: block.level, text: block.content }]

      case "tldr":
        return [{ type: "tldr", text: block.content }]

      case "key_takeaways":
        return [{ type: "key_takeaways", items: block.items }]

      case "statistics":
        return [{
          type: "statistics",
          items: block.items.map(item => ({
            value: item.stat,
            label: item.stat,
            description: item.context,
          })),
        }]

      case "quote":
        return [{
          type: "quote",
          text: block.content,
          author: block.attribution ?? "",
        }]

      case "comparison_table":
        return [{
          type: "comparison_table",
          title: "",
          columns: block.headers,
          rows: block.rows,
        }]

      case "pros_cons":
        return [{ type: "pros_cons", pros: block.pros, cons: block.cons }]

      case "checklist":
        return [{
          type: "checklist",
          title: block.title ?? "",
          items: block.items,
        }]

      case "faq":
        return [{ type: "faq", items: block.items }]

      case "warning":
        return [{ type: "note", variant: "warning", text: block.content }]

      case "best_practices":
        return [{
          type: "best_practices",
          title: "Best Practices",
          items: block.items,
        }]

      case "cta":
        return [{
          type: "cta",
          headline: block.text,
          subtext: block.subtext ?? "",
          buttonText: "",
          buttonAction: "",
        }]

      case "sources":
        return [{
          type: "citation",
          title: "Quellen",
          items: block.items,
        }]

      case "steps":
        return [{
          type: "how_to",
          steps: block.items.map(s => ({ title: s.title, text: s.description })),
        }]
    }
  })
}
