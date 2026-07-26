import EckePublishPanel from '@/components/ecke/EckePublishPanel'
import {
  useApiGroupEckePublish,
  type GroupEckeOverviewCard,
} from '@/hooks/useApiGroupEckePublish'

type Props = {
  groupId: string
}

const SECTION_ORDER = [
  'overview',
  'group_listing',
  'events',
  'education',
  'venues',
  'vendors',
  'dancecard',
  'history',
] as const

const SECTION_HEADINGS: Record<string, string> = {
  overview: 'Overview',
  group_listing: 'Group listing',
  events: 'Events',
  education: 'Education',
  venues: 'Places',
  vendors: 'Vendors / Sponsors',
  dancecard: 'Dancecard',
  history: 'Publish history',
}

function cardWriteKind(card: GroupEckeOverviewCard): 'group_listing' | 'event_listing' | 'education_article' {
  if (card.sourceKind === 'education_article') return 'education_article'
  if (card.section === 'events') return 'event_listing'
  return 'group_listing'
}

function cardWriteEnabled(card: GroupEckeOverviewCard): boolean {
  if (card.writeEnabled !== undefined) return card.writeEnabled
  return card.section === 'group_listing' || card.section === 'events'
}

export default function OrganizerGroupEckePanel({ groupId }: Props) {
  const { data, loading, loadError, reloadOverview, loadPreview, runWriteAction } =
    useApiGroupEckePublish(groupId)

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

  const cardsBySection = new Map<string, GroupEckeOverviewCard[]>()
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
          Preview public group listings, events, and org-linked education for {data.groupName}.{' '}
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
                <p className="text-sm text-dc-text-muted">No publish history recorded for this group yet.</p>
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
                const writeKind = cardWriteKind(card)
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
                  writeKind={writeKind}
                  onLoadPreview={card.sourceKind && card.sourceId ? loadPreview : undefined}
                  onPublish={canWrite ? (sk, sid) => runWriteAction('publish', sk, sid) : undefined}
                  onSync={canWrite ? (sk, sid) => runWriteAction('sync', sk, sid) : undefined}
                  onUnpublish={canWrite ? (sk, sid) => runWriteAction('unpublish', sk, sid) : undefined}
                  onActionComplete={() => void reloadOverview()}
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
