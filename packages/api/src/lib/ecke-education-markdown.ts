/** Inline markdown supported in ECKE education.js (bold only). */
function inlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Convert ECKE education.js markdown (headings, lists, bold, paragraphs) to HTML.
 * Scope matches the static articles in EastCoast `src/data/education.js`.
 */
export function eckeEducationMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inUl = false
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    out.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const closeList = () => {
    if (!inUl) return
    out.push('</ul>')
    inUl = false
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    const heading =
      trimmed.match(/^#{4}\s+(.+)$/) ??
      trimmed.match(/^#{3}\s+(.+)$/) ??
      trimmed.match(/^#{2}\s+(.+)$/) ??
      trimmed.match(/^#\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = trimmed.startsWith('####')
        ? 4
        : trimmed.startsWith('###')
          ? 3
          : trimmed.startsWith('##')
            ? 2
            : 1
      out.push(`<h${level}>${inlineMarkdown(heading[1] ?? '')}</h${level}>`)
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      if (!inUl) {
        out.push('<ul>')
        inUl = true
      }
      out.push(`<li>${inlineMarkdown(bullet[1] ?? '')}</li>`)
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  closeList()
  return out.join('\n')
}

/** Parse ECKE read time strings like "8 min read". */
export function parseEckeReadMinutes(readTime: string | undefined | null): number | null {
  if (!readTime?.trim()) return null
  const match = readTime.match(/(\d+)/)
  if (!match) return null
  const n = Number.parseInt(match[1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
