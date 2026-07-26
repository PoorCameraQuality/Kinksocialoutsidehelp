'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { canEditVettingSafetyNotes } from '@/lib/dancecard/conventionCommandPermissions'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type Incident = {
  id: string
  reportedAt: string
  summary: string
  safetyNotes: string | null
  status: string
  locationLabel: string | null
}

export function SafetyIncidentsPanel({
  eventSlug,
  permissions,
  readOnly,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
  readOnly: boolean
}) {
  const [items, setItems] = useState<Incident[]>([])
  const [summary, setSummary] = useState('')
  const [safetyNotes, setSafetyNotes] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canSafety = canEditVettingSafetyNotes(permissions)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const data = await organizerDancecardFetch<{ incidents: Incident[] }>(eventSlug, '/safety-incidents')
      setItems(data.incidents)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    if (!summary.trim() || readOnly) return
    try {
      await organizerDancecardFetch(eventSlug, '/safety-incidents', {
        method: 'POST',
        body: JSON.stringify({
          summary: summary.trim(),
          safetyNotes: canSafety ? safetyNotes.trim() || undefined : undefined,
        }),
      })
      setSummary('')
      setSafetyNotes('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
      throw e
    }
  }

  return (
    <Panel className="space-y-4">
      <div>
        <h2 className="font-serif text-lg text-dc-text">Safety incidents</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Calm, human-reviewed log for safety leads. No autonomous resolution. Authorized staff decide next steps.
        </p>
      </div>
      {items.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Open incidents</p>
            <p className="mt-0.5 font-serif text-xl text-red-400">
              {items.filter((i) => i.status !== 'resolved').length}
            </p>
          </div>
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Resolved</p>
            <p className="mt-0.5 font-serif text-xl text-emerald-400">
              {items.filter((i) => i.status === 'resolved').length}
            </p>
          </div>
        </div>
      ) : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {!readOnly ? (
        <>
          <button
            type="button"
            className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? 'Cancel' : 'Log incident'}
          </button>
          {formOpen ? (
            <div className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What happened (summary)…"
                rows={3}
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm"
              />
              {canSafety ? (
                <textarea
                  value={safetyNotes}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  placeholder="Restricted safety notes…"
                  rows={2}
                  className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void create()
                    .then(() => setFormOpen(false))
                    .catch(() => {})
                }}
                className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
              >
                Save incident
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {!items.length ? (
        <PeopleEmptyState title="No incidents logged">
          Safety incidents recorded by authorized staff will appear here.
        </PeopleEmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((inc) => (
            <li key={inc.id} className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3 text-sm">
              <p className="text-xs text-dc-muted">
                {new Date(inc.reportedAt).toLocaleString()} · {inc.status}
              </p>
              <p className="mt-1 font-medium text-dc-text">{inc.summary}</p>
              {inc.safetyNotes ? <p className="mt-2 text-xs text-dc-muted">Safety: {inc.safetyNotes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
