import fs from "fs/promises"
import path from "path"
import sharp from "sharp"

const IMAGE_DIR = "/tmp/blogplanner/images"

export async function ensureImageDir() {
  await fs.mkdir(IMAGE_DIR, { recursive: true })
}

export function getImagePath(articleId: string): string {
  return path.join(IMAGE_DIR, `${articleId}.webp`)
}

export async function imageFileExists(articleId: string): Promise<boolean> {
  try {
    await fs.access(getImagePath(articleId))
    return true
  } catch {
    return false
  }
}

async function optimizeAndSave(buffer: Buffer, articleId: string): Promise<string> {
  await ensureImageDir()
  const outPath = getImagePath(articleId)
  await sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outPath)
  return outPath
}

async function generateWithOpenAI(prompt: string, apiKey?: string): Promise<Buffer> {
  const key = apiKey ?? process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY not configured")

  // gpt-image-1 (2025+): no response_format, returns b64_json by default
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`OpenAI images API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as { data: { b64_json: string }[] }
  return Buffer.from(data.data[0].b64_json, "base64")
}

async function generateWithGoogleAI(prompt: string, apiKey?: string): Promise<Buffer> {
  const key = apiKey ?? process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error("GOOGLE_AI_API_KEY not configured")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Google AI images API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    predictions: { bytesBase64Encoded: string }[]
  }
  return Buffer.from(data.predictions[0].bytesBase64Encoded, "base64")
}

// Generate a minimal SVG placeholder so the feature works without API keys
function generatePlaceholderSvg(prompt: string): Buffer {
  const escaped = prompt.replace(/"/g, "&quot;").replace(/</g, "&lt;").slice(0, 60)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#f4f4f5"/>
  <text x="600" y="290" font-family="sans-serif" font-size="28" fill="#71717a" text-anchor="middle">Featured Image</text>
  <text x="600" y="340" font-family="sans-serif" font-size="18" fill="#a1a1aa" text-anchor="middle">${escaped}</text>
</svg>`
  return Buffer.from(svg)
}

export interface ImageApiKeys {
  openaiKey?: string
  googleAiKey?: string
}

export async function generateAndSaveImage(
  prompt: string,
  articleId: string,
  keys?: ImageApiKeys
): Promise<string> {
  let buffer: Buffer

  const openaiKey = keys?.openaiKey ?? process.env.OPENAI_API_KEY
  const googleKey = keys?.googleAiKey ?? process.env.GOOGLE_AI_API_KEY

  if (openaiKey) {
    buffer = await generateWithOpenAI(prompt, openaiKey)
  } else if (googleKey) {
    buffer = await generateWithGoogleAI(prompt, googleKey)
  } else {
    buffer = generatePlaceholderSvg(prompt)
  }

  return optimizeAndSave(buffer, articleId)
}
