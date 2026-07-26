'use client'

import { useMemo, useRef, useState } from 'react'
import { ORGANIZER_PUBLISHED_AS_HINT, ORGANIZER_PUBLISHED_AS_LABEL } from '@/lib/dancecard/organizerCopy'
import { Panel } from '@/components/dancecard/ui/Panel'
import {
  SETTINGS_FIELD_CLASS,
  SETTINGS_LABEL_CLASS,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { organizerConventionUpload, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { DancecardThemeConfig } from '@/lib/dancecard/theme'

type Props = {
  event: EventSettingsEventDto
  setEvent: React.Dispatch<React.SetStateAction<EventSettingsEventDto | null>>
  canEdit: boolean
  saveOnBlur: (patch: Partial<EventSettingsEventDto>) => void
  embedded?: boolean
}

type ThemePreset = {
  id: string
  name: string
  colors: Required<Pick<DancecardThemeConfig, 'accent' | 'surface' | 'elevated' | 'slotPublished'>>
}

/** Four-color presets that map 1:1 to `themeConfig` (accent / surface / elevated / slotPublished). */
const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'coastal-slate',
    name: 'Coastal Slate',
    colors: { accent: '#b8860b', surface: '#f2f4f6', elevated: '#ffffff', slotPublished: '#b8860b' },
  },
  {
    id: 'midnight-brass',
    name: 'Midnight Brass',
    colors: { accent: '#c6a75e', surface: '#12151a', elevated: '#1e2430', slotPublished: '#c6a75e' },
  },
  {
    id: 'sunrise-coral',
    name: 'Sunrise Coral',
    colors: { accent: '#ef6c4a', surface: '#fff7f3', elevated: '#ffffff', slotPublished: '#ef6c4a' },
  },
  {
    id: 'forest-lantern',
    name: 'Forest Lantern',
    colors: { accent: '#5b8c5a', surface: '#1d2a1d', elevated: '#243524', slotPublished: '#9bbd84' },
  },
  {
    id: 'sapphire-tide',
    name: 'Sapphire Tide',
    colors: { accent: '#3b82f6', surface: '#0f172a', elevated: '#1e293b', slotPublished: '#60a5fa' },
  },
  {
    id: 'parchment-brass',
    name: 'Parchment & Brass',
    colors: { accent: '#8b6914', surface: '#f4f0e8', elevated: '#ffffff', slotPublished: '#8b6914' },
  },
] as const

const PREVIEW_ROLES: ReadonlyArray<{ id: 'attendee' | 'staff' | 'safety' | 'public'; label: string }> = [
  { id: 'attendee', label: 'Preview as attendee' },
  { id: 'staff', label: 'as staff' },
  { id: 'safety', label: 'as safety' },
  { id: 'public', label: 'as public' },
]

function PreviewRoleRow({ slug }: { slug: string }) {
  return (
    <div className="sticky top-2 z-10 -mx-1 flex flex-wrap gap-2 rounded-2xl border border-dc-border-subtle bg-dc-elevated/95 p-2 shadow-dc-soft backdrop-blur">
      <span className="self-center px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-dc-muted">
        Live preview
      </span>
      {PREVIEW_ROLES.map((r) => (
        <a
          key={r.id}
          href={`/conventions/${encodeURIComponent(slug)}?previewRole=${r.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-dc-border-subtle bg-dc-surface px-3 py-1.5 text-xs font-semibold text-dc-text hover:bg-dc-accent-muted hover:text-dc-accent"
        >
          {r.label}
        </a>
      ))}
    </div>
  )
}

function ShareImageControl({ event, canEdit, saveOnBlur }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onPick = () => inputRef.current?.click()
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('purpose', 'event_share_branding')
      fd.set('file', file)
      const up = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
      const j = (await up.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!up.ok || !j.url) throw new Error(j.error ?? 'Upload failed')
      saveOnBlur({ shareImageUrl: j.url })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onRemove = () => {
    if (!canEdit) return
    saveOnBlur({ shareImageUrl: null })
  }

  const display = event.shareImageUrl

  return (
    <section className="space-y-3 rounded-2xl border border-dc-border-subtle bg-dc-elevated p-4">
      <header>
        <h3 className="text-sm font-semibold text-dc-text">Social share image</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Used when someone pastes your convention link in Discord, Facebook, or iMessage. Recommended 1200×630. If
          empty, link previews use the hero photo above.
        </p>
      </header>
      {display ?
        <div className="overflow-hidden rounded-xl border border-dc-border-subtle">
          <img src={display} alt="Share preview" className="aspect-[1.91/1] w-full object-cover" />
        </div>
      : <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-xl border-2 border-dashed border-dc-border-subtle bg-dc-surface text-xs text-dc-muted">
          No share image. Hero will be used
        </div>
      }
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onChange}
          disabled={!canEdit || uploading}
        />
        <button
          type="button"
          onClick={onPick}
          disabled={!canEdit || uploading}
          className="rounded-lg border border-dc-accent-border bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : display ? 'Replace share image' : 'Upload share image'}
        </button>
        {display ?
          <button
            type="button"
            onClick={onRemove}
            disabled={!canEdit || uploading}
            className="rounded-lg border border-dc-border-subtle px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-60"
          >
            Remove
          </button>
        : null}
      </div>
      {err ? <p className="text-xs text-dc-danger">{err}</p> : null}
    </section>
  )
}

function HeroPhotoControl({ event, setEvent, canEdit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onPick = () => inputRef.current?.click()
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const j = await organizerConventionUpload<{ imageUrl?: string; eventId?: string; error?: string }>(
        event.slug,
        '/hero/upload',
        fd,
      )
      if (!j.imageUrl) throw new Error(j.error ?? 'Upload failed')
      setEvent((ev) => (ev ? { ...ev, heroImageUrl: j.imageUrl ?? null } : ev))
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onRemove = async () => {
    if (!canEdit) return
    setErr(null)
    setUploading(true)
    try {
      await organizerDancecardFetch<{ imageUrl: string | null }>(event.slug, '/hero', { method: 'DELETE' })
      setEvent((ev) => (ev ? { ...ev, heroImageUrl: null } : ev))
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Remove failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-dc-border-subtle bg-dc-elevated p-4">
      <header>
        <h3 className="text-sm font-semibold text-dc-text">Hero background photo</h3>
        <p className="mt-1 text-xs text-dc-muted">
          This photo also appears as the banner on the calendar event page. Wide landscape (3:1 or 16:9) works best.
        </p>
      </header>
      {event.heroImageUrl ? (
        <div className="overflow-hidden rounded-xl border border-dc-border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.heroImageUrl} alt="Hero preview" className="aspect-[3/1] w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center rounded-xl border-2 border-dashed border-dc-border-subtle bg-dc-surface text-xs text-dc-muted">
          No photo uploaded
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onChange}
          disabled={!canEdit || uploading}
        />
        <button
          type="button"
          onClick={onPick}
          disabled={!canEdit || uploading}
          className="rounded-lg border border-dc-accent-border bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : event.heroImageUrl ? 'Replace photo' : 'Upload photo'}
        </button>
        {event.heroImageUrl ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={!canEdit || uploading}
            className="rounded-lg border border-dc-border-subtle px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>
      {err ? <p className="text-xs text-dc-danger">{err}</p> : null}
    </section>
  )
}

function ThemePreviewTile({ colors }: { colors: ThemePreset['colors'] }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-dc-border-subtle"
      style={{ backgroundColor: colors.surface }}
      aria-hidden
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: colors.elevated, color: colors.accent }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider">Preview</span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: colors.accent, color: colors.surface }}
        >
          Live
        </span>
      </div>
      <div className="space-y-1.5 px-3 py-3">
        <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.85 }} />
        <div className="h-2 w-1/2 rounded-full" style={{ backgroundColor: colors.elevated }} />
        <div
          className="mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: colors.slotPublished, color: colors.surface }}
        >
          Slot published
        </div>
      </div>
    </div>
  )
}

function isValidHex(v: string | undefined | null): v is string {
  return Boolean(v && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v))
}

function normalizeHex(v: string | undefined | null): string {
  if (!isValidHex(v)) return '#000000'
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v
}

function ThemePicker({ event, setEvent, canEdit, saveOnBlur }: Props) {
  const cfg: DancecardThemeConfig = event.themeConfig ?? {}
  const currentColors = {
    accent: cfg.accent ?? '#c6a75e',
    surface: cfg.surface ?? '#12151a',
    elevated: cfg.elevated ?? '#1e2430',
    slotPublished: cfg.slotPublished ?? cfg.accent ?? '#c6a75e',
  }

  const applyPreset = (preset: ThemePreset) => {
    if (!canEdit) return
    const next: DancecardThemeConfig = { ...cfg, ...preset.colors }
    setEvent((ev) => (ev ? { ...ev, themeConfig: next } : ev))
    saveOnBlur({ themeConfig: next })
  }

  const updateColor = (k: keyof ThemePreset['colors'], value: string) => {
    if (!canEdit) return
    const next: DancecardThemeConfig = { ...cfg, [k]: value }
    setEvent((ev) => (ev ? { ...ev, themeConfig: next } : ev))
  }

  const commitColor = () => {
    if (!canEdit) return
    saveOnBlur({ themeConfig: { ...cfg } })
  }

  const activePresetId = useMemo(() => {
    return (
      THEME_PRESETS.find(
        (p) =>
          p.colors.accent.toLowerCase() === (cfg.accent ?? '').toLowerCase() &&
          p.colors.surface.toLowerCase() === (cfg.surface ?? '').toLowerCase() &&
          p.colors.elevated.toLowerCase() === (cfg.elevated ?? '').toLowerCase() &&
          p.colors.slotPublished.toLowerCase() === (cfg.slotPublished ?? '').toLowerCase(),
      )?.id ?? null
    )
  }, [cfg])

  return (
    <section className="space-y-4 rounded-2xl border border-dc-border-subtle bg-dc-elevated p-4">
      <header>
        <h3 className="text-sm font-semibold text-dc-text">Theme colors</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Drives the public hub hero, tab underline, and slot highlights. Pick a preset or fine-tune individual swatches
         . Changes save when the swatch loses focus.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEME_PRESETS.map((p) => {
          const active = activePresetId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={!canEdit}
              className={`group flex flex-col items-start gap-2 rounded-xl border p-2 text-left transition ${
                active
                  ? 'border-dc-accent-border ring-2 ring-dc-accent-border'
                  : 'border-dc-border-subtle hover:border-dc-accent-border'
              }`}
            >
              <div className="flex w-full gap-1">
                {(['accent', 'surface', 'elevated', 'slotPublished'] as const).map((k) => (
                  <span
                    key={k}
                    className="h-5 flex-1 rounded-md border border-black/10"
                    style={{ backgroundColor: p.colors[k] }}
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-dc-text">{p.name}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { k: 'accent', label: 'Accent' },
            { k: 'surface', label: 'Surface' },
            { k: 'elevated', label: 'Elevated' },
            { k: 'slotPublished', label: 'Slot published' },
          ] as const
        ).map(({ k, label }) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-dc-muted">
            {label}
            <div className="flex items-center gap-2 rounded-lg border border-dc-border-subtle bg-dc-surface p-1">
              <input
                type="color"
                aria-label={`${label} color picker`}
                value={normalizeHex(currentColors[k])}
                disabled={!canEdit}
                onChange={(e) => updateColor(k, e.target.value)}
                onBlur={() => commitColor()}
                className="h-8 w-10 cursor-pointer rounded-md border border-dc-border-subtle bg-transparent p-0"
              />
              <input
                type="text"
                value={(cfg as Record<string, string | undefined>)[k] ?? ''}
                disabled={!canEdit}
                onChange={(e) => updateColor(k, e.target.value)}
                onBlur={() => commitColor()}
                placeholder="#000000"
                className="flex-1 bg-transparent px-1 font-mono text-sm text-dc-text outline-none"
              />
            </div>
          </label>
        ))}
      </div>

      <ThemePreviewTile colors={currentColors} />
    </section>
  )
}

function BrandingFields({ event, setEvent, canEdit, saveOnBlur }: Props) {
  return (
    <>
      <label className={SETTINGS_LABEL_CLASS}>
        {ORGANIZER_PUBLISHED_AS_LABEL}
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.productTitle}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, productTitle: e.target.value } : ev))}
          onBlur={() => saveOnBlur({ productTitle: event.productTitle })}
        />
        <span className="mt-1 block text-xs font-normal normal-case text-dc-muted">{ORGANIZER_PUBLISHED_AS_HINT}</span>
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Subtitle (optional)
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.subtitle ?? ''}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, subtitle: e.target.value || null } : ev))}
          onBlur={() => saveOnBlur({ subtitle: event.subtitle })}
          placeholder="A weekend of rope, community, and play"
        />
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Presented by (label)
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.sharedByLabel}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, sharedByLabel: e.target.value } : ev))}
          onBlur={() => saveOnBlur({ sharedByLabel: event.sharedByLabel })}
          placeholder="Presented by Your Collective"
        />
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Convention logo / wordmark URL (optional)
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.logoUrl ?? ''}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, logoUrl: e.target.value || null } : ev))}
          onBlur={() => saveOnBlur({ logoUrl: event.logoUrl })}
          placeholder="https://..."
        />
        <span className="mt-1 block text-xs font-normal normal-case text-dc-muted">
          Overlays the background photo on the public hub. Square or wordmark PNG with transparent background works
          best.
        </span>
      </label>
    </>
  )
}

export function EventSettingsBrandingForm(props: Props) {
  const grid = 'grid gap-4'
  if (props.embedded) {
    return (
      <div className={grid}>
        <BrandingFields {...props} />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <PreviewRoleRow slug={props.event.slug} />
      <HeroPhotoControl {...props} />
      <ShareImageControl {...props} />
      <Panel className={grid}>
        <BrandingFields {...props} />
      </Panel>
      <ThemePicker {...props} />
    </div>
  )
}
