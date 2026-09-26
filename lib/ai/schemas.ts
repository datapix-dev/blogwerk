// JSON Schemas for structured outputs (`output_config.format`).
//
// Only the adaptation phase uses one. Article and editorial output a union of
// 15 block types, which exceeds the structured-output grammar limit (400
// "compiled grammar is too large"; a flattened single block shape is rejected
// as "too complex"). Their JSON contract lives in the system prompts instead.
//
// Rules for structured outputs: every object needs `additionalProperties: false`
// and an explicit `required` list.

type JsonSchema = Record<string, unknown>

function obj(properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false }
}

const str: JsonSchema = { type: "string" }

// ─── Phase 2: template rendering ──────────────────────────────────────────────

export const ADAPTATION_FORMAT = {
  type: "json_schema" as const,
  schema: obj({ contentHtml: str, contentMarkdown: str }, ["contentHtml", "contentMarkdown"]),
}
