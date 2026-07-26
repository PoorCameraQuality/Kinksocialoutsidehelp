import { useCallback, useEffect, useState } from 'react'
import EckePublishPanel from '@/components/ecke/EckePublishPanel'
import type { EckePreviewData } from '@/components/ecke/EckePublishPreviewDrawer'

type OverviewCard = {
  section: string
  sourceKind?: string
  sourceId?: string
  title: string
  supportState: string
  eligible?: boolean
  reason?: string
  status?: EckePreviewData['status']
  summary?: string
  plannedMessage?: string
  preview?: EckePreviewData
  writeEnabled?: boolean
  publishRestrictedMessage?: string
}

type OverviewResponse = {
  organizationId: string
  organizationSlug: string
  organizationName: string
  bridgeConnected: boolean
  passNotice: string
  cards: OverviewCard[]
  history: Array<{
    targetKind: string
    externalSlug: string
    status: string
    lastPublishedAt: string | null
    lastError: string | null
    lastPreviewAt: string | null
  }>
}

type Props = {
  orgSlug: string
}

const SECTION_ORDER = ['overview', 'events', 'places', 'education', 'vendors', 'history'] as const

const SECTION_HEADINGS: Record<string, string> = {
  overview: 'Overview',
  events: 'Events',
  places: 'Places',
  education: 'Education',
  vendors: 'Vendors',
  history: 'Publish history',
}

function cardWriteKind(
  card: OverviewCard,
): 'education_article' | 'vendor_profile' | 'venue_profile' {
  if (card.sourceKind === 'vendor_profile') return 'vendor_profile'
  if (card.sourceKind === 'venue_profile') return 'venue_profile'
  return 'education_article'
}

function cardWriteEnabled(card: OverviewCard): boolean {
  return card.writeEnabled ?? false
}

export default function OrganizerOrgEckePanel({ orgSlug }: Props) {
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/ecke-publish`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setLoadError(
          r.status === 403 ?
            'Organization moderator access is required to manage ECKE publish for this organization.'
          : 'Could not load ECKE publish overview.',
        )
        setData(null)
        return
      }
      setData((await r.json()) as OverviewResponse)
    } catch {
      setLoadError('Network error loading ECKE publish overview.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [orgSlug])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const loadPreview = useCallback(
    async (sourceKind: string, sourceId: string): Promise<EckePreviewData | null> => {
      const params = new URLSearchParams({ sourceKind, sourceId })
      const r = await fetch(
        `/api/v1/organizations/${encodeURIComponent(orgSlug)}/ecke-publish/preview?${params.toString()}`,
        { credentials: 'include' },
      )
      if (!r.ok) return null
      return (await r.json()) as EckePreviewData
    },
    [orgSlug],
  )

  const runWriteAction = useCallback(
    async (action: 'publish' | 'sync' | 'unpublish', sourceKind: string, sourceId: string): Promise<boolean> => {
      const r = await fetch(
        `/api/v1/organizations/${encodeURIComponent(orgSlug)}/ecke-publish/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceKind, sourceId }),
        },
      )
      return r.ok
    },
    [orgSlug],
  )

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" aria-label="Loading ECKE publish" />
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-6 text-center">
        <p className="text-dc-text-muted">{loadError}</p>
      </div>
    )
  }

  if (!data) return null

  const cardsBySection = new Map<string, OverviewCard[]>()
  for (const card of data.cards) {
    const list = cardsBySection.get(card.section) ?? []
    list.push(card)
    cardsBySection.set(card.section, list)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-dc-accent">East Coast Kink Events</p>
        <h2 className="text-2xl font-semibold text-dc-text">Publish to East Coast Kink Events</h2>
        <p className="max-w-2xl text-sm text-dc-text-muted">
          Publish public outcomes from this organization to ECKE — Events, Places, Vendors, and Education.
          Organization profile pages are not published to ECKE.{' '}
          <span className="text-amber-200/90">{data.passNotice}</span>
        </p>
        <p className="text-xs text-dc-text-muted">
          Bridge: {data.bridgeConnected ? 'configured on this server' : 'not configured on this server'}
        </p>
      </header>

      {SECTION_ORDER.map((section) => {
        if (section === 'history') {
          return (
            <section key={section} className="space-y-3">
              <h3 className="text-lg font-semibold text-dc-text">{SECTION_HEADINGS[section]}</h3>
              {data.history.length === 0 ?
                <p className="text-sm text-dc-text-muted">No ECKE publish history recorded for this organization yet.</p>
              : (
                <ul className="divide-y divide-dc-border rounded-xl border border-dc-border">
                  {data.history.map((row) => (
                    <li key={`${row.targetKind}-${row.externalSlug}`} className="flex flex-wrap gap-3 px-4 py-3 text-sm">
                      <span className="font-medium text-dc-text">{row.targetKind}</span>
                      <span className="text-dc-text-muted">{row.externalSlug}</span>
                      <span className="text-dc-text-muted">{row.status}</span>
                      {row.lastPublishedAt ?
                        <span className="text-dc-text-muted">Published {row.lastPublishedAt}</span>
                      : null}
                      {row.lastError ?
                        <span className="text-red-300">{row.lastError}</span>
                      : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        }

        const sectionCards = cardsBySection.get(section)
        if (!sectionCards?.length) return null

        return (
          <section key={section} className="space-y-3">
            {section !== 'overview' ?
              <h3 className="text-lg font-semibold text-dc-text">{SECTION_HEADINGS[section]}</h3>
            : null}
            <div className="space-y-4">
              {sectionCards.map((card) => {
                const writeEnabled = cardWriteEnabled(card)
                const canWrite = writeEnabled && Boolean(card.sourceKind && card.sourceId)
                return (
                  <EckePublishPanel
                    key={`${card.section}-${card.sourceId ?? card.title}`}
                    title={card.title}
                    sourceKind={card.sourceKind}
                    sourceId={card.sourceId}
                    supportState={card.supportState}
                    eligible={card.eligible}
                    reason={card.reason}
                    status={card.status ?? card.preview?.status}
                    summary={card.summary}
                    plannedMessage={card.plannedMessage}
                    publishRestrictedMessage={card.publishRestrictedMessage}
                    preview={card.preview}
                    staleNotice={card.preview?.staleNotice}
                    eckePublicUrl={card.preview?.eckePublicUrl}
                    eckePublicUrlKnown={card.preview?.eckePublicUrlKnown}
                    writeEnabled={writeEnabled}
                    writeKind={cardWriteKind(card)}
                    onLoadPreview={card.sourceKind && card.sourceId ? loadPreview : undefined}
                    onPublish={canWrite ? (sk, sid) => runWriteAction('publish', sk, sid) : undefined}
                    onSync={canWrite ? (sk, sid) => runWriteAction('sync', sk, sid) : undefined}
                    onUnpublish={canWrite ? (sk, sid) => runWriteAction('unpublish', sk, sid) : undefined}
                    onActionComplete={() => void loadOverview()}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
