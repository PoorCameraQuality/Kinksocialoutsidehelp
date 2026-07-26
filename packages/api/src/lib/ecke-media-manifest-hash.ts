import { createHash } from 'node:crypto'
import type { EckePhotosManifest } from '@c2k/shared'

/** Stable hash for ECKE publish target media change detection (API-only; uses node:crypto). */
export function hashMediaManifest(manifest: EckePhotosManifest | null | undefined): string | null {
  if (!manifest) return null
  const normalized = {
    manifestVersion: manifest.manifestVersion,
    hero: manifest.hero,
    gallery: [...manifest.gallery].sort((a, b) => a.ordinal - b.ordinal || a.role.localeCompare(b.role)),
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
