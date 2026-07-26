import { useCallback, useEffect, useState } from 'react'

export type ModerationTsDashboard = {
  byQueue: Record<string, number>
  bySeverity: Record<string, number>
  openCases: number
  openQueueItems: number
  nciiUrgentCount?: number
  minorSafetyRestrictedCount?: number
  canViewRestrictedQueue?: boolean
  recentCases?: ModerationTsCaseRow[]
}

export type ModerationTsQueueItem = {
  id: string
  caseId: string
  queue: string
  severity: string
  status: string
  assignedToUserId: string | null
  assignedToUsername?: string | null
  policyReason?: string
  targetContentType?: string
  targetContentId?: string
  createdAt: string
}

export type ModerationTsCaseRow = {
  id: string
  targetContentType: string
  targetContentId: string
  targetUserId: string | null
  policyReason: string
  severity: string
  queue: string
  status: string
  assignedToUserId: string | null
  assignedToUsername?: string | null
  reportCount?: number
  createdAt: string
  updatedAt: string
}

export type ModerationTsCaseReport = {
  id: string
  reporterId: string
  reporterUsername?: string
  policyReason: string
  body: string | null
  createdAt: string
}

export type ModerationTsContentSnapshot = {
  id: string
  targetContentType: string
  targetContentId: string
  snapshot: Record<string, unknown>
  createdAt: string
}

export type ModerationTsCaseEvent = {
  id: string
  eventType: string
  actorUserId: string
  actorUsername?: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

export type ModerationTsMediaModeration = {
  mediaAssetId: string
  malwareBlocked: boolean
  canViewBytes: boolean
  uploadStatus: string
}

export type ModerationTsCaseContextLink = {
  label: string
  href: string
}

export type ModerationTsCaseDetail = {
  case: ModerationTsCaseRow
  reports: ModerationTsCaseReport[]
  snapshots: ModerationTsContentSnapshot[]
  events: ModerationTsCaseEvent[]
  mediaModeration: ModerationTsMediaModeration | null
  contextLinks?: ModerationTsCaseContextLink[]
}

export type ModerationTsCaseAction =
  | 'mark_no_violation'
  | 'close_duplicate'
  | 'escalate'
  | 'hide_content'
  | 'delete_content'
  | 'suspend_subject'
  | 'keep_quarantined'
  | 'remove_media'
  | 'restore_media'

export type ModerationTsCaseActionOptions = {
  hardDelete?: boolean
  suspendPermanent?: boolean
}

export function viewMediaContentUrl(caseId: string): string {
  return `/api/v1/moderation/cases/${encodeURIComponent(caseId)}/media-content`
}

type FetchState = 'idle' | 'loading' | 'ready' | 'error'

async function parseError(r: Response, fallback: string): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  return j.error ?? `${fallback} (HTTP ${r.status})`
}

export type MediaAssetSnapshotMetadata = {
  mimeType: string
  sizeBytes: number
  originalFilename: string | null
  uploadStatus: string
  contentRating: string | null
  visibility: string | null
  depictedPeople: string | null
  scanStatus: string
  storageState?: string
  sha256Hash?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  publishLane?: string | null
  hasPublicUrl?: boolean
  sourceSurface: string
  ownerType: string
  ownerId: string
  reportable: boolean
  isBlurredByDefault: boolean
  attestedAt: string | null
  attestationVersion: number | null
  attestation: Record<string, boolean>
  linkedProfilePhotoId: string | null
  uploaderUsername: string | null
  scannerSummary?: {
    finalScanStatus: string
    quarantineReason: string | null
    scanners: Array<{
      name: string
      status: string
      summary: string
      labels: string[]
      simulated: boolean
    }>
  } | null
  /**
   * Pipeline decision context written by the API inside `mediaMetadata`
   * after attestation finalize (PR 3 M4).
   */
  pipeline?: {
    scannerSummary?: { quarantineReason?: string | null }
    storageState?: string
    moderationDecision?: { reasonCode?: string; reasonSummary?: string }
  }
  moderationDecision?: { reasonCode?: string; reasonSummary?: string }
}

export function isMediaAssetSnapshot(snapshot: Record<string, unknown>): boolean {
  return snapshot.targetType === 'media_asset' && typeof snapshot.mediaMetadata === 'object' && snapshot.mediaMetadata !== null
}

export function mediaMetadataFromSnapshot(
  snapshot: Record<string, unknown>
): MediaAssetSnapshotMetadata | null {
  if (!isMediaAssetSnapshot(snapshot)) return null
  return snapshot.mediaMetadata as MediaAssetSnapshotMetadata
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMediaMetadataLines(meta: MediaAssetSnapshotMetadata, assetId?: string): string[] {
  const lines = [
    ...(assetId ? [`Media asset ID: ${assetId}`] : []),
    `MIME: ${meta.mimeType}`,
    `Size: ${formatBytes(meta.sizeBytes)}`,
    `Upload status: ${meta.uploadStatus.replace(/_/g, ' ')}`,
    `Storage state: ${(meta.storageState ?? 'unknown').replace(/_/g, ' ')}`,
    `Scan status: ${meta.scanStatus.replace(/_/g, ' ')}`,
    `Source: ${meta.sourceSurface.replace(/_/g, ' ')}`,
    `Owner: ${meta.ownerType} · ${meta.ownerId}`,
  ]
  if (meta.originalFilename) lines.push(`Filename: ${meta.originalFilename}`)
  if (meta.contentRating) lines.push(`Content rating: ${meta.contentRating.replace(/_/g, ' ')}`)
  if (meta.visibility) lines.push(`Visibility: ${meta.visibility.replace(/_/g, ' ')}`)
  if (meta.depictedPeople) lines.push(`Depicted: ${meta.depictedPeople.replace(/_/g, ' ')}`)
  if (meta.publishLane) lines.push(`Publish lane: ${meta.publishLane}`)
  if (meta.imageWidth != null && meta.imageHeight != null) {
    lines.push(`Dimensions: ${meta.imageWidth}×${meta.imageHeight}`)
  }
  if (meta.sha256Hash) lines.push(`SHA-256: ${meta.sha256Hash}`)
  if (meta.hasPublicUrl != null) {
    lines.push(`Public URL issued: ${meta.hasPublicUrl ? 'yes' : 'no'}`)
  }
  if (meta.uploaderUsername) lines.push(`Uploader: @${meta.uploaderUsername}`)
  if (meta.linkedProfilePhotoId) lines.push(`Linked profile photo: ${meta.linkedProfilePhotoId}`)
  if (meta.attestedAt) lines.push(`Attested: ${new Date(meta.attestedAt).toLocaleString()}`)
  const flags = Object.entries(meta.attestation ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()))
  if (flags.length > 0) lines.push(`Attestation: ${flags.join(', ')}`)
  if (meta.scannerSummary?.scanners?.length) {
    lines.push('--- Scanner summary ---')
    for (const s of meta.scannerSummary.scanners) {
      lines.push(`${s.name}: ${s.status} · ${s.summary}`)
      if (s.labels.length) lines.push(`  labels: ${s.labels.join(', ')}`)
    }
    if (meta.scannerSummary.quarantineReason) {
      lines.push(`Scanner hold reason: ${meta.scannerSummary.quarantineReason}`)
    }
  }
  const pipeline = meta.pipeline
  const moderationDecision = pipeline?.moderationDecision ?? meta.moderationDecision
  if (moderationDecision?.reasonSummary) {
    lines.push(`Decision (${moderationDecision.reasonCode ?? 'unknown'}): ${moderationDecision.reasonSummary}`)
  } else if (pipeline?.scannerSummary?.quarantineReason) {
    lines.push(`Scanner hold reason: ${pipeline.scannerSummary.quarantineReason}`)
  }
  if (pipeline?.storageState === 'VALIDATED_PRIVATE') {
    lines.push(
      'Alpha note: VALIDATED_PRIVATE + quarantine/ S3 prefix is intentional auth-proxy serving, not a mod block.',
    )
  }
  return lines
}

export function snapshotDisplayText(snapshot: Record<string, unknown>): string {
  const mediaMeta = mediaMetadataFromSnapshot(snapshot)
  if (mediaMeta) {
    const header = typeof snapshot.label === 'string' ? snapshot.label : 'Media asset'
    const assetId = typeof snapshot.targetId === 'string' ? snapshot.targetId : undefined
    return [header, ...formatMediaMetadataLines(mediaMeta, assetId)].join('\n')
  }
  if (typeof snapshot.excerpt === 'string' && snapshot.excerpt.trim()) return snapshot.excerpt
  if (typeof snapshot.body === 'string' && snapshot.body.trim()) return snapshot.body
  if (typeof snapshot.text === 'string' && snapshot.text.trim()) return snapshot.text
  if (typeof snapshot.label === 'string' && snapshot.label.trim()) return snapshot.label
  return JSON.stringify(snapshot, null, 2)
}

export function useApiModerationTsDashboard(enabled: boolean, refreshKey = 0) {
  const [status, setStatus] = useState<FetchState>('idle')
  const [data, setData] = useState<ModerationTsDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch('/api/v1/moderation/dashboard', { credentials: 'include' })
      if (r.status === 403) {
        setStatus('error')
        setError('Forbidden. Not a platform moderator.')
        setData(null)
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(await parseError(r, 'Could not load dashboard'))
        setData(null)
        return
      }
      setData((await r.json()) as ModerationTsDashboard)
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading moderation dashboard.')
      setData(null)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { status, data, error, reload }
}

type QueueFilters = { queue?: string; status?: string }

export function useApiModerationTsQueues(
  enabled: boolean,
  filters: QueueFilters,
  refreshKey = 0
) {
  const [status, setStatus] = useState<FetchState>('idle')
  const [items, setItems] = useState<ModerationTsQueueItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.queue) params.set('queue', filters.queue)
      if (filters.status) params.set('status', filters.status)
      const qs = params.toString()
      const r = await fetch(`/api/v1/moderation/queues${qs ? `?${qs}` : ''}`, { credentials: 'include' })
      if (r.status === 403) {
        setStatus('error')
        setError('Forbidden. Not a platform moderator.')
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(await parseError(r, 'Could not load queues'))
        setItems([])
        return
      }
      const body = (await r.json()) as { items?: ModerationTsQueueItem[] }
      setItems(body.items ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading moderation queues.')
      setItems([])
    }
  }, [enabled, filters.queue, filters.status])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { status, items, error, reload }
}

type CaseFilters = { status?: string; queue?: string; severity?: string }

export function useApiModerationTsCases(
  enabled: boolean,
  filters: CaseFilters,
  refreshKey = 0
) {
  const [status, setStatus] = useState<FetchState>('idle')
  const [items, setItems] = useState<ModerationTsCaseRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.queue) params.set('queue', filters.queue)
      if (filters.severity) params.set('severity', filters.severity)
      const qs = params.toString()
      const r = await fetch(`/api/v1/moderation/cases${qs ? `?${qs}` : ''}`, { credentials: 'include' })
      if (r.status === 403) {
        setStatus('error')
        setError('Forbidden. Not a platform moderator.')
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(await parseError(r, 'Could not load cases'))
        setItems([])
        return
      }
      const body = (await r.json()) as { items?: ModerationTsCaseRow[] }
      setItems(body.items ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading moderation cases.')
      setItems([])
    }
  }, [enabled, filters.status, filters.queue, filters.severity])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { status, items, error, reload }
}

export function useApiModerationTsCaseDetail(enabled: boolean, caseId: string | undefined) {
  const [status, setStatus] = useState<FetchState>('idle')
  const [detail, setDetail] = useState<ModerationTsCaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !caseId) {
      setDetail(null)
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/moderation/cases/${encodeURIComponent(caseId)}`, { credentials: 'include' })
      if (r.status === 403) {
        setStatus('error')
        setError('Forbidden. Not a platform moderator.')
        setDetail(null)
        return
      }
      if (r.status === 404) {
        setStatus('error')
        setError('Case not found.')
        setDetail(null)
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(await parseError(r, 'Could not load case'))
        setDetail(null)
        return
      }
      setDetail((await r.json()) as ModerationTsCaseDetail)
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading case detail.')
      setDetail(null)
    }
  }, [enabled, caseId])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchCase = useCallback(
    async (body: { status?: string; assignedToUserId?: string | null }) => {
      if (!caseId) throw new Error('Missing case id')
      const r = await fetch(`/api/v1/moderation/cases/${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Case update failed'))
      await reload()
    },
    [caseId, reload]
  )

  const addNote = useCallback(
    async (note: string) => {
      if (!caseId) throw new Error('Missing case id')
      const r = await fetch(`/api/v1/moderation/cases/${encodeURIComponent(caseId)}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: note }),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Could not save note'))
      await reload()
    },
    [caseId, reload]
  )

  const revealSnapshot = useCallback(async () => {
    const revealUrl = caseId
      ? `/api/v1/moderation/cases/${encodeURIComponent(caseId)}/reveal`
      : null
    if (!revealUrl) return
    const r = await fetch(revealUrl, { method: 'POST', credentials: 'include' })
    if (r.status === 404) return
    if (!r.ok) throw new Error(await parseError(r, 'Reveal failed'))
    await reload()
  }, [caseId, reload])

  const postAction = useCallback(
    async (action: ModerationTsCaseAction, note?: string, opts?: ModerationTsCaseActionOptions) => {
      if (!caseId) throw new Error('Missing case id')
      const r = await fetch(`/api/v1/moderation/cases/${encodeURIComponent(caseId)}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note, ...opts }),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Action failed'))
      await reload()
    },
    [caseId, reload]
  )

  return { status, detail, error, reload, patchCase, addNote, revealSnapshot, postAction }
}
