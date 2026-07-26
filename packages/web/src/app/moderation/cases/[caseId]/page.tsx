import { useState } from 'react'

import { Link, useOutletContext, useParams } from 'react-router-dom'

import {

  MEDIA_UPLOAD_STATUSES,

  MODERATION_CASE_STATUS_VALUES,

  POLICY_REASON_LABELS,

  type PolicyReason,

} from '@c2k/shared'

import {

  formatMediaMetadataLines,

  isMediaAssetSnapshot,

  mediaMetadataFromSnapshot,

  snapshotDisplayText,

  useApiModerationTsCaseDetail,

  viewMediaContentUrl,

  type ModerationTsContentSnapshot,

  type ModerationTsMediaModeration,

} from '@/hooks/useApiModerationTs'

import ModerationIncidentClusterPanel from '@/components/moderation/ModerationIncidentClusterPanel'
import ModerationTrustSummaryPanel from '@/components/moderation/ModerationTrustSummaryPanel'
import {
  enforcementHint,
  isMediaCaseTarget,
  supportsHideContent,
} from '@/lib/moderation/case-action-config'
import {
  defaultModerationOutletContext,
  type ModerationOutletContext,
} from '@/lib/moderation/moderation-outlet-context'



function labelReason(reason: string): string {

  return POLICY_REASON_LABELS[reason as PolicyReason] ?? reason.replace(/_/g, ' ').toLowerCase()

}



function labelStatus(status: string): string {

  return status.replace(/_/g, ' ').toLowerCase()

}



function eventLabel(eventType: string): string {

  return eventType.replace(/\./g, ' · ').replace(/_/g, ' ')

}



function eventNote(payload: Record<string, unknown> | null): string | null {

  if (!payload) return null

  if (typeof payload.note === 'string' && payload.note.trim()) return payload.note

  if (typeof payload.action === 'string') return `Action: ${payload.action}`

  return null

}



function isDenylistHashCase(snapshots: ModerationTsContentSnapshot[]): boolean {

  for (const snap of snapshots) {

    const meta = mediaMetadataFromSnapshot(snap.snapshot)

    const scanners = meta?.scannerSummary?.scanners ?? []

    if (scanners.some((s) => s.name === 'exact_hash' && s.status === 'BLOCKED')) {

      return true

    }

  }

  return false

}



function SnapshotPanel({

  snapshot,

  revealed,

  onReveal,

  busy,

  isMediaCase,

}: {

  snapshot: ModerationTsContentSnapshot

  revealed: boolean

  onReveal: () => void

  busy: boolean

  isMediaCase: boolean

}) {

  const snap = snapshot.snapshot

  const mediaMeta = mediaMetadataFromSnapshot(snap)

  const isMedia = isMediaAssetSnapshot(snap)

  const text = snapshotDisplayText(snap)

  const alwaysVisible = isMedia || isMediaCase



  return (

    <div className="rounded-xl border border-dc-border bg-dc-surface-muted/50 p-4 space-y-3">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <p className="text-xs font-medium text-dc-muted uppercase tracking-wide">

          {isMedia || isMediaCase ? 'Metadata snapshot' : 'Content snapshot'}

        </p>

        <p className="text-xs text-dc-muted font-mono">

          {snapshot.targetContentType} · {snapshot.targetContentId.slice(0, 10)}…

        </p>

      </div>



      <div className="relative rounded-lg border border-dc-border bg-dc-elevated/80 p-4 min-h-[5rem]">

        {isMedia && mediaMeta ?

          <div className="space-y-2">

            <p className="text-sm font-medium text-dc-text">

              {typeof snap.label === 'string' ? snap.label : 'Media asset'}

            </p>

            <dl className="grid gap-1.5 text-xs text-dc-muted">

              {formatMediaMetadataLines(

                mediaMeta,

                typeof snap.targetId === 'string' ? snap.targetId : snapshot.targetContentId

              ).map((line) => {

                const sep = line.indexOf(': ')

                const term = sep >= 0 ? line.slice(0, sep) : line

                const value = sep >= 0 ? line.slice(sep + 2) : ''

                return (

                  <div key={line} className="grid grid-cols-[9rem_1fr] gap-2">

                    <dt className="font-medium text-dc-text-muted">{term}</dt>

                    <dd className="text-dc-text break-words">{value}</dd>

                  </div>

                )

              })}

            </dl>

            <p className="text-[11px] text-dc-muted pt-1">

              Storage keys and raw URLs are not shown in moderation snapshots. Use the quarantined media

              viewer below to inspect file bytes.

            </p>

          </div>

        : (

          <p

            className={[

              'text-sm text-dc-text whitespace-pre-wrap break-words transition-[filter]',

              alwaysVisible || revealed ? '' : 'blur-md select-none',

            ].join(' ')}

            aria-hidden={!alwaysVisible && !revealed}

          >

            {text}

          </p>

        )}

        {!alwaysVisible && !revealed ?

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-dc-surface/40 rounded-lg">

            <p className="text-xs text-dc-muted text-center px-4">

              Sensitive content is blurred by default. Reveal only when you are ready to review.

            </p>

            <button

              type="button"

              disabled={busy}

              onClick={onReveal}

              className="px-4 py-2 rounded-xl bg-dc-accent text-dc-accent-foreground text-xs font-semibold disabled:opacity-50"

            >

              {busy ? 'Recording reveal…' : 'Reveal snapshot'}

            </button>

          </div>

        : null}

      </div>



      {!alwaysVisible && revealed ?

        <p className="text-xs text-amber-200/90">

          Reveal logged to moderation audit (<code className="text-[11px]">content.revealed</code>).

        </p>

      : null}

    </div>

  )

}



function MediaModerationPanel({

  caseId,

  mediaModeration,

  denylistHash,

  memberReported,

}: {

  caseId: string

  mediaModeration: ModerationTsMediaModeration

  denylistHash: boolean

  memberReported: boolean

}) {

  return (

    <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

      <h3 className="text-sm font-semibold text-dc-text">Quarantined media review</h3>



      <p className="text-xs text-dc-muted leading-relaxed">

        {denylistHash ?

          <>

            <strong className="text-dc-text">Denylist hash match:</strong> you may action this case

            without viewing the file bytes.

          </>

        : memberReported ?

          <>

            <strong className="text-dc-text">Member-reported media:</strong> view quarantined bytes

            before marking no violation.

          </>

        : (

          'Review metadata and quarantined bytes before closing the case.'

        )}

      </p>



      {mediaModeration.malwareBlocked ?

        <p className="text-sm text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">

          Malware detected. Bytes not available to moderators.

        </p>

      : mediaModeration.canViewBytes ?

        <div className="rounded-lg border border-dc-border bg-dc-surface-muted/50 p-3">

          <p className="text-xs text-dc-muted mb-2">Quarantined file preview (mod-only, audited)</p>

          <img

            src={viewMediaContentUrl(caseId)}

            alt="Quarantined media under review"

            className="max-h-80 max-w-full rounded-lg border border-dc-border object-contain"

          />

        </div>

      : (

        <p className="text-sm text-dc-muted">File bytes are not available (storage offline or asset removed).</p>

      )}

      <p className="text-xs text-dc-muted pt-1">

        Use enforcement actions below to delete, keep quarantined, or close the case.

      </p>

    </section>

  )

}



export default function ModerationCaseDetailPage() {

  const { caseId } = useParams<{ caseId: string }>()

  const { refreshModeration } = useOutletContext<ModerationOutletContext>() ?? defaultModerationOutletContext

  const { status, detail, error, reload, patchCase, addNote, revealSnapshot, postAction } =

    useApiModerationTsCaseDetail(true, caseId)



  const [revealedSnapshots, setRevealedSnapshots] = useState<Record<string, boolean>>({})

  const [revealBusy, setRevealBusy] = useState(false)

  const [noteDraft, setNoteDraft] = useState('')

  const [actionNote, setActionNote] = useState('')

  const [statusDraft, setStatusDraft] = useState('')

  const [busy, setBusy] = useState<string | null>(null)



  const handleReveal = async (snapshotId: string) => {

    setRevealBusy(true)

    setBusy('reveal')

    try {

      await revealSnapshot()

      setRevealedSnapshots((m) => ({ ...m, [snapshotId]: true }))

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Reveal failed')

    } finally {

      setRevealBusy(false)

      setBusy(null)

    }

  }



  const handleAddNote = async () => {

    const trimmed = noteDraft.trim()

    if (!trimmed) return

    setBusy('note')

    try {

      await addNote(trimmed)

      setNoteDraft('')

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Could not save note')

    } finally {

      setBusy(null)

    }

  }



  const handleAction = async (action: string, requireReason = false) => {

    const trimmed = actionNote.trim()

    const afterSuccess = () => {
      setActionNote('')
      refreshModeration()
    }

    if (requireReason && !trimmed) {

      const reason = window.prompt('Reason required for this action:')

      if (!reason?.trim()) return

      setBusy(action)

      try {

        await postAction(action as Parameters<typeof postAction>[0], reason.trim())

        afterSuccess()

      } catch (e) {

        alert(e instanceof Error ? e.message : 'Action failed')

      } finally {

        setBusy(null)

      }

      return

    }

    setBusy(action)

    try {

      await postAction(action as Parameters<typeof postAction>[0], trimmed || undefined)

      afterSuccess()

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Action failed')

    } finally {

      setBusy(null)

    }

  }



  const handleStatusChange = async () => {

    if (!statusDraft || !detail) return

    setBusy('status')

    try {

      await patchCase({ status: statusDraft })

      setStatusDraft('')

      refreshModeration()

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Status update failed')

    } finally {

      setBusy(null)

    }

  }



  if (!caseId) {

    return <p className="text-sm text-dc-muted">Missing case id.</p>

  }



  if (status === 'loading') {

    return <p className="text-sm text-dc-muted">Loading case…</p>

  }



  if (error) {

    return (

      <div className="space-y-3">

        <p className="text-sm text-red-300" role="alert">

          {error}

        </p>

        <div className="flex flex-wrap gap-3 text-sm">

          <button

            type="button"

            onClick={() => void reload()}

            className="text-dc-accent hover:underline"

          >

            Retry

          </button>

          <Link to="/moderation/cases" className="text-dc-accent hover:underline">

            Back to cases

          </Link>

          <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">

            Dashboard

          </Link>

        </div>

      </div>

    )

  }



  if (!detail) {

    return (

      <div className="space-y-3">

        <p className="text-sm text-dc-muted">Case not found.</p>

        <Link to="/moderation/cases" className="text-sm text-dc-accent hover:underline">

          Back to cases

        </Link>

      </div>

    )

  }



  const { case: caseRow, reports, snapshots, events, mediaModeration, contextLinks = [] } = detail

  const isMediaCase = isMediaCaseTarget(caseRow.targetContentType)

  const hasMediaSnapshot = snapshots.some(
    (snap) => isMediaAssetSnapshot(snap.snapshot) || mediaMetadataFromSnapshot(snap.snapshot) != null
  )

  const showMediaActions = isMediaCase || hasMediaSnapshot

  const canHide = supportsHideContent(caseRow.targetContentType)

  const mediaRemoved = mediaModeration?.uploadStatus === MEDIA_UPLOAD_STATUSES.removed

  const mediaQuarantined = !mediaRemoved

  const denylistHash = isDenylistHashCase(snapshots)

  const memberReported = reports.length > 0 && !denylistHash



  return (

    <div className="space-y-6">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div>

          <Link to="/moderation/dashboard" className="text-xs text-dc-muted hover:text-dc-accent hover:underline">

            T&amp;S dashboard

          </Link>

          <span className="text-dc-muted mx-1">·</span>

          <Link to="/moderation/cases" className="text-xs text-dc-accent hover:underline">

            ← All cases

          </Link>

          <h2 className="text-lg font-semibold text-dc-text mt-2">{labelReason(caseRow.policyReason)}</h2>

          <p className="text-sm text-dc-muted mt-1">

            {caseRow.targetContentType} · <span className="font-mono text-xs">{caseRow.targetContentId}</span>

          </p>

          <p className="text-xs text-dc-muted mt-1">

            Opened {new Date(caseRow.createdAt).toLocaleString()}

            {caseRow.assignedToUsername ? ` · Assigned to ${caseRow.assignedToUsername}` : ' · Unassigned'}

          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <span className="text-xs font-medium rounded-lg border border-dc-border px-2 py-1 text-dc-muted capitalize">

            {labelStatus(caseRow.status)}

          </span>

          <span className="text-xs font-medium rounded-lg bg-dc-accent/10 px-2 py-1 text-dc-accent">

            {caseRow.severity}

          </span>

          <span className="text-xs font-medium rounded-lg border border-dc-border px-2 py-1 text-dc-muted">

            {caseRow.queue.replace(/_/g, ' ').toLowerCase()}

          </span>

        </div>

      </div>

      <ModerationTrustSummaryPanel userId={caseRow.targetUserId} />

      <ModerationIncidentClusterPanel caseId={caseId} />

      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

        <h3 className="text-sm font-semibold text-dc-text">Member reports ({reports.length})</h3>

        {reports.length === 0 ?

          <p className="text-sm text-dc-muted">No linked reports.</p>

        : (

          <ul className="space-y-3">

            {reports.map((report) => (

              <li key={report.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-3 text-sm">

                <p className="text-xs text-dc-muted">

                  {report.reporterUsername ?? report.reporterId.slice(0, 8)}

                  {' · '}

                  {new Date(report.createdAt).toLocaleString()}

                </p>

                <p className="mt-1 text-dc-text">{labelReason(report.policyReason)}</p>

                {report.body ?

                  <blockquote className="mt-2 text-xs border-l-2 border-dc-border pl-3 text-dc-muted italic whitespace-pre-wrap">

                    {report.body}

                  </blockquote>

                : null}

              </li>

            ))}

          </ul>

        )}

      </section>



      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <h3 className="text-sm font-semibold text-dc-text">Content snapshots</h3>

          {contextLinks.length > 0 ?

            <div className="flex flex-wrap gap-2">

              {contextLinks.map((ctx) => (

                <Link

                  key={ctx.href}

                  to={ctx.href}

                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dc-accent text-dc-accent-foreground text-xs font-semibold hover:opacity-90"

                >

                  {ctx.label}

                  <span aria-hidden>→</span>

                </Link>

              ))}

            </div>

          : (

            <p className="text-xs text-dc-muted max-w-sm text-right">

              Source location unavailable. Content may have been removed or has no public page.

            </p>

          )}

        </div>

        {snapshots.length === 0 ?

          <p className="text-sm text-dc-muted">No snapshot captured for this case yet.</p>

        : (

          <div className="space-y-4">

            {snapshots.map((snap) => (

              <SnapshotPanel

                key={snap.id}

                snapshot={snap}

                revealed={!!revealedSnapshots[snap.id]}

                busy={revealBusy}

                isMediaCase={isMediaCase}

                onReveal={() => void handleReveal(snap.id)}

              />

            ))}

          </div>

        )}

      </section>



      {mediaModeration && caseId ?

        <MediaModerationPanel

          caseId={caseId}

          mediaModeration={mediaModeration}

          denylistHash={denylistHash}

          memberReported={memberReported}

        />

      : null}



      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

        <h3 className="text-sm font-semibold text-dc-text">Enforcement actions</h3>

        <p className="text-xs text-dc-muted leading-relaxed">

          {enforcementHint(caseRow.targetContentType, hasMediaSnapshot)}

        </p>

        <textarea

          value={actionNote}

          onChange={(e) => setActionNote(e.target.value)}

          placeholder={
            showMediaActions ?
              'Reason required for delete or restore (optional for other actions)'
            : 'Optional note for this action'
          }

          rows={2}

          className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted"

        />

        {showMediaActions ?

          <div className="flex flex-wrap gap-2">

            {mediaQuarantined ?

              <button

                type="button"

                disabled={busy !== null}

                onClick={() => void handleAction('keep_quarantined')}

                className="px-3 py-1.5 rounded-lg border border-dc-border text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"

              >

                Keep quarantined

              </button>

            : null}

            {!mediaRemoved ?

              <button

                type="button"

                disabled={busy !== null}

                onClick={() => void handleAction('remove_media', true)}

                className="px-3 py-1.5 rounded-lg border border-red-500/40 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-40"

              >

                Delete content

              </button>

            : null}

            {mediaRemoved && !mediaModeration?.malwareBlocked ?

              <button

                type="button"

                disabled={busy !== null}

                onClick={() => void handleAction('restore_media', true)}

                className="px-3 py-1.5 rounded-lg border border-dc-border text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"

              >

                Restore content

              </button>

            : null}

          </div>

        : null}

        <div className="flex flex-wrap gap-2">

          {canHide && !showMediaActions ?

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleAction('hide_content')}
              className="px-3 py-1.5 rounded-lg border border-dc-border text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"
            >
              Hide content
            </button>

          : null}

          {!showMediaActions ?
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleAction('delete_content', true)}
                className="px-3 py-1.5 rounded-lg border border-red-500/40 text-xs text-red-200 hover:bg-red-950/30 disabled:opacity-40"
              >
                Delete content
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleAction('suspend_subject', true)}
                className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-100 hover:bg-amber-950/30 disabled:opacity-40"
              >
                Suspend subject
              </button>
            </>
          : null}

          {(['mark_no_violation', 'close_duplicate', 'escalate'] as const).map((action) => (

            <button

              key={action}

              type="button"

              disabled={busy !== null}

              onClick={() => void handleAction(action)}

              className="px-3 py-1.5 rounded-lg border border-dc-border text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40 capitalize"

            >

              {action.replace(/_/g, ' ')}

            </button>

          ))}

        </div>

        <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-dc-border">

          <label className="text-xs text-dc-muted">

            Change status

            <select

              value={statusDraft}

              onChange={(e) => setStatusDraft(e.target.value)}

              className="mt-1 block min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text min-w-[12rem]"

            >

              <option value="">Select status…</option>

              {MODERATION_CASE_STATUS_VALUES.map((s) => (

                <option key={s} value={s} disabled={s === caseRow.status}>

                  {labelStatus(s)}

                </option>

              ))}

            </select>

          </label>

          <button

            type="button"

            disabled={!statusDraft || busy !== null}

            onClick={() => void handleStatusChange()}

            className="min-h-10 px-4 rounded-xl border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"

          >

            Update status

          </button>

        </div>

      </section>



      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

        <h3 className="text-sm font-semibold text-dc-text">Internal notes</h3>

        <textarea

          value={noteDraft}

          onChange={(e) => setNoteDraft(e.target.value)}

          placeholder="Add an internal note (visible to platform mods only)"

          rows={3}

          className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted"

        />

        <button

          type="button"

          disabled={!noteDraft.trim() || busy !== null}

          onClick={() => void handleAddNote()}

          className="px-4 py-2 rounded-xl bg-dc-accent text-dc-accent-foreground text-sm font-medium disabled:opacity-50"

        >

          Add note

        </button>

      </section>



      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">

        <h3 className="text-sm font-semibold text-dc-text">Audit timeline</h3>

        {events.length === 0 ?

          <p className="text-sm text-dc-muted">No moderation events yet.</p>

        : (

          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">

            {events.map((ev) => {

              const note = eventNote(ev.payload)

              return (

                <li

                  key={ev.id}

                  className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5 text-sm"

                >

                  <p className="font-medium text-dc-text">{eventLabel(ev.eventType)}</p>

                  <p className="mt-1 text-xs text-dc-text-muted">

                    {ev.actorUsername ?? ev.actorUserId.slice(0, 8)}

                  </p>

                  {note ?

                    <p className="mt-1 text-xs text-dc-muted whitespace-pre-wrap">{note}</p>

                  : null}

                  <p className="mt-1 text-[11px] text-dc-muted">{new Date(ev.createdAt).toLocaleString()}</p>

                </li>

              )

            })}

          </ul>

        )}

      </section>

    </div>

  )

}


