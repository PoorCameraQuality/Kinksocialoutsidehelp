/**
 * Copy public assets from the sibling EastCoast repo into the web seed tree
 * and expose them at `/seed/ecke/...`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECKE_PUBLIC_SEED_URL_BASE, getWebPublicSeedEckeDir } from '../lib/public-seed-paths.js'

export { getWebPublicSeedEckeDir } from '../lib/public-seed-paths.js'
export { ECKE_PUBLIC_SEED_URL_BASE }

const ASSET_RE = /\.(jpe?g|png|gif|webp|svg|PNG|JPG|JPEG|SVG)$/i

export function resolveEastCoastRepoRoot(): string | null {
  const candidates = [
    process.env.EASTCOAST_REPO,
    'C:/Users/shkin/Desktop/eastcoast/EastCoast-master',
    join(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..'), '../../eastcoast/EastCoast-master'),
    join(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..'), '../EastCoast-master'),
    join(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..'), '../EastCoast'),
  ].filter(Boolean) as string[]

  for (const root of candidates) {
    if (existsSync(join(root, 'src/data/events.js'))) return root
  }
  return null
}

/** ECKE web paths like `/images/foo.PNG` or absolute https URLs. */
export function resolveEastCoastAssetPath(eckeRoot: string, webPath: string | undefined | null): string | null {
  if (!webPath?.trim()) return null
  const trimmed = webPath.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const normalized = trimmed.replace(/^\/+/, '')
  const direct = join(eckeRoot, 'public', normalized)
  if (existsSync(direct) && statSync(direct).isFile()) return direct

  const imagesRoot = join(eckeRoot, 'public/images')
  const rel = normalized.replace(/^images\//, '')
  const nested = join(imagesRoot, rel)
  if (existsSync(nested) && statSync(nested).isFile()) return nested

  const target = basename(rel).toLowerCase()
  const searchDirs = [dirname(nested), imagesRoot]
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase() === target) {
        const hit = join(dir, name)
        if (statSync(hit).isFile()) return hit
      }
    }
  }
  return null
}

function safeDestSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

/**
 * Copy one asset into `packages/web/public/seed/ecke/{destRelative}`.
 * Returns a same-origin API URL, an external URL, or null when missing.
 */
export function syncEckePublicAsset(
  eckeRoot: string,
  webPath: string | undefined | null,
  destRelative: string,
): string | null {
  const resolved = resolveEastCoastAssetPath(eckeRoot, webPath)
  if (!resolved) return null
  if (/^https?:\/\//i.test(resolved)) return resolved

  const destDir = getWebPublicSeedEckeDir()
  const safeRel = destRelative
    .split(/[/\\]+/)
    .filter(Boolean)
    .map(safeDestSegment)
    .join('/')
  const absDest = join(destDir, safeRel)
  mkdirSync(dirname(absDest), { recursive: true })
  copyFileSync(resolved, absDest)
  return `${ECKE_PUBLIC_SEED_URL_BASE}/${safeRel.replace(/\\/g, '/')}`
}

export function syncEckeEventImage(eckeRoot: string, slug: string, logoPath?: string | null): string | null {
  if (!logoPath) return null
  if (/^https?:\/\//i.test(logoPath.trim())) return logoPath.trim()
  const ext = extname(logoPath) || '.png'
  return syncEckePublicAsset(eckeRoot, logoPath, `events/${safeDestSegment(slug)}${ext.toLowerCase()}`)
}

export function syncEckeVendorLogo(eckeRoot: string, slug: string, logoPath?: string | null): string | null {
  if (!logoPath) return null
  if (/^https?:\/\//i.test(logoPath.trim())) return logoPath.trim()
  const ext = extname(logoPath) || '.jpg'
  return syncEckePublicAsset(eckeRoot, logoPath, `vendors/${safeDestSegment(slug)}/logo${ext.toLowerCase()}`)
}

export function syncEckeVendorProductImage(
  eckeRoot: string,
  slug: string,
  productPath?: string | null,
  index = 1,
): string | null {
  if (!productPath) return null
  if (/^https?:\/\//i.test(productPath.trim())) return productPath.trim()
  const ext = extname(productPath) || '.jpg'
  return syncEckePublicAsset(
    eckeRoot,
    productPath,
    `vendors/${safeDestSegment(slug)}/product-${index}${ext.toLowerCase()}`,
  )
}

export function syncEckeDungeonLogo(eckeRoot: string, slug: string, logoPath?: string | null): string | null {
  if (!logoPath) return null
  if (/^https?:\/\//i.test(logoPath.trim())) return logoPath.trim()
  const ext = extname(logoPath) || '.png'
  return syncEckePublicAsset(eckeRoot, logoPath, `dungeons/${safeDestSegment(slug)}${ext.toLowerCase()}`)
}

/** Roll event dates forward until the end is at least `minDaysAhead` days in the future. */
export function rollEckeEventDatesToFuture(
  startIso: string,
  endIso: string,
  minDaysAhead = 7,
): { startsAt: string; endsAt: string; rolled: boolean } {
  const parseDay = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00.000Z`)
  let start = parseDay(startIso)
  let end = parseDay(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startsAt: startIso, endsAt: endIso, rolled: false }
  }
  if (end < start) end = new Date(start.getTime() + 2 * 86400000)

  const horizon = new Date(Date.now() + minDaysAhead * 86400000)
  let rolled = false
  while (end < horizon) {
    start = new Date(start)
    end = new Date(end)
    start.setUTCFullYear(start.getUTCFullYear() + 1)
    end.setUTCFullYear(end.getUTCFullYear() + 1)
    rolled = true
  }

  const day = (d: Date) => d.toISOString().slice(0, 10)
  return {
    startsAt: `${day(start)}T18:00:00.000Z`,
    endsAt: `${day(end)}T04:00:00.000Z`,
    rolled,
  }
}

export function countSyncedEckeAssets(eckeRoot: string): number {
  const imagesRoot = join(eckeRoot, 'public/images')
  if (!existsSync(imagesRoot)) return 0
  let n = 0
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ASSET_RE.test(name)) n += 1
    }
  }
  walk(imagesRoot)
  return n
}
