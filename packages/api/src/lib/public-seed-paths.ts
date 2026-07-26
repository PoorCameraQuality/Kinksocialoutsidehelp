import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Disk root for `packages/web/public/seed` (PAF + ECKE demo assets). */
export function resolveWebPublicSeedRoot(): string {
  const envRoot = process.env.C2K_WEB_PUBLIC_SEED_ROOT?.trim()
  if (envRoot) return envRoot

  const dockerRoot = '/app/packages/web/public/seed'
  if (existsSync(dockerRoot)) return dockerRoot

  return join(
    resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..'),
    'packages/web/public/seed',
  )
}

export function getWebPublicSeedPafDir(): string {
  return join(resolveWebPublicSeedRoot(), 'paf')
}

export function getWebPublicSeedEckeDir(): string {
  return join(resolveWebPublicSeedRoot(), 'ecke')
}

/** Canonical browser path for synced PAF seed assets. */
export const PAF_PUBLIC_SEED_URL_BASE = '/seed/paf'

/** Canonical browser path for synced ECKE seed assets. */
export const ECKE_PUBLIC_SEED_URL_BASE = '/seed/ecke'

/** Rewrite legacy API seed URLs to web-static paths. */
export function toWebPublicSeedUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (trimmed.startsWith('/api/public-seed/ecke/')) {
    return `${ECKE_PUBLIC_SEED_URL_BASE}/${trimmed.slice('/api/public-seed/ecke/'.length)}`
  }
  if (trimmed.startsWith('/api/public-seed/paf/')) {
    return `${PAF_PUBLIC_SEED_URL_BASE}/${trimmed.slice('/api/public-seed/paf/'.length)}`
  }
  return trimmed
}
