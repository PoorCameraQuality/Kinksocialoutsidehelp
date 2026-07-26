import { useCallback, useEffect, useState } from 'react'

import OrganizerPublishConfirmDialog from '@/components/organizer/ui/OrganizerPublishConfirmDialog'
import { patchConventionOrganizerSettings } from '@/lib/organizer/conventionProgramApi'
import { canEckePublishConvention, canPublishConventionProgram } from '@/lib/organizer/org-tools-utils'

type Props = {
  conventionSlug: string
  conventionTitle: string
  variant?: 'compact' | 'full'
  viewerRole?: string | null
  isFullAdmin?: boolean
  onPublished?: () => void
}

type ConventionOverview = {
  bridgeConnected?: boolean
  conventionId?: string
}

export default function ConventionPublishActions({
  conventionSlug,
  conventionTitle,
  variant = 'full',
  viewerRole = null,
  isFullAdmin = false,
  onPublished,
}: Props) {
  const [busy, setBusy] = useState<'preview' | 'publish' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [includeEcke, setIncludeEcke] = useState(false)
  const [bridgeConnected, setBridgeConnected] = useState<boolean | null>(null)
  const [conventionId, setConventionId] = useState<string | null>(null)

  const canPublishC2k = canPublishConventionProgram(viewerRole)
  const showEckeOption =
    canEckePublishConvention(viewerRole, isFullAdmin) && bridgeConnected !== false

  const eckeOverviewUrl = `/api/v1/conventions/${encodeURIComponent(conventionSlug)}/ecke-publish`
  const eckeWriteBase = eckeOverviewUrl

  useEffect(() => {
    if (!canEckePublishConvention(viewerRole, isFullAdmin)) return
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(eckeOverviewUrl, { credentials: 'include' })
        const j = (await r.json()) as ConventionOverview
        if (!cancelled) {
          setBridgeConnected(Boolean(j.bridgeConnected))
          setConventionId(j.conventionId ?? null)
        }
      } catch {
        if (!cancelled) setBridgeConnected(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eckeOverviewUrl, viewerRole, isFullAdmin])

  const runEckePreview = useCallback(async () => {
    if (!conventionId) throw new Error('Convention ECKE context not loaded')
    const params = new URLSearchParams({
      sourceKind: 'convention_event_anchor',
      sourceId: conventionId,
    })
    const r = await fetch(`${eckeWriteBase}/preview?${params.toString()}`, { credentials: 'include' })
    const j = (await r.json()) as { error?: string }
    if (!r.ok) throw new Error(j.error ?? 'Preview failed')
  }, [conventionId, eckeWriteBase])

  const runEckePublish = useCallback(async () => {
    if (bridgeConnected === false) {
      throw new Error('East Coast Kink Events publish bridge is not connected on this server.')
    }
    if (!conventionId) throw new Error('Convention ECKE context not loaded')
    const r = await fetch(`${eckeWriteBase}/publish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKind: 'convention_event_anchor',
        sourceId: conventionId,
      }),
    })
    const j = (await r.json()) as { error?: string; message?: string }
    if (!r.ok) throw new Error(j.error ?? 'Publish failed')
  }, [bridgeConnected, conventionId, eckeWriteBase])

  const makePublicOnC2k = useCallback(async () => {
    await patchConventionOrganizerSettings(conventionSlug, {
      settings: {
        publicProgramListing: true,
        dancecardPublishStatus: 'published',
      },
    })
  }, [conventionSlug])

  const confirmPublish = async () => {
    if (includeEcke && bridgeConnected === false) {
      setMessageKind('error')
      setMessage('East Coast Kink Events publish bridge is not connected on this server.')
      return
    }
    setBusy('publish')
    setMessage(null)
    setMessageKind(null)
    try {
      if (includeEcke) await runEckePublish()
      await makePublicOnC2k()
      setMessageKind('success')
      setMessage(
        includeEcke ?
          `${conventionTitle} is now public and queued for East Coast Kink Events.`
        : `${conventionTitle} is now public.`,
      )
      setDialogOpen(false)
      onPublished?.()
    } catch (e) {
      setMessageKind('error')
      setMessage(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(null)
    }
  }

  const runPreview = async () => {
    setBusy('preview')
    setMessage(null)
    setMessageKind(null)
    try {
      await runEckePreview()
      setMessageKind('success')
      setMessage(`Preview saved for ${conventionTitle}.`)
    } catch (e) {
      setMessageKind('error')
      setMessage(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(null)
    }
  }

  if (!canPublishC2k) return null

  return (
    <>
      <div className="flex flex-col gap-1 items-end">
        <div className="flex flex-wrap gap-2">
          {variant === 'full' && showEckeOption ?
            <button
              type="button"
              disabled={!!busy || !conventionId}
              onClick={() => void runPreview()}
              className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text disabled:opacity-50"
            >
              {busy === 'preview' ? 'Preview…' : 'Preview'}
            </button>
          : null}
          <button
            type="button"
            data-testid="program-convention-publish-open"
            disabled={!!busy}
            onClick={() => setDialogOpen(true)}
            className="min-h-9 inline-flex items-center rounded-lg bg-dc-accent px-3 text-xs font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
        {bridgeConnected === false && canEckePublishConvention(viewerRole, isFullAdmin) ?
          <p className="text-xs max-w-xs text-right text-amber-200/90">
            Public directory listing unavailable · Kink Social publish only until bridge is connected.
          </p>
        : null}
        {message ?
          <p
            className={`text-xs max-w-xs text-right ${messageKind === 'error' ? 'text-red-300' : 'text-emerald-200/90'}`}
          >
            {message}
          </p>
        : null}
      </div>

      <OrganizerPublishConfirmDialog
        open={dialogOpen}
        title="Publish convention?"
        itemLabel={conventionTitle}
        itemKind="convention"
        includeEcke={includeEcke}
        onIncludeEckeChange={setIncludeEcke}
        showEckeOption={showEckeOption}
        busy={busy === 'publish'}
        onConfirm={() => void confirmPublish()}
        onCancel={() => {
          if (busy !== 'publish') setDialogOpen(false)
        }}
      />
    </>
  )
}
