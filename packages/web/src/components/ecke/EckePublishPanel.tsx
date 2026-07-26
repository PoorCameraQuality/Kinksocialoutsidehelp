/**
 * Shared ECKE publish card UI (group/org/convention dashboards).
 *
 * Capabilities come from the server preview (`actions`) or callback presence:
 * `canPreview` / `canWrite` gate buttons; `writeEnabled` is the parent’s
 * surface-level write flag. UI flow: idle → preview drawer → optional
 * publish/unpublish confirm → `actionBusy` → success/error message.
 * Full `capabilities` object refactor deferred (audit W6).
 */
import { useState } from 'react'
import EckePublishPreviewDrawer, { type EckePreviewData } from '@/components/ecke/EckePublishPreviewDrawer'
import EckePublishStatusBadge from '@/components/ecke/EckePublishStatusBadge'
import EckePublishOmittedFieldsList from '@/components/ecke/EckePublishOmittedFieldsList'
import { publishWarningFor, unpublishWarningFor } from '@/components/ecke/ecke-publish-copy'

/** Per-action allow flags from preview (true = allowed). */
export type EckePublishPanelActions = {
  preview: boolean
  publish: boolean
  sync: boolean
  unpublish: boolean
}

type Props = {
  title: string
  sourceKind?: string
  sourceId?: string
  supportState: string
  eligible?: boolean
  reason?: string
  status?: EckePreviewData['status']
  summary?: string
  plannedMessage?: string
  publishRestrictedMessage?: string
  preview?: EckePreviewData
  staleNotice?: string | null
  eckePublicUrl?: string | null
  eckePublicUrlKnown?: boolean
  writeEnabled?: boolean
  writeKind?: 'group_listing' | 'event_listing' | 'education_article' | 'vendor_profile' | 'organization_listing' | 'dungeon_profile' | 'convention_listing' | 'convention_event_anchor' | 'dancecard_event' | 'presenter_profile' | 'venue_profile'
  onLoadPreview?: (sourceKind: string, sourceId: string) => Promise<EckePreviewData | null>
  onPublish?: (sourceKind: string, sourceId: string) => Promise<boolean>
  onSync?: (sourceKind: string, sourceId: string) => Promise<boolean>
  onUnpublish?: (sourceKind: string, sourceId: string) => Promise<boolean>
  onActionComplete?: () => void
}

function supportLabel(state: string): string {
  switch (state) {
    case 'active_existing':
      return 'Publish available'
    case 'preview_only':
      return 'Preview available'
    case 'planned':
      return 'Planned'
    case 'unsupported':
      return 'Unsupported'
    case 'info':
      return 'Overview'
    default:
      return state
  }
}

export default function EckePublishPanel({
  title,
  sourceKind,
  sourceId,
  supportState,
  eligible,
  reason,
  status = 'never',
  summary,
  plannedMessage,
  publishRestrictedMessage,
  preview: initialPreview,
  staleNotice,
  eckePublicUrl,
  eckePublicUrlKnown,
  writeEnabled = false,
  writeKind = 'group_listing',
  onLoadPreview,
  onPublish,
  onSync,
  onUnpublish,
  onActionComplete,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [preview, setPreview] = useState<EckePreviewData | null>(initialPreview ?? null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState<'publish' | 'sync' | 'unpublish' | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionMessageKind, setActionMessageKind] = useState<'success' | 'error' | null>(null)
  const [confirmAction, setConfirmAction] = useState<'publish' | 'unpublish' | null>(null)

  const activePreview = preview ?? initialPreview ?? null
  const actions: EckePublishPanelActions = activePreview?.actions ?? {
    preview: Boolean(onLoadPreview),
    publish: false,
    sync: false,
    unpublish: false,
  }

  const canPreview = Boolean(sourceKind && sourceId && onLoadPreview && actions.preview)
  const canWrite = writeEnabled && Boolean(sourceKind && sourceId)

  async function openPreview() {
    if (!sourceKind || !sourceId || !onLoadPreview) return
    setPreviewBusy(true)
    setPreviewError(null)
    try {
      const data = await onLoadPreview(sourceKind, sourceId)
      if (!data) {
        setPreviewError('Could not load preview.')
        return
      }
      setPreview(data)
      setDrawerOpen(true)
    } catch {
      setPreviewError('Network error loading preview.')
    } finally {
      setPreviewBusy(false)
    }
  }

  async function runAction(kind: 'publish' | 'sync' | 'unpublish') {
    if (!sourceKind || !sourceId) return
    const runner = kind === 'publish' ? onPublish : kind === 'sync' ? onSync : onUnpublish
    if (!runner) return
    setActionBusy(kind)
    setActionMessage(null)
    setActionMessageKind(null)
    setConfirmAction(null)
    try {
      const ok = await runner(sourceKind, sourceId)
      if (!ok) {
        setActionMessage(
          kind === 'publish' ? 'Publish failed. Check bridge configuration and try again.'
          : kind === 'sync' ? 'Sync failed. Check bridge configuration and try again.'
          : 'Unpublish failed.',
        )
        setActionMessageKind('error')
        return
      }
      setActionMessage(
        kind === 'publish' ? 'Published to East Coast Kink Events.'
        : kind === 'sync' ? 'ECKE listing synced.'
        : 'Unpublished from East Coast Kink Events.',
      )
      setActionMessageKind('success')
      onActionComplete?.()
    } catch {
      setActionMessage('Network error during ECKE action.')
      setActionMessageKind('error')
    } finally {
      setActionBusy(null)
    }
  }

  const displayEckeUrl = activePreview?.eckePublicUrl ?? eckePublicUrl
  const urlKnown = activePreview?.eckePublicUrlKnown ?? eckePublicUrlKnown

  return (
    <>
      <article className="rounded-xl border border-dc-border-strong/80 bg-[var(--organizer-panel-bg)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-dc-text">{title}</h3>
            <p className="mt-0.5 text-xs text-dc-text-muted">{supportLabel(supportState)}</p>
          </div>
          {status && supportState !== 'planned' && supportState !== 'info' ?
            <EckePublishStatusBadge status={status} />
          : null}
        </div>

        {summary ?
          <p className="mt-3 text-sm text-dc-text-muted">{summary}</p>
        : null}
        {plannedMessage ?
          <p className="mt-3 text-sm text-dc-text-muted">{plannedMessage}</p>
        : null}
        {publishRestrictedMessage && !writeEnabled ?
          <p className="mt-3 rounded-lg border border-dc-border bg-dc-elevated-muted/60 px-3 py-2 text-sm text-dc-text-muted">
            {publishRestrictedMessage}
          </p>
        : null}
        {(staleNotice ?? activePreview?.staleNotice) ?
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            {staleNotice ?? activePreview?.staleNotice}
          </p>
        : null}

        {!eligible && reason && supportState !== 'planned' && supportState !== 'info' ?
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            {reason}
          </p>
        : null}

        {supportState !== 'planned' && supportState !== 'info' ?
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Eligibility</dt>
              <dd className={eligible ? 'text-emerald-300' : 'text-amber-200'}>
                {eligible ? 'Eligible' : reason ?? 'Not eligible'}
              </dd>
            </div>
            {activePreview ?
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Current transport</dt>
                <dd className="text-dc-text">{activePreview.currentTransport ?? '—'}</dd>
              </div>
            : null}
            {displayEckeUrl ?
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">ECKE public URL</dt>
                <dd className="break-all text-dc-text">
                  <a href={displayEckeUrl} className="text-dc-accent hover:underline" target="_blank" rel="noreferrer">
                    {displayEckeUrl}
                  </a>
                  {!urlKnown ?
                    <span className="mt-1 block text-xs text-amber-200/90">
                      URL is estimated — listing webhook did not return a confirmed public URL.
                    </span>
                  : null}
                </dd>
              </div>
            : null}
            {activePreview?.locationVisibility && writeKind === 'event_listing' ?
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Location visibility</dt>
                <dd className="text-dc-text">{activePreview.locationVisibility}</dd>
              </div>
            : null}
            {activePreview?.lastPublishedAt ?
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Last published</dt>
                <dd className="text-dc-text">{activePreview.lastPublishedAt}</dd>
              </div>
            : null}
            {activePreview?.lastError ?
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Last error</dt>
                <dd className="text-red-300">{activePreview.lastError}</dd>
              </div>
            : null}
          </dl>
        : null}

        {activePreview?.wouldNotPublish?.length ?
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">Would not publish</p>
            <EckePublishOmittedFieldsList fields={activePreview.wouldNotPublish.slice(0, 4)} className="mt-1" />
          </div>
        : null}

        {confirmAction ?
          <div className="mt-4 rounded-lg border border-dc-border bg-dc-elevated-muted/60 p-3 text-sm text-dc-text-muted">
            {confirmAction === 'publish' ?
              publishWarningFor(writeKind)
            : unpublishWarningFor(writeKind)}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(actionBusy)}
                onClick={() => void runAction(confirmAction)}
                className="min-h-9 rounded-lg border border-dc-accent/40 bg-dc-accent/10 px-3 text-sm font-medium text-dc-accent"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={Boolean(actionBusy)}
                onClick={() => setConfirmAction(null)}
                className="min-h-9 rounded-lg border border-dc-border px-3 text-sm text-dc-text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-dc-border pt-4">
          <button
            type="button"
            disabled={!canPreview || previewBusy}
            onClick={() => void openPreview()}
            className="min-h-9 rounded-lg border border-dc-accent/40 bg-dc-accent/10 px-3 text-sm font-medium text-dc-accent hover:bg-dc-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewBusy ? 'Loading preview…' : 'Preview public listing'}
          </button>
          <button
            type="button"
            disabled={!canWrite || !actions.publish || Boolean(actionBusy) || !eligible}
            onClick={() => setConfirmAction('publish')}
            className="min-h-9 rounded-lg border border-dc-border px-3 text-sm text-dc-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionBusy === 'publish' ? 'Publishing…' : 'Publish to ECKE'}
          </button>
          <button
            type="button"
            disabled={!canWrite || !actions.sync || Boolean(actionBusy) || !eligible}
            onClick={() => void runAction('sync')}
            className="min-h-9 rounded-lg border border-dc-border px-3 text-sm text-dc-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionBusy === 'sync' ? 'Syncing…' : 'Sync ECKE listing'}
          </button>
          <button
            type="button"
            disabled={!canWrite || !actions.unpublish || Boolean(actionBusy)}
            onClick={() => setConfirmAction('unpublish')}
            className="min-h-9 rounded-lg border border-dc-border px-3 text-sm text-dc-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionBusy === 'unpublish' ? 'Unpublishing…' : 'Unpublish from ECKE'}
          </button>
        </div>
        {previewError ?
          <p className="mt-2 text-sm text-red-300">{previewError}</p>
        : null}
        {actionMessage ?
          <p className={`mt-2 text-sm ${actionMessageKind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
            {actionMessage}
          </p>
        : null}
      </article>

      <EckePublishPreviewDrawer
        open={drawerOpen}
        title={title}
        preview={activePreview}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
