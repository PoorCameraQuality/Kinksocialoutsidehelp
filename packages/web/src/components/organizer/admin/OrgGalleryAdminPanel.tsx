import { useCallback, useEffect, useState } from 'react'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { resolvePublicSeedDisplayUrl } from '@/lib/public-seed-url'

function orgMediaDisplayUrl(url: string | null | undefined): string | undefined {
  return resolvePublicSeedDisplayUrl(url)
}

export type GalleryRow = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export type OrgGalleryAdminPanelProps = {
  orgSlug: string
  galleryPublic?: boolean
  /** When provided, skips gallery fetch and uses controlled list. */
  gallery?: GalleryRow[] | null
  onGalleryChange?: (items: GalleryRow[]) => void
  onGalleryPublicChange?: (next: boolean) => void
  /** Max images to show in compact mode (default: all). */
  maxVisible?: number
}

export default function OrgGalleryAdminPanel({
  orgSlug,
  galleryPublic: controlledGalleryPublic,
  gallery: controlledGallery,
  onGalleryChange,
  onGalleryPublicChange,
  maxVisible,
}: OrgGalleryAdminPanelProps) {
  const orgKey = encodeURIComponent(orgSlug)
  const [internalGallery, setInternalGallery] = useState<GalleryRow[] | null>(
    controlledGallery === undefined ? null : controlledGallery
  )
  const [internalGalleryPublic, setInternalGalleryPublic] = useState(controlledGalleryPublic ?? false)
  const [galleryLocked, setGalleryLocked] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const gallery = controlledGallery !== undefined ? controlledGallery : internalGallery
  const galleryPublic = controlledGalleryPublic !== undefined ? controlledGalleryPublic : internalGalleryPublic

  const setGallery = useCallback(
    (next: GalleryRow[] | null) => {
      if (controlledGallery === undefined && next !== null) setInternalGallery(next)
      if (next !== null) onGalleryChange?.(next)
    },
    [controlledGallery, onGalleryChange]
  )

  const reloadGallery = useCallback(async () => {
    const rg = await fetch(`/api/v1/organizations/${orgKey}/gallery`, { credentials: 'include' })
    if (rg.ok) {
      const d = (await rg.json()) as { items: GalleryRow[] }
      setGallery(d.items ?? [])
      setGalleryLocked(false)
    } else if (rg.status === 403) {
      setGalleryLocked(true)
    } else {
      setGallery([])
      setGalleryLocked(false)
    }
  }, [orgKey, setGallery])

  useEffect(() => {
    if (controlledGallery !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const rg = await fetch(`/api/v1/organizations/${orgKey}/gallery`, { credentials: 'include' })
        if (cancelled) return
        if (rg.ok) {
          const d = (await rg.json()) as { items: GalleryRow[] }
          setInternalGallery(d.items ?? [])
          setGalleryLocked(false)
        } else if (rg.status === 403) {
          setInternalGallery(null)
          setGalleryLocked(true)
        } else {
          setInternalGallery([])
          setGalleryLocked(false)
        }
      } catch {
        if (!cancelled) setInternalGallery([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgKey, controlledGallery])

  useEffect(() => {
    if (controlledGalleryPublic !== undefined) setInternalGalleryPublic(controlledGalleryPublic)
  }, [controlledGalleryPublic])

  async function patchGalleryPublic(next: boolean) {
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryPublic: next }),
      })
      if (!r.ok) {
        setActionMsg('Could not update gallery visibility')
        return
      }
      if (controlledGalleryPublic === undefined) setInternalGalleryPublic(next)
      onGalleryPublicChange?.(next)
    } catch {
      setActionMsg('Network error')
    }
  }

  async function addGalleryImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(true)
      setActionMsg(null)
      try {
        const fd = new FormData()
        fd.append('purpose', 'org_gallery')
        fd.append('file', file)
        const up = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
        const data = (await up.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!up.ok || !data.url) {
          setActionMsg(data.error ?? 'Upload failed')
          return
        }
        const r = await fetch(`/api/v1/organizations/${orgKey}/gallery`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: data.url }),
        })
        if (r.ok) {
          await reloadGallery()
        } else {
          setActionMsg('Could not add to gallery')
        }
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  async function deleteGalleryImage(imageId: string) {
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/gallery/${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (r.ok) {
        setGallery(gallery ? gallery.filter((g) => g.id !== imageId) : [])
      }
    } catch {
      /* ignore */
    }
  }

  const visibleGallery = maxVisible != null && gallery ? gallery.slice(0, maxVisible) : gallery

  return (
    <OrganizerPanel title="Gallery" description="Upload photos and control public visibility on the About tab.">
      <OrganizerFormSection title="Visibility">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-dc-text-muted">
          <input
            type="checkbox"
            checked={galleryPublic}
            onChange={(e) => void patchGalleryPublic(e.target.checked)}
          />
          Public for non-members
        </label>
      </OrganizerFormSection>

      {galleryLocked ? (
        <p className="text-sm text-dc-muted">Gallery is members-only and could not be loaded for editing.</p>
      ) : gallery === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
      ) : (
        <>
          <OrganizerFormSection title="Photos">
            <button
              type="button"
              onClick={() => void addGalleryImage()}
              disabled={uploading}
              className="mb-4 w-full min-h-10 rounded-lg bg-dc-elevated-muted px-3 text-sm text-dc-text hover:bg-white/15 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Add image'}
            </button>
            {gallery.length === 0 ? (
              <p className="text-sm text-dc-muted">No images yet.</p>
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(visibleGallery ?? []).map((g) => (
                    <li key={g.id} className="group relative overflow-hidden rounded-xl border border-dc-border bg-black/20">
                      <img
                        src={orgMediaDisplayUrl(g.imageUrl)}
                        alt=""
                        className="h-48 w-full object-cover sm:h-56 md:h-64"
                        loading="lazy"
                      />
                      {g.caption && (
                        <p className="line-clamp-3 bg-dc-elevated-solid/90 px-2 py-2 text-xs leading-snug text-dc-muted">
                          {g.caption}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteGalleryImage(g.id)}
                        className="absolute right-2 top-2 rounded-lg bg-black/80 px-2 py-1 text-xs text-dc-text opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {maxVisible != null && gallery.length > maxVisible && (
                  <p className="mt-2 text-[10px] text-dc-muted">
                    Showing {maxVisible} of {gallery.length}
                  </p>
                )}
              </>
            )}
          </OrganizerFormSection>
        </>
      )}

      {actionMsg && <p className="text-sm text-dc-muted">{actionMsg}</p>}
    </OrganizerPanel>
  )
}
