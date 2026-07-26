/**
 * Public seed assets ship in `packages/web/public/seed` and are served at `/seed/...`
 * (Vite dev + nginx prod). Legacy DB/API values may still use `/api/public-seed/...`.
 */
export function resolvePublicSeedDisplayUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined
  const trimmed = url.trim()
  if (trimmed.startsWith('/api/public-seed/ecke/')) {
    return `/seed/ecke/${trimmed.slice('/api/public-seed/ecke/'.length)}`
  }
  if (trimmed.startsWith('/api/public-seed/paf/')) {
    return `/seed/paf/${trimmed.slice('/api/public-seed/paf/'.length)}`
  }
  return trimmed
}
