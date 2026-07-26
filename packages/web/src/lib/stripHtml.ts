/** Strip HTML tags for plain-text previews (hosted-by taglines, etc.). */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
