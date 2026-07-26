/**
 * Copies demo images from a local folder into `packages/web/public/seed/paf/`
 * so the Vite app can serve them at `/seed/paf/...`.
 *
 * Defaults to `%USERPROFILE%/Pictures/seed` on Windows (or `~/Pictures/seed`).
 * Override with `C2K_SEED_IMAGE_DIR`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { getWebPublicSeedPafDir, PAF_PUBLIC_SEED_URL_BASE } from '../lib/public-seed-paths.js'

export { getWebPublicSeedPafDir } from '../lib/public-seed-paths.js'

const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i

const WEB_PUBLIC_PAF = getWebPublicSeedPafDir()

const PUBLIC_SEED_URL_BASE = PAF_PUBLIC_SEED_URL_BASE

function clearMatchingFiles(dir: string, re: RegExp) {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (re.test(f)) {
      try {
        unlinkSync(join(dir, f))
      } catch {
        /* ignore */
      }
    }
  }
}

export type PafLocalSeedSyncResult = {
  bannerUrl: string | null
  logoUrl: string | null
  gallery: { imageUrl: string; caption: string; sortOrder: number }[]
}

function listImageFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => IMAGE_RE.test(f))
    .map((f) => join(dir, f))
    .filter((p) => {
      try {
        return statSync(p).isFile()
      } catch {
        return false
      }
    })
}

function pickBanner(paths: string[]): string | undefined {
  const byPref = paths.find((p) => /^banner\./i.test(basename(p)))
  if (byPref) return byPref
  const loose = paths.filter((p) => /banner|header/i.test(basename(p)))
  loose.sort((a, b) => basename(a).localeCompare(basename(b), undefined, { sensitivity: 'base' }))
  return loose[0]
}

function pickLogo(paths: string[], exclude: Set<string>): string | undefined {
  return paths.find((p) => !exclude.has(p) && /^logo\./i.test(basename(p)))
}

/** Prefer s1, s2, … then other non-banner files (max `max`). */
function pickGallery(paths: string[], exclude: Set<string>, max: number): string[] {
  const pool = paths.filter((p) => !exclude.has(p))
  const numbered = pool
    .filter((p) => /^s\d+\./i.test(basename(p)))
    .sort((a, b) => {
      const na = Number((basename(a).match(/^s(\d+)/i) ?? ['', '0'])[1])
      const nb = Number((basename(b).match(/^s(\d+)/i) ?? ['', '0'])[1])
      return na - nb
    })
  const used = new Set<string>()
  const out: string[] = []
  for (const p of numbered) {
    if (out.length >= max) break
    out.push(p)
    used.add(p)
  }
  if (out.length < max) {
    const rest = pool.filter((p) => !used.has(p)).sort((a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true }))
    for (const p of rest) {
      if (out.length >= max) break
      out.push(p)
    }
  }
  return out
}

/**
 * Returns same-origin paths (`/api/public-seed/paf/...`) after copying files into the web public tree
 * (served by the API so dev/proxy setups do not rely on Vite `public/` alone).
 * Returns `null` if the source directory is missing or contains no images.
 */
export function syncPafSeedImagesFromLocalDisk(): PafLocalSeedSyncResult | null {
  const trimmed = process.env.C2K_SEED_IMAGE_DIR?.trim()
  const srcRoot = trimmed && trimmed.length > 0 ? trimmed : join(homedir(), 'Pictures', 'seed')

  const paths = listImageFiles(srcRoot)
  if (paths.length === 0) {
    if (existsSync(srcRoot)) {
      console.log(`Local seed images: directory exists but no images found in "${srcRoot}".`)
    } else {
      console.log(`Local seed images: skipped (missing "${srcRoot}"); set C2K_SEED_IMAGE_DIR to override.`)
    }
    return null
  }

  const bannerSrc = pickBanner(paths)
  const exclude = new Set<string>()
  if (bannerSrc) exclude.add(bannerSrc)
  const logoSrc = pickLogo(paths, exclude)
  if (logoSrc) exclude.add(logoSrc)

  const gallerySrcs = pickGallery(paths, exclude, 6)

  mkdirSync(WEB_PUBLIC_PAF, { recursive: true })
  clearMatchingFiles(WEB_PUBLIC_PAF, /^gallery-\d+\./i)

  let bannerUrl: string | null = null
  if (bannerSrc) {
    clearMatchingFiles(WEB_PUBLIC_PAF, /^banner\./i)
    const ext = (extname(bannerSrc) || '.png').toLowerCase()
    const dest = `banner${ext}`
    copyFileSync(bannerSrc, join(WEB_PUBLIC_PAF, dest))
    bannerUrl = `${PUBLIC_SEED_URL_BASE}/${dest}`
  }

  let logoUrl: string | null = null
  if (logoSrc) {
    clearMatchingFiles(WEB_PUBLIC_PAF, /^logo\./i)
    const ext = (extname(logoSrc) || '.png').toLowerCase()
    const dest = `logo${ext}`
    copyFileSync(logoSrc, join(WEB_PUBLIC_PAF, dest))
    logoUrl = `${PUBLIC_SEED_URL_BASE}/${dest}`
  }

  const gallery: { imageUrl: string; caption: string; sortOrder: number }[] = []
  let i = 0
  for (const src of gallerySrcs) {
    i += 1
    const ext = (extname(src) || '.png').toLowerCase()
    const destName = `gallery-${String(i).padStart(2, '0')}${ext}`
    copyFileSync(src, join(WEB_PUBLIC_PAF, destName))
    gallery.push({
      imageUrl: `${PUBLIC_SEED_URL_BASE}/${destName}`,
      caption: `PAF seed gallery: local still ${i} (demo)`,
      sortOrder: i - 1,
    })
  }

  console.log(
    `Local seed images: copied from "${srcRoot}" → packages/web/public/seed/paf (${[bannerSrc, logoSrc, ...gallerySrcs].filter(Boolean).length} file(s)).`,
  )

  return { bannerUrl, logoUrl, gallery }
}
