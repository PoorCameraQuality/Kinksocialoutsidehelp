'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerToast } from '@/components/dancecard/organizer/ui'
import type { DancecardConflict } from '@/lib/dancecard/conflictScanner'
import type {
  ScheduleChangeImpactReport,
  ScheduleChangePresenter,
} from '@/lib/dancecard/scheduleChangeImpact'

export type ScheduleChangeImpactPayload = ScheduleChangeImpactReport & {
  slotId: string
}

function defaultSelectedIds(report: ScheduleChangeImpactReport): Set<string> {
  const ids = new Set<string>()
  for (const h of report.dancecardHolders) ids.add(h.accountId)
  for (const p of report.presenters) {
    if (p.accountId) ids.add(p.accountId)
  }
  return ids
}

export function ScheduleChangeImpactModal({
  eventSlug,
  payload,
  onClose,
}: {
  eventSlug: string
  payload: ScheduleChangeImpactPayload
  onClose: () => void
}) {
  const toast = useOrganizerToast()
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelectedIds(payload))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [createEmailDraft, setCreateEmailDraft] = useState(false)

  const programLink = useMemo(() => {
    if (typeof window === 'undefined') return `/conventions/${eventSlug}#program`
    return `${window.location.origin}/conventions/${eventSlug}#program`
  }, [eventSlug])

  const copyText = `${payload.summaryText}\n${programLink}`

  const toggle = (accountId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  const copyAnnouncement = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      toast.push('Announcement copied to clipboard.')
    } catch {
      setErr('Could not copy to clipboard.')
    }
  }

  const notifySelected = async () => {
    const accountIds = Array.from(selected)
    if (!accountIds.length) {
      setErr('Select at least one person to notify.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ ok: boolean; notified: number }>(
        eventSlug,
        `/program-slots/${payload.slotId}/notify-schedule-change`,
        {
          method: 'POST',
          body: JSON.stringify({
            accountIds,
            before: payload.before,
            after: payload.after,
            createEmailDraft,
          }),
        },
      )
      toast.push(`Notified ${res.notified ?? accountIds.length} attendee${accountIds.length === 1 ? '' : 's'}.`)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Notify failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h2 className="text-lg font-semibold text-dc-text">Schedule change impact</h2>
      <p className="mt-1 text-sm text-dc-muted">{payload.summaryText}</p>
      <p className="mt-2 text-xs text-dc-muted">
        Saving is complete. Choose who should get an in-app notice on Program. Dancecard times are not changed
        automatically.
      </p>

      <ImpactSection title={`On attendee dancecards (${payload.dancecardHolders.length})`}>
        {payload.dancecardHolders.length === 0 ? (
          <p className="text-xs text-dc-muted">No one has this session on their dancecard.</p>
        ) : (
          <ul className="space-y-1">
            {payload.dancecardHolders.map((h) => (
              <NotifyRow
                key={h.accountId}
                checked={selected.has(h.accountId)}
                onChange={() => toggle(h.accountId)}
                label={h.displayName}
              />
            ))}
          </ul>
        )}
      </ImpactSection>

      <ImpactSection title={`Presenters / staff on session (${payload.presenters.length})`}>
        {payload.presenters.length === 0 ? (
          <p className="text-xs text-dc-muted">No presenters assigned.</p>
        ) : (
          <ul className="space-y-1">
            {payload.presenters.map((p) => (
              <PresenterRow
                key={p.personId}
                presenter={p}
                checked={p.accountId ? selected.has(p.accountId) : false}
                onChange={p.accountId ? () => toggle(p.accountId!) : undefined}
              />
            ))}
          </ul>
        )}
      </ImpactSection>

      <ImpactSection title={`Program conflicts (${payload.programConflicts.length})`}>
        {payload.programConflicts.length === 0 ? (
          <p className="text-xs text-dc-muted">No scanner conflicts tied to this session.</p>
        ) : (
          <ul className="space-y-2 text-xs text-dc-text">
            {payload.programConflicts.map((c) => (
              <ConflictLine key={c.id} conflict={c} />
            ))}
          </ul>
        )}
      </ImpactSection>

      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}

      <label className="mt-4 flex items-center gap-2 text-xs text-dc-muted">
        <input type="checkbox" checked={createEmailDraft} onChange={(e) => setCreateEmailDraft(e.target.checked)} />
        Also create email campaign draft (Messaging tab)
      </label>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-full border border-dc-border px-3 py-1.5 text-sm text-dc-text"
          onClick={() => void copyAnnouncement()}
        >
          Copy announcement
        </button>
        <button
          type="button"
          className="rounded-full border border-dc-border px-3 py-1.5 text-sm text-dc-muted"
          onClick={onClose}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full bg-dc-accent px-4 py-1.5 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
          onClick={() => void notifySelected()}
        >
          {busy ? 'Sending…' : 'Notify selected'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

function ImpactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">{title}</h3>
      <SectionBody>{children}</SectionBody>
    </section>
  )
}

function NotifyRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text">
        <input type="checkbox" checked={checked} onChange={onChange} />
        {label}
      </label>
    </li>
  )
}

function PresenterRow({
  presenter,
  checked,
  onChange,
}: {
  presenter: ScheduleChangePresenter
  checked: boolean
  onChange?: () => void
}) {
  const name = presenter.sceneName || 'Unnamed'
  const role = presenter.role ? ` (${presenter.role.replace(/_/g, ' ')})` : ''
  if (!presenter.accountId) {
    return (
      <li className="text-sm text-dc-muted">
        {name}
        {role}. No login linked
      </li>
    )
  }
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text">
        <input type="checkbox" checked={checked} onChange={onChange} />
        {name}
        {role}
      </label>
    </li>
  )
}

function ConflictLine({ conflict }: { conflict: DancecardConflict }) {
  return (
    <li className="rounded-lg border border-amber-400/30 bg-amber-50/80 px-2 py-1.5">
      <p className="font-medium text-amber-950">{conflict.title}</p>
      {conflict.detail ? <p className="text-amber-900/80">{conflict.detail}</p> : null}
    </li>
  )
}

function ModalBackdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-dc-border bg-dc-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function SectionBody({ children }: { children: ReactNode }) {
  return <div className="mt-2 rounded-lg border border-dc-border/60 bg-dc-elevated-muted p-3">{children}</div>
}
