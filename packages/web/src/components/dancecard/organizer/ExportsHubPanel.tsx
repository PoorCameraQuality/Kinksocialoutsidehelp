'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { IcalBusyPreviewPanel } from '@/components/dancecard/organizer/IcalBusyPreviewPanel'
import { organizerConventionApiBase, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerSubPath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import {
  EntityPickerModal,
  OrganizerConfirmDialog,
  type EntityPickerOption,
} from '@/components/dancecard/organizer/ui'

function downloadUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

type ExportAction = { label: string; description: string; onClick: () => void }

function ExportGroup({ title, description, actions }: { title: string; description: string; actions: ExportAction[] }) {
  return (
    <section className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
      <h3 className="text-sm font-semibold text-dc-text">{title}</h3>
      <p className="mt-1 text-xs text-dc-muted">{description}</p>
      <ul className="mt-3 divide-y divide-white/10">
        {actions.map((a) => (
          <li key={a.label} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-dc-text">{a.label}</p>
              <p className="text-xs text-dc-muted">{a.description}</p>
            </div>
            <button
              type="button"
              className="mt-1 shrink-0 text-left text-sm text-dc-accent hover:underline sm:mt-0"
              onClick={a.onClick}
            >
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

type ExportJob = { label: string; at: string }

function jobsKey(slug: string) {
  return `dc-export-jobs:${slug}`
}

function recordExportJob(slug: string, label: string) {
  try {
    const raw = localStorage.getItem(jobsKey(slug))
    const prev = raw ? (JSON.parse(raw) as ExportJob[]) : []
    const next = [{ label, at: new Date().toISOString() }, ...prev].slice(0, 20)
    localStorage.setItem(jobsKey(slug), JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

type FeedTokenRow = {
  id: string
  scope: string
  label: string | null
  filterTrackId: string | null
  filterLocationId: string | null
  filterPersonId: string | null
  createdAt: string
  revokedAt: string | null
}

function CalendarFeedsBlock({ slug }: { slug: string }) {
  const [tokens, setTokens] = useState<FeedTokenRow[]>([])
  const [needsMigration, setNeedsMigration] = useState(false)
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState<null | 'track' | 'location' | 'person'>(null)
  const [pickerOptions, setPickerOptions] = useState<EntityPickerOption[]>([])
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ tokens: FeedTokenRow[]; needsMigration?: boolean }>(
        slug,
        '/calendar-feeds',
      )
      setTokens(res.tokens ?? [])
      setNeedsMigration(Boolean(res.needsMigration))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load feeds')
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  async function openPicker(scope: 'track' | 'location' | 'person') {
    setPicker(scope)
    try {
      if (scope === 'track') {
        const res = await organizerDancecardFetch<{ tracks: { id: string; name: string }[] }>(slug, '/tracks')
        setPickerOptions((res.tracks ?? []).map((t) => ({ id: t.id, label: t.name })))
      } else if (scope === 'location') {
        const res = await organizerDancecardFetch<{ locations: { id: string; name: string }[] }>(slug, '/locations')
        setPickerOptions((res.locations ?? []).map((l) => ({ id: l.id, label: l.name })))
      } else {
        const res = await organizerDancecardFetch<{ people: { id: string; sceneName: string }[] }>(slug, '/people')
        setPickerOptions((res.people ?? []).map((p) => ({ id: p.id, label: p.sceneName })))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load options')
      setPicker(null)
    }
  }

  async function createFeed(scope: 'full' | 'track' | 'location' | 'person', filterId?: string) {
    setBusy(true)
    setErr(null)
    try {
      const body: Record<string, unknown> = { scope, label: `${scope} feed` }
      if (scope === 'track' && filterId) body.filterTrackId = filterId
      if (scope === 'location' && filterId) body.filterLocationId = filterId
      if (scope === 'person' && filterId) body.filterPersonId = filterId
      const res = await organizerDancecardFetch<{ subscribeUrl: string }>(slug, '/calendar-feeds', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setLastUrl(res.subscribeUrl)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    try {
      await organizerDancecardFetch(slug, `/calendar-feeds/${id}/revoke`, { method: 'POST' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setBusy(false)
      setRevokeId(null)
    }
  }

  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
      <OrganizerConfirmDialog
        open={revokeId !== null}
        title="Revoke feed?"
        message="Subscribers will stop receiving updates from this URL."
        destructive
        confirmLabel="Revoke"
        busy={busy}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => revokeId && void revoke(revokeId)}
      />
      <EntityPickerModal
        open={picker !== null}
        title={picker === 'track' ? 'Choose track' : picker === 'location' ? 'Choose location' : 'Choose person'}
        options={pickerOptions}
        onCancel={() => setPicker(null)}
        onSelect={(id) => {
          const scope = picker!
          setPicker(null)
          void createFeed(scope, id)
        }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Private calendar subscribe links</p>
      <p className="mt-2 text-xs text-dc-muted">
        Token-based feeds for attendees (full program or filtered). Copy each new link once. We do not show it again.
        Revoke old links when you rotate. For a one-shot download, use Activities CSV or the public program ICS link on
        the Program tab.
      </p>
      {needsMigration ? (
        <p className="mt-2 text-xs text-dc-warning">
          Calendar links are not enabled on this server yet. Ask your host to apply the latest Dancecard update.
        </p>
      ) : null}
      {err ? <p className="mt-2 text-xs text-dc-danger">{err}</p> : null}
      {lastUrl ? (
        <div className="mt-3 rounded-lg border border-dc-accent-border bg-dc-accent-muted p-2 text-xs text-dc-accent-foreground">
          <p className="font-semibold">New subscribe URL (copy now. Won&apos;t be shown again):</p>
          <p className="mt-1 break-all font-mono text-[11px]">{lastUrl}</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || needsMigration}
          className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-accent-foreground hover:bg-dc-accent-muted disabled:opacity-40"
          onClick={() => void createFeed('full')}
        >
          Create full-program feed
        </button>
        <button
          type="button"
          disabled={busy || needsMigration}
          className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-accent-foreground hover:bg-dc-accent-muted disabled:opacity-40"
          onClick={() => void openPicker('track')}
        >
          Per-track…
        </button>
        <button
          type="button"
          disabled={busy || needsMigration}
          className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-accent-foreground hover:bg-dc-accent-muted disabled:opacity-40"
          onClick={() => void openPicker('location')}
        >
          Per-room…
        </button>
        <button
          type="button"
          disabled={busy || needsMigration}
          className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-accent-foreground hover:bg-dc-accent-muted disabled:opacity-40"
          onClick={() => void openPicker('person')}
        >
          Per-presenter…
        </button>
      </div>
      <ul className="mt-4 space-y-2 text-xs">
        {tokens.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-dc-border pt-2">
            <span>
              <span className="font-mono text-dc-text">{t.scope}</span>
              {t.label ? <span className="text-dc-muted"> · {t.label}</span> : null}
              {t.revokedAt ? <span className="text-dc-danger"> (revoked)</span> : <span className="text-dc-success"> (active)</span>}
            </span>
            {!t.revokedAt ? (
              <button
                type="button"
                disabled={busy}
                className="text-dc-danger hover:underline disabled:opacity-40"
                onClick={() => setRevokeId(t.id)}
              >
                Revoke
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExportsHubPanel({
  eventSlug,
  workspaceBase,
}: {
  eventSlug: string
  /** Kink Social org-scoped workspace base, e.g. /organizer/orgs/:org/conventions/:conv */
  workspaceBase?: string
}) {
  const slug = eventSlug.toLowerCase()
  const fallbackPrintSchedule = useOrganizerSubPath('/print/schedule')
  const fallbackPrintSigns = useOrganizerSubPath('/print/venue-signs')
  const printScheduleHref = workspaceBase ? `${workspaceBase}/print/schedule` : fallbackPrintSchedule
  const printSignsHref = workspaceBase ? `${workspaceBase}/print/venue-signs` : fallbackPrintSigns
  const base = organizerConventionApiBase(slug)
  const [jobs, setJobs] = useState<ExportJob[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(jobsKey(slug))
      if (raw) setJobs(JSON.parse(raw) as ExportJob[])
    } catch {
      setJobs([])
    }
  }, [slug])

  function exportAndLog(label: string, path: string) {
    downloadUrl(path)
    setJobs(recordExportJob(slug, label))
  }

  return (
    <div className="space-y-6 text-sm text-dc-muted">
      <div>
        <h2 className="font-serif text-lg text-dc-text">Exports</h2>
        <p className="mt-1 text-dc-muted">
          Download spreadsheets for planning, or open print-friendly pages and save as PDF from your browser.
        </p>
        <button
          type="button"
          className="dc-gold-btn mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
          onClick={() => exportAndLog('Event pack (JSON)', `${base}/exports/event-pack`)}
        >
          Download event pack (JSON)
        </button>
      </div>

      <section className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
        <h3 className="text-sm font-semibold text-dc-text">Recent downloads</h3>
        <p className="mt-1 text-xs text-dc-muted">Tracked in this browser only.</p>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-dc-muted">
          {jobs.map((j, i) => (
            <li key={`${j.at}-${i}`}>
              {new Date(j.at).toLocaleString()} · {j.label}
            </li>
          ))}
          {!jobs.length ? <li>No exports yet this browser.</li> : null}
        </ul>
      </section>

      <ExportGroup
        title="Program and schedule"
        description="Share the grid with vendors, AV, or print shops."
        actions={[
          {
            label: 'Activities',
            description: 'Full program grid with times, rooms, and activity details.',
            onClick: () => exportAndLog('Activities', `${base}/exports/sessions?format=csv`),
          },
          {
            label: 'Scheduling problems',
            description: 'Spreadsheet of double-booked rooms, presenters, or photo-policy flags.',
            onClick: () => exportAndLog('Scheduling problems', `${base}/exports/conflict-report?format=csv`),
          },
        ]}
      />

      <ExportGroup
        title="Registration and compliance"
        description="Back-office lists for check-in, policies, and photography."
        actions={[
          {
            label: 'Registrants',
            description: 'Attendee roster with status and ticket category.',
            onClick: () => exportAndLog('Registrants', `${base}/registrants/export`),
          },
          {
            label: 'Policy acceptances',
            description: 'Ledger of who accepted which policy version.',
            onClick: () => exportAndLog('Policy acceptances', `${base}/policy-acceptances/export?format=csv`),
          },
        ]}
      />

      <section className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
        <h3 className="text-sm font-semibold text-dc-text">Print layouts</h3>
        <p className="mt-1 text-xs text-dc-muted">Opens a new tab; use Print, then Save as PDF.</p>
        <ul className="mt-3 divide-y divide-white/10">
          <li className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-dc-text">Printable schedule</p>
              <p className="text-xs text-dc-muted">Room-by-room or full run-of-show for posting on site.</p>
            </div>
            <Link
              className="text-sm text-dc-accent hover:underline"
              href={printScheduleHref}
              target="_blank"
            >
              Open
            </Link>
          </li>
          <li className="flex flex-col gap-0.5 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-dc-text">Venue and room signs</p>
              <p className="text-xs text-dc-muted">Directional signs sized for doors and hallways.</p>
            </div>
            <Link
              className="text-sm text-dc-accent hover:underline"
              href={printSignsHref}
              target="_blank"
            >
              Open
            </Link>
          </li>
        </ul>
      </section>

      <CalendarFeedsBlock slug={slug} />
      <IcalBusyPreviewPanel eventSlug={slug} />
    </div>
  )
}
