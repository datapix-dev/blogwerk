// JSON Schemas for structured outputs (`output_config.format`).
//
// These mirror the TypeScript block interfaces in ./claude.ts and the block
// reference in ./prompts.ts. Constraining the model at the API level is what
// lets us drop the "parse, repair, hope" path: the response is either
// schema-valid or the request fails loudly.
//
// Rules for structured outputs: every object needs `additionalProperties: false`
// and an explicit `required` list.

type JsonSchema = Record<string, unknown>

function obj(properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false }
}

const str: JsonSchema = { type: "string" }
const strArray: JsonSchema = { type: "array", items: { type: "string" } }

// ─── Content blocks ───────────────────────────────────────────────────────────

const BLOCK_VARIANTS: JsonSchema[] = [
  obj({ type: { const: "paragraph" }, content: str }, ["type", "content"]),
  obj({ type: { const: "heading" }, level: { type: "integer", enum: [2, 3] }, content: str }, ["type", "level", "content"]),
  obj({ type: { const: "tldr" }, content: str }, ["type", "content"]),
  obj({ type: { const: "key_takeaways" }, items: strArray }, ["type", "items"]),
  // statistics and quote carry their grounding inline — see GROUNDING RULES in
  // prompts.ts. A stat without a source URL is the exact failure we are closing.
  obj(
    {
      type: { const: "statistics" },
      items: {
        type: "array",
        items: obj({ stat: str, context: str, sourceTitle: str, sourceUrl: str }, ["stat", "context", "sourceTitle", "sourceUrl"]),
      },
    },
    ["type", "items"],
  ),
  obj({ type: { const: "quote" }, content: str, attribution: str, sourceUrl: str }, ["type", "content", "attribution", "sourceUrl"]),
  obj(
    {
      type: { const: "comparison_table" },
      headers: strArray,
      rows: { type: "array", items: strArray },
    },
    ["type", "headers", "rows"],
  ),
  obj({ type: { const: "pros_cons" }, pros: strArray, cons: strArray }, ["type", "pros", "cons"]),
  obj({ type: { const: "checklist" }, title: str, items: strArray }, ["type", "title", "items"]),
  obj(
    {
      type: { const: "faq" },
      items: { type: "array", items: obj({ question: str, answer: str }, ["question", "answer"]) },
    },
    ["type", "items"],
  ),
  obj({ type: { const: "warning" }, content: str }, ["type", "content"]),
  obj({ type: { const: "best_practices" }, items: strArray }, ["type", "items"]),
  obj({ type: { const: "cta" }, text: str, subtext: str }, ["type", "text", "subtext"]),
  obj(
    {
      type: { const: "sources" },
      items: { type: "array", items: obj({ title: str, url: str }, ["title", "url"]) },
    },
    ["type", "items"],
  ),
  obj(
    {
      type: { const: "steps" },
      items: { type: "array", items: obj({ title: str, description: str }, ["title", "description"]) },
    },
    ["type", "items"],
  ),
]

const BLOCKS_ARRAY: JsonSchema = {
  type: "array",
  minItems: 1,
  items: { anyOf: BLOCK_VARIANTS },
}

const INTERNAL_LINKS: JsonSchema = {
  type: "array",
  items: obj({ anchorText: str, suggestedTopic: str }, ["anchorText", "suggestedTopic"]),
}

// ─── Phase 1: article composition ─────────────────────────────────────────────

export const ARTICLE_FORMAT = {
  type: "json_schema" as const,
  schema: obj(
    {
      title: str,
      slug: { type: "string", maxLength: 60 },
      blocks: BLOCKS_ARRAY,
      metaTitle: { type: "string", maxLength: 60 },
      metaDescription: { type: "string", minLength: 120, maxLength: 160 },
      excerpt: str,
      tags: strArray,
      internalLinkSuggestions: INTERNAL_LINKS,
    },
    ["title", "slug", "blocks", "metaTitle", "metaDescription", "excerpt", "tags", "internalLinkSuggestions"],
  ),
}

// ─── Phase 1.5: editorial enhancement ─────────────────────────────────────────

export const EDITORIAL_FORMAT = {
  type: "json_schema" as const,
  schema: obj(
    {
      blocks: BLOCKS_ARRAY,
      editorialChanges: {
        type: "array",
        items: obj(
          {
            blockIndex: { type: "integer" },
            changeType: {
              type: "string",
              enum: ["expertise_enhancement", "generic_reduction", "nuance_added", "cta_improved", "example_added"],
            },
            summary: str,
          },
          ["blockIndex", "changeType", "summary"],
        ),
      },
    },
    ["blocks", "editorialChanges"],
  ),
}

// ─── Phase 2: template rendering ──────────────────────────────────────────────

export const ADAPTATION_FORMAT = {
  type: "json_schema" as const,
  schema: obj({ contentHtml: str, contentMarkdown: str }, ["contentHtml", "contentMarkdown"]),
}
