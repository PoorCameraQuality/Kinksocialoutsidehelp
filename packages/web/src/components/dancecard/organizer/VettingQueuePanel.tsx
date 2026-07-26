'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ParticipationOfferComposer } from '@/components/dancecard/organizer/ParticipationOfferComposer'
import { VETTING_APPLICATION_PARAM, VETTING_ROLE_PARAM } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { TrustedRolesPanel } from '@/components/dancecard/organizer/TrustedRolesPanel'
import { TrustedRoleWorkflowCallout } from '@/components/dancecard/organizer/TrustedRoleWorkflowCallout'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { canEditVettingSafetyNotes, canMutateInCommandBridge } from '@/lib/dancecard/conventionCommandPermissions'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import { applicationAnswerEntries } from '@/lib/dancecard/vettingApplicationDisplay'

type ApplicationRow = {
  id: string
  scene_display_name: string
  email: string | null
  status: string
  organizer_notes: string | null
  payload: Record<string, unknown>
  trusted_role_id: string | null
  trusted_role: { id: string; name: string; apply_slug: string } | null
  created_at: string
  updated_at: string
}

const STATUSES = ['pending', 'review', 'approved', 'rejected'] as const

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  pending: 'Waiting for review',
  review: 'In review',
  approved: 'Approved',
  rejected: 'Not approved',
}

export function VettingQueuePanel({
  eventSlug,
  permissions,
  embedded = false,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
  embedded?: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterRoleId = searchParams.get(VETTING_ROLE_PARAM)
  const deepLinkApplicationId = searchParams.get(VETTING_APPLICATION_PARAM)

  const [apps, setApps] = useState<ApplicationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('pending')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [offerForId, setOfferForId] = useState<string | null>(null)

  const canMutate = canMutateInCommandBridge(permissions)
  const canEditNotes = canEditVettingSafetyNotes(permissions)

  const visibleApps = useMemo(() => {
    if (!filterRoleId) return apps
    return apps.filter((a) => a.trusted_role_id === filterRoleId)
  }, [apps, filterRoleId])

  const selected = visibleApps.find((a) => a.id === selectedId) ?? apps.find((a) => a.id === selectedId) ?? null
  const pendingCount = visibleApps.filter((a) => a.status === 'pending' || a.status === 'review').length

  useEffect(() => {
    if (!deepLinkApplicationId) return
    const hit = apps.find((a) => a.id === deepLinkApplicationId)
    if (hit) setSelectedId(hit.id)
  }, [apps, deepLinkApplicationId])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ applications: ApplicationRow[]; needsMigration?: boolean }>(
        eventSlug,
        '/vetting-applications',
      )
      setApps(res.applications ?? [])
      setNeedsMigration(Boolean(res.needsMigration))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load applications')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setNotes('')
      setStatus('pending')
      return
    }
    setNotes(selected.organizer_notes ?? '')
    setStatus((STATUSES.includes(selected.status as (typeof STATUSES)[number])
      ? selected.status
      : 'pending') as (typeof STATUSES)[number])
  }, [selected])

  async function save() {
    if (!selected || !canMutate) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/vetting-applications/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          organizerNotes: canEditNotes ? notes.trim() || null : undefined,
        }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (needsMigration) {
    return (
      <div className="rounded-xl border border-dc-warning/30 bg-dc-warning-muted px-4 py-5 text-sm text-dc-warning">
        <p className="font-medium">Trusted roles and applications are not enabled yet</p>
        <p className="mt-2 text-dc-warning/80">
          {supportCopy.vettingNotReady} Refresh this page after setup is complete.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-sm text-dc-text">
      <TrustedRoleWorkflowCallout eventSlug={eventSlug} variant="applications" />

      {!embedded ? (
        <p className="text-sm text-dc-muted">
          Review trusted-role applications. Not presenter requests (those live on the Program tab).
        </p>
      ) : null}

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-dc-text">Application queue</h2>
            <p className="mt-1 text-xs text-dc-muted">
              Pending: {pendingCount}. Approve or decline applicants and send participation offers when ready.
            </p>
          </div>
        </div>
        {filterRoleId ?
          <p className="mt-2 text-xs text-dc-accent">
            Filtered to one trusted role.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.delete(VETTING_ROLE_PARAM)
                params.delete(VETTING_APPLICATION_PARAM)
                setSearchParams(params, { replace: true })
              }}
            >
              Show all applications
            </button>
          </p>
        : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-dc-muted">
              {visibleApps.length
                ? `${visibleApps.length} application${visibleApps.length === 1 ? '' : 's'}`
                : 'No applications yet'}
              {pendingCount > 0 ? (
                <span className="ml-2 rounded-full bg-dc-warning-muted px-2 py-0.5 text-xs text-dc-warning">
                  {pendingCount} need review
                </span>
              ) : null}
            </p>
          </div>
          {err ? <p className="mb-2 text-dc-danger">{err}</p> : null}
          {!visibleApps.length ? (
            <div className="rounded-xl border border-dashed border-dc-border bg-dc-elevated-muted px-4 py-8 text-center">
              <p className="font-medium text-dc-muted">No applications in the queue</p>
              <p className="mt-2 text-xs text-dc-muted">
                Publish a trusted role and share its apply link. Submissions appear here for review.
              </p>
            </div>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {visibleApps.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={
                      selectedId === a.id
                        ? 'w-full rounded-xl border border-dc-accent-border bg-dc-accent-muted px-4 py-3 text-left'
                        : 'w-full rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3 text-left hover:bg-dc-elevated-muted'
                    }
                    onClick={() => setSelectedId(a.id)}
                  >
                    <p className="font-medium text-dc-text">{a.scene_display_name}</p>
                    <p className="mt-1 text-xs text-dc-muted">
                      {a.trusted_role?.name ?? 'General application'}
                      {' · '}
                      {STATUS_LABELS[
                        STATUSES.includes(a.status as (typeof STATUSES)[number])
                          ? (a.status as (typeof STATUSES)[number])
                          : 'pending'
                      ]}{' '}
                      · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          {!selected ? (
            <div className="py-8 text-center text-dc-muted">
              <p className="font-medium text-dc-muted">Select an application</p>
              <p className="mt-2 text-xs">Choose someone from the list to review their answers and update status.</p>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-dc-text">{selected.scene_display_name}</h3>
              {selected.trusted_role ? (
                <p className="mt-1 text-xs text-dc-accent">Role: {selected.trusted_role.name}</p>
              ) : null}
              {selected.email ? <p className="mt-1 text-xs text-dc-muted">{selected.email}</p> : null}
              <label className="mt-4 block text-xs text-dc-muted">
                Decision
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text disabled:opacity-50"
                  value={status}
                  disabled={!canMutate}
                  onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              {canEditNotes ? (
                <label className="mt-3 block text-xs text-dc-muted">
                  Organizer notes (safety / owner only)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                    rows={4}
                    value={notes}
                    disabled={!canMutate}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes for the safety team..."
                  />
                </label>
              ) : null}
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-dc-muted">Questionnaire answers</p>
              <dl className="mt-2 space-y-3">
                {applicationAnswerEntries(selected.payload).length ? (
                  applicationAnswerEntries(selected.payload).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2">
                      <dt className="text-xs font-medium text-dc-muted">{key}</dt>
                      <dd className="mt-1 text-sm text-dc-text">
                        {typeof value === 'string' || typeof value === 'number'
                          ? String(value)
                          : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-dc-muted">No questionnaire responses on file yet.</p>
                )}
              </dl>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-dc-muted">Technical details</summary>
                <pre className="mt-1 max-h-32 overflow-auto rounded border border-dc-border bg-dc-surface-muted p-2 text-[10px] text-dc-muted">
                  {JSON.stringify(selected.payload ?? {}, null, 2)}
                </pre>
              </details>
              {canMutate ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.status !== 'pending'}
                    className="rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
                    onClick={() => setOfferForId(selected.id)}
                  >
                    Send offer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full border border-dc-border px-4 py-2 text-xs font-semibold text-dc-muted disabled:opacity-40"
                    onClick={() => void save()}
                  >
                    Save decision
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-dc-muted">Read-only for your role.</p>
              )}
            </>
          )}
        </div>
      </div>
      <details className="rounded-xl border border-dc-border bg-dc-elevated-muted/50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-dc-text">Trusted role setup</summary>
        <div className="mt-4">
          <TrustedRolesPanel eventSlug={eventSlug} permissions={permissions} />
        </div>
      </details>
      {offerForId ?
        <ParticipationOfferComposer
          conventionKey={eventSlug}
          sourceType="vetting_application"
          sourceId={offerForId}
          showStaffFields
          defaultLetter="Thank you for applying. We would like to extend the following participation offer."
          onSent={() => {
            setOfferForId(null)
            void load()
          }}
          onCancel={() => setOfferForId(null)}
        />
      : null}
    </div>
  )
}
