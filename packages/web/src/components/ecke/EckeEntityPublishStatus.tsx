import { useCallback, useEffect, useState } from 'react'
import { parseEckeControlPlaneSummary } from '@/lib/ecke-control-plane-summary'

export type EckePublishStatus = 'never' | 'draft' | 'published' | 'error' | 'stale'

export type EckeEntityTarget = {
  status: EckePublishStatus
  externalSlug: string
  lastPublishedAt: string | null
  lastError: string | null
}

type Props = {
  entityLabel: string
  loadUrl: string
  queueUrl?: string
  syncUrl?: string
  /** Read-only summary from `/api/v1/.../ecke-publish` control-plane overview. */
  controlPlane?: boolean
  enabled?: boolean
}

const STATUS_LABELS: Record<EckePublishStatus, string> = {
  never: 'Not published yet',
  draft: 'Queued / preview',
  published: 'Published',
  error: 'Last publish failed',
  stale: 'Changes since last publish',
}

function statusTone(status: EckePublishStatus): string {
  switch (status) {
    case 'published':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-950/30'
    case 'stale':
      return 'text-amber-200 border-amber-500/30 bg-amber-950/30'
    case 'error':
      return 'text-red-300 border-red-500/30 bg-red-950/30'
    default:
      return 'text-slate-300 border-dc-border bg-dc-elevated-muted'
  }
}

export default function EckeEntityPublishStatus({
  entityLabel,
  loadUrl,
  queueUrl,
  syncUrl,
  controlPlane = false,
  enabled = true,
}: Props) {
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [target, setTarget] = useState<EckeEntityTarget | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null)

  const loadStatus = useCallback(async () => {
    if (!enabled) return
    setLoadError(null)
    try {
      const r = await fetch(loadUrl, { credentials: 'include' })
      if (!r.ok) {
        setLoadError(r.status === 404 ? 'Publish status unavailable.' : 'Could not load ECKE publish status.')
        setTarget(null)
        return
      }
      const j = (await r.json()) as {
        bridgeConnected?: boolean
        targets?: EckeEntityTarget[] | null
        target?: EckeEntityTarget | null
        history?: unknown[]
        cards?: unknown[]
      }
      setBridgeConnected(Boolean(j.bridgeConnected))
      if (controlPlane) {
        const summary = parseEckeControlPlaneSummary(j)
        setTarget({
          status: summary.aggregateStatus ?? 'never',
          externalSlug: summary.externalSlug ?? '',
          lastPublishedAt: summary.lastPublishedAt,
          lastError: summary.lastError,
        })
      } else {
        const firstTarget = j.targets?.[0] ?? j.target ?? null
        if (firstTarget) {
          setTarget({
            status: firstTarget.status ?? 'never',
            externalSlug: firstTarget.externalSlug ?? '',
            lastPublishedAt: firstTarget.lastPublishedAt ?? null,
            lastError: firstTarget.lastError ?? null,
          })
        } else {
          setTarget({
            status: 'never',
            externalSlug: '',
            lastPublishedAt: null,
            lastError: null,
          })
        }
      }
    } catch {
      setLoadError('Network error loading publish status.')
      setTarget(null)
    } finally {
      setLoadAttempted(true)
    }
  }, [enabled, loadUrl, controlPlane])

  useEffect(() => {
    if (enabled) void loadStatus()
  }, [enabled, loadStatus])

  useEffect(() => {
    if (!message || messageKind !== 'success') return
    const timer = window.setTimeout(() => {
      setMessage(null)
      setMessageKind(null)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [message, messageKind])

  const isPreviewAction = Boolean(queueUrl?.endsWith('/preview'))

  async function runQueue() {
    if (!queueUrl) return
    setBusy(true)
    setMessage(null)
    setMessageKind(null)
    try {
      const r = await fetch(queueUrl, { method: 'POST', credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMessage(j.error ?? (isPreviewAction ? 'Could not build preview.' : 'Could not queue publish.'))
        setMessageKind('error')
        return
      }
      setMessage(
        isPreviewAction ?
          'Preview saved. Outbound public listing runs when the publish bridge is connected.'
        : 'Publish queued. Status updates when the worker finishes.',
      )
      setMessageKind('success')
      await loadStatus()
    } catch {
      setMessage(isPreviewAction ? 'Network error building preview.' : 'Network error queuing publish.')
      setMessageKind('error')
    } finally {
      setBusy(false)
    }
  }

  async function runSync() {
    if (!syncUrl) return
    setBusy(true)
    setMessage(null)
    setMessageKind(null)
    try {
      const r = await fetch(syncUrl, { method: 'POST', credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMessage(j.error ?? 'Sync failed.')
        setMessageKind('error')
        return
      }
      setMessage('Synced to East Coast Kink Events.')
      setMessageKind('success')
      await loadStatus()
    } catch {
      setMessage('Network error during sync.')
      setMessageKind('error')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) return null

  const status = target?.status ?? 'never'

  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-950/15 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-300/90">Public directory listing</p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${statusTone(status)}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      <p className="text-[11px] text-dc-muted">
        {entityLabel} on eastcoastkinkevents.com when the publish bridge is connected.
      </p>

      {loadError ?
        <p className="text-xs text-red-200" role="alert">
          {loadError}{' '}
          <button type="button" className="underline" onClick={() => void loadStatus()}>
            Retry
          </button>
        </p>
      : null}

      {loadAttempted && !loadError && target ?
        <div className="text-xs text-dc-muted space-y-1">
          {target.externalSlug ?
            <p>
              Slug: <code className="font-mono text-dc-text-muted">{target.externalSlug}</code>
            </p>
          : null}
          {target.lastPublishedAt ?
            <p>Last published: {new Date(target.lastPublishedAt).toLocaleString()}</p>
          : null}
          {target.lastError ? <p className="text-red-200">{target.lastError}</p> : null}
        </div>
      : !loadAttempted ?
        <div className="h-8 animate-pulse rounded-lg bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {!bridgeConnected ?
        <p className="text-[11px] text-amber-200/80 rounded-lg border border-amber-500/20 bg-amber-950/30 px-3 py-2">
          {isPreviewAction ?
            'East Coast Kink Events outbound sync is preview-only until the publish bridge is enabled. You can still build a preview now.'
          : 'Publish bridge is not connected on this server. Queue publish is disabled until the bridge is configured.'}
        </p>
      : null}

      {!controlPlane ?
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !!loadError || !queueUrl || (!isPreviewAction && !bridgeConnected)}
            onClick={() => void runQueue()}
            className="rounded-lg border border-teal-500/40 bg-teal-900/40 px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-teal-800/50 disabled:opacity-50"
          >
            {busy ? 'Working…' : isPreviewAction ? 'Build preview' : 'Queue publish'}
          </button>
          {syncUrl ?
            <button
              type="button"
              disabled={busy || !!loadError || !bridgeConnected}
              onClick={() => void runSync()}
              className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Publish to ECKE'}
            </button>
          : null}
        </div>
      : (
        <p className="text-[11px] text-dc-muted">
          Open the ECKE tab for per-entity preview and publish controls.
        </p>
      )}

      {message ?
        <p
          className={`text-xs ${messageKind === 'error' ? 'text-red-200' : 'text-emerald-200'}`}
          role={messageKind === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      : null}
    </div>
  )
}
