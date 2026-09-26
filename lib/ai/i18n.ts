// Block labels that get rendered into published content.
// These are reader-facing strings — they must follow the project language,
// not the language this codebase happens to be written in.

export interface BlockLabels {
  tldr: string
  keyTakeaways: string
  pros: string
  cons: string
  warning: string
  bestPractices: string
  sources: string
}

const LABELS: Record<string, BlockLabels> = {
  de: {
    tldr: "Kurz gesagt",
    keyTakeaways: "Das Wichtigste auf einen Blick",
    pros: "Vorteile",
    cons: "Nachteile",
    warning: "Achtung",
    bestPractices: "Bewährte Praxis",
    sources: "Quellen",
  },
  en: {
    tldr: "TL;DR",
    keyTakeaways: "Key Takeaways",
    pros: "Pros",
    cons: "Cons",
    warning: "Warning",
    bestPractices: "Best Practices",
    sources: "Sources",
  },
  fr: {
    tldr: "En bref",
    keyTakeaways: "L'essentiel",
    pros: "Avantages",
    cons: "Inconvénients",
    warning: "Attention",
    bestPractices: "Bonnes pratiques",
    sources: "Sources",
  },
  es: {
    tldr: "En resumen",
    keyTakeaways: "Lo esencial",
    pros: "Ventajas",
    cons: "Desventajas",
    warning: "Atención",
    bestPractices: "Buenas prácticas",
    sources: "Fuentes",
  },
  it: {
    tldr: "In breve",
    keyTakeaways: "I punti chiave",
    pros: "Vantaggi",
    cons: "Svantaggi",
    warning: "Attenzione",
    bestPractices: "Buone pratiche",
    sources: "Fonti",
  },
  nl: {
    tldr: "Kort samengevat",
    keyTakeaways: "De kern",
    pros: "Voordelen",
    cons: "Nadelen",
    warning: "Let op",
    bestPractices: "Best practices",
    sources: "Bronnen",
  },
}

const FALLBACK_LANGUAGE = "de"

/**
 * Resolve labels for a project language. Accepts bare codes ("de") and
 * locale tags ("de-AT"); unknown languages fall back to the default.
 */
export function labelsFor(language?: string | null): BlockLabels {
  if (!language) return LABELS[FALLBACK_LANGUAGE]
  const base = language.toLowerCase().split(/[-_]/)[0]
  return LABELS[base] ?? LABELS[FALLBACK_LANGUAGE]
}
