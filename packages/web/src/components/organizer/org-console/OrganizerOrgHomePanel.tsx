import { Link } from 'react-router-dom'
import { DashboardCard } from '@/components/templates/DashboardTemplate'
import OrganizerChecklist from '@/components/organizer/org-console/OrganizerChecklist'
import OrganizationStatusHero from '@/components/organizer/org-console/OrganizationStatusHero'
import PublicHubPreviewCard from '@/components/organizer/org-console/PublicHubPreviewCard'
import QuickActionsCard, { type QuickAction } from '@/components/organizer/org-console/QuickActionsCard'
import RolePermissionsCard from '@/components/organizer/org-console/RolePermissionsCard'
import UpcomingOrgEventsCard, { type OrgEventRow } from '@/components/organizer/org-console/UpcomingOrgEventsCard'
import EckeEntityPublishStatus from '@/components/ecke/EckeEntityPublishStatus'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import type { OrgChecklistItem } from '@/lib/organizer/build-org-checklist'
import { openCreateFlow } from '@/lib/open-create-flow'

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  chatEnabled: boolean
  subgroupsEnabled?: boolean
  externalEmbedEnabled?: boolean
}

type Props = {
  orgId: string
  slug: string
  displayName: string
  visibility: string
  memberCount: number
  viewerRole: string | null
  featureFlags: OrgFlags
  checklist: OrgChecklistItem[]
  events: OrgEventRow[]
  conventions: { slug: string; title: string }[]
  showSettings: boolean
  quickActions: QuickAction[]
  upcomingEventCount: number
}

export default function OrganizerOrgHomePanel({
  orgId,
  slug,
  displayName,
  visibility,
  memberCount,
  viewerRole,
  featureFlags,
  checklist,
  events,
  conventions,
  showSettings,
  quickActions,
  upcomingEventCount,
}: Props) {
  const orgBase = `/organizer/orgs/${encodeURIComponent(slug)}`
  const publicHubHref = `/orgs/${encodeURIComponent(slug)}`

  const communityFeatures: string[] = []
  if (featureFlags.calendarEnabled) communityFeatures.push('Calendar')
  if (featureFlags.forumsEnabled) communityFeatures.push('Forums')
  if (featureFlags.chatEnabled) communityFeatures.push('Chat')

  const hubFeatures = [
    { id: 'calendar', label: 'Calendar', enabled: featureFlags.calendarEnabled },
    { id: 'forums', label: 'Forums', enabled: featureFlags.forumsEnabled },
    { id: 'chat', label: 'Chat', enabled: featureFlags.chatEnabled },
    { id: 'subgroups', label: 'Subgroups', enabled: !!featureFlags.subgroupsEnabled },
    { id: 'embed', label: 'External embed', enabled: !!featureFlags.externalEmbedEnabled },
  ]

  const onCreateEvent =
    featureFlags.calendarEnabled ? () => openCreateFlow({ type: 'event', prefillOrgId: orgId }) : undefined
  const onCreateConvention =
    featureFlags.calendarEnabled && showSettings ?
      () => openCreateFlow({ type: 'convention', prefillOrgId: orgId })
    : undefined

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DashboardCard title="Members">
          <p className="text-2xl font-semibold text-dc-text">{memberCount}</p>
        </DashboardCard>
        <DashboardCard title="Upcoming events">
          <p className="text-2xl font-semibold text-dc-text">{upcomingEventCount}</p>
        </DashboardCard>
        <DashboardCard title="Conventions">
          <p className="text-2xl font-semibold text-dc-text">{conventions.length}</p>
        </DashboardCard>
        <DashboardCard title="Setup">
          <p className="text-2xl font-semibold text-dc-text">
            {checklist.filter((c) => c.done).length}/{checklist.length}
          </p>
          <p className="text-xs text-dc-muted">Checklist done</p>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        {/* Mobile: quick actions first. Desktop: main column left. */}
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
          <OrganizationStatusHero
            setupItems={checklist}
            visibility={visibility}
            memberCount={memberCount}
            upcomingEventCount={upcomingEventCount}
            conventionCount={conventions.length}
            communityFeatures={communityFeatures}
          />
          <OrganizerChecklist items={checklist} />
          <UpcomingOrgEventsCard
            events={events}
            conventions={conventions}
            orgSlug={slug}
            calendarEnabled={featureFlags.calendarEnabled}
            showSettings={showSettings}
            onCreateEvent={onCreateEvent}
            onCreateConvention={onCreateConvention}
          />
          <OrganizerPanel title="Recent activity" description="Member and community activity feed (coming soon).">
            <p className="text-sm text-dc-text-muted">
              Activity summaries will appear here when available. Use Communications and Moderation tabs for live
              queues today.
            </p>
          </OrganizerPanel>
          {showSettings ?
            <OrganizerPanel
              title="Public publishing"
              description="Optional outbound listings on East Coast Kink Events and attendee public pages."
            >
              <p className="mb-3 text-xs text-dc-text-muted">
                Full publish controls live in the{' '}
                <Link to={`${orgBase}?tab=ecke`} className="text-dc-accent hover:underline">
                  ECKE tab
                </Link>
                . This summary reflects outbound publish history for org-linked entities.
              </p>
              <EckeEntityPublishStatus
                entityLabel={displayName}
                loadUrl={`/api/v1/organizations/${encodeURIComponent(slug)}/ecke-publish`}
                controlPlane
              />
            </OrganizerPanel>
          : null}
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
          <QuickActionsCard actions={quickActions} />
          <PublicHubPreviewCard
            displayName={displayName}
            slug={slug}
            visibility={visibility}
            features={hubFeatures}
            publicHubHref={publicHubHref}
            editContentHref={showSettings ? `${orgBase}?tab=settings&settingsSection=content` : undefined}
          />
          <OrganizerPanel title="Member summary">
            <p className="text-2xl font-semibold text-dc-text">{memberCount}</p>
            <p className="text-sm text-dc-text-muted">Total members</p>
            <a href={`${orgBase}?tab=people`} className="mt-2 inline-block text-sm text-dc-accent hover:underline">
              Manage people →
            </a>
          </OrganizerPanel>
          <RolePermissionsCard viewerRole={viewerRole} showSettings={showSettings} />
        </div>
      </div>

      <p className="max-w-3xl text-dc-micro text-dc-muted">
        <span className="text-dc-text-muted">Kink Social</span> is your member community and organizer workspace.{' '}
        <span className="text-dc-text-muted">Public directory listing</span> controls optional public listings and Dancecard
        attendee surfaces. Configure under Tools or Settings → Publish.
      </p>
    </div>
  )
}
