/** Client-safe slug normalization (no server imports). */
export function normalizeEventSlug(raw: string): string {
  return raw.trim().toLowerCase()
}
