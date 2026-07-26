'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { organizerConventionUpload, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { BadgePrintCard } from '@/components/dancecard/organizer/BadgePrintCard'
import { BadgePrintSheet } from '@/components/dancecard/organizer/BadgePrintSheet'
import type { BadgePrintCategory, BadgePrintRegistrant } from '@/lib/dancecard/badgePrint'

type PrintData = {
  eventTitle: string
  logoUrl: string | null
  hasBadgeLogo: boolean
  categories: BadgePrintCategory[]
  registrants: BadgePrintRegistrant[]
}

type PrintFilter = 'ready' | 'confirmed' | 'checked_in' | 'all'

type PrintJob =
  | { kind: 'all' }
  | { kind: 'category'; categoryId: string; label: string }
  | { kind: 'single'; registrantId: string; label: string }

export function BadgesPrintPanel({
  eventSlug,
  readOnly,
}: {
  eventSlug: string
  readOnly: boolean
}) {
  const [data, setData] = useState<PrintData | null>(null)
  const [filter, setFilter] = useState<PrintFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [printJob, setPrintJob] = useState<PrintJob>({ kind: 'all' })
  const [err, setErr] = useState<string | null>(null)
  const [logoMsg, setLogoMsg] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(true)
  const printAfterPaint = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const status =
        filter === 'checked_in'
          ? 'checked_in'
          : filter === 'confirmed'
            ? 'confirmed'
            : filter === 'all'
              ? 'all'
              : undefined
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      const raw = await organizerDancecardFetch<Partial<PrintData>>(eventSlug, `/badges/print-data${q}`)
      // Defensive merge: older API revisions can omit `categories` / `hasBadgeLogo`.
      const normalized: PrintData = {
        eventTitle: raw.eventTitle ?? '',
        logoUrl: raw.logoUrl ?? null,
        hasBadgeLogo: Boolean(raw.hasBadgeLogo ?? raw.logoUrl),
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        registrants: Array.isArray(raw.registrants) ? raw.registrants : [],
      }
      setData(normalized)
      setSelectedId((prev) => (prev && normalized.registrants.some((r) => r.id === prev) ? prev : null))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load badges')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [eventSlug, filter])

  useEffect(() => {
    void load()
  }, [load])

  const searchHits = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return []
    return (data.registrants ?? [])
      .filter((r) => {
        const hay = `${r.sceneDisplayName ?? ''} ${r.packageName ?? ''} ${r.registrationNumber ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 12)
  }, [data, search])

  const selected = useMemo(
    () => (data?.registrants ?? []).find((r) => r.id === selectedId) ?? null,
    [data, selectedId],
  )

  const printRegistrants = useMemo(() => {
    if (!data) return []
    const all = data.registrants ?? []
    if (printJob.kind === 'all') return all
    if (printJob.kind === 'single') {
      const one = all.find((r) => r.id === printJob.registrantId)
      return one ? [one] : []
    }
    return all.filter((r) => (r.categoryId ?? '__none__') === printJob.categoryId)
  }, [data, printJob])

  const printHeader = useMemo(() => {
    if (!data) return ''
    if (printJob.kind === 'all') return `${data.eventTitle} · ${printRegistrants.length} badge(s)`
    if (printJob.kind === 'single') return `${data.eventTitle} · Reprint: ${printJob.label}`
    return `${data.eventTitle} · ${printJob.label} (${printRegistrants.length})`
  }, [data, printJob, printRegistrants.length])

  useEffect(() => {
    if (!printAfterPaint.current) return
    printAfterPaint.current = false
    const t = window.setTimeout(() => window.print(), 80)
    return () => window.clearTimeout(t)
  }, [printJob, data])

  function triggerPrint(job: PrintJob) {
    setPrintJob(job)
    printAfterPaint.current = true
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || readOnly) return
    setUploadingLogo(true)
    setLogoMsg(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const j = await organizerConventionUpload<{ badgeLogoUrl?: string; error?: string }>(
        eventSlug,
        '/badges/logo/upload',
        fd,
      )
      if (!j.badgeLogoUrl) throw new Error(j.error ?? 'Upload failed')
      setData((d) => (d ? { ...d, logoUrl: j.badgeLogoUrl ?? d.logoUrl, hasBadgeLogo: true } : d))
      setLogoMsg(`Uploaded ${file.name} for badge printing.`)
    } catch (ex) {
      setLogoMsg(ex instanceof Error ? ex.message : 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="space-y-5">
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {logoMsg ? <p className="text-sm text-dc-accent">{logoMsg}</p> : null}

      {data && !loading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Logo</p>
            <p className="mt-0.5 text-sm text-dc-text">{data.hasBadgeLogo ? 'Uploaded' : 'Not set'}</p>
          </div>
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Ready to print</p>
            <p className="mt-0.5 font-serif text-xl text-dc-text">{data.registrants.length}</p>
          </div>
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Categories</p>
            <p className="mt-0.5 font-serif text-xl text-dc-text">{data.categories.length}</p>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-dc-border bg-dc-elevated/80 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Badge logo (print quality)</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Upload a high-resolution PNG, JPEG, WebP, or SVG for crisp printing. Falls back to the branding URL in
          settings if none is uploaded.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {data?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt=""
              className="max-h-16 max-w-[200px] rounded border border-dc-border bg-white object-contain p-1"
            />
          ) : (
            <span className="text-xs text-dc-muted">No logo yet</span>
          )}
          {!readOnly ? (
            <label className="cursor-pointer rounded-full border border-dc-border bg-dc-surface-muted px-3 py-1.5 text-xs font-medium text-dc-text hover:border-dc-accent-border">
              {uploadingLogo ? 'Uploading…' : data?.hasBadgeLogo ? 'Replace logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                disabled={uploadingLogo}
                onChange={(ev) => void onLogoFile(ev)}
              />
            </label>
          ) : null}
          {data?.hasBadgeLogo ? (
            <span className="text-[10px] uppercase tracking-wide text-dc-muted">Print-quality file on file</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated/80 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Find a badge (reprint)</h3>
        <p className="mt-1 text-xs text-dc-muted">Search by scene name, package, or registration number.</p>
        <input
          className="mt-2 w-full max-w-md rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          placeholder="Search attendees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchHits.length > 0 ? (
          <ul className="mt-2 max-w-md rounded-lg border border-dc-border bg-dc-surface-muted">
            {searchHits.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-dc-accent-muted/40"
                  onClick={() => {
                    setSelectedId(r.id)
                    setSearch('')
                  }}
                >
                  <span className="font-medium text-dc-text">{r.sceneDisplayName}</span>
                  <span className="text-xs text-dc-muted">
                    {r.packageName ?? '-'} · #{r.registrationNumber}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            <div className="w-[3.375in] shrink-0">
              <BadgePrintCard
                eventSlug={eventSlug}
                eventTitle={data?.eventTitle ?? ''}
                logoUrl={data?.logoUrl ?? null}
                reg={selected}
              />
            </div>
            <button
              type="button"
              className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
              onClick={() =>
                triggerPrint({
                  kind: 'single',
                  registrantId: selected.id,
                  label: selected.sceneDisplayName,
                })
              }
            >
              Print this badge
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated/80 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Print by package (pre-registration)</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Print an entire registration category ahead of check-in. Registration numbers stay in signup order.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-dc-muted">Roster</span>
          {(
            [
              ['all', 'All non-cancelled'],
              ['confirmed', 'Confirmed only'],
              ['ready', 'Confirmed + checked in'],
              ['checked_in', 'Checked in only'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                filter === key
                  ? 'rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1 text-xs font-medium text-dc-accent'
                  : 'rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted hover:text-dc-text'
              }
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted hover:text-dc-text"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {loading ? <p className="mt-3 text-sm text-dc-muted">Loading…</p> : null}
        {!loading && data?.categories?.length ? (
          <ul className="mt-3 space-y-2">
            {(data.categories ?? []).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border/80 bg-dc-surface-muted px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-dc-text">{c.name}</p>
                  <p className="text-xs text-dc-muted">{c.count} badge(s)</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1.5 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted/80"
                  onClick={() =>
                    triggerPrint({ kind: 'category', categoryId: c.id, label: c.name })
                  }
                >
                  Print {c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && data && !(data.registrants ?? []).length ? (
          <p className="mt-3 text-sm text-dc-muted">No registrants in this roster filter.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
            onClick={() => triggerPrint({ kind: 'all' })}
            disabled={!(data?.registrants ?? []).length}
          >
            Print entire roster ({(data?.registrants ?? []).length})
          </button>
        </div>
      </section>

      {data && printRegistrants.length > 0 ? (
        <BadgePrintSheet
          eventSlug={eventSlug}
          eventTitle={data.eventTitle}
          logoUrl={data.logoUrl}
          registrants={printRegistrants}
          header={printHeader}
        />
      ) : null}
    </div>
  )
}
