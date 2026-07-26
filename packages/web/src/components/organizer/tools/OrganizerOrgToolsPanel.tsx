import { useEffect, useMemo, useState } from 'react'
import { parseEckeControlPlaneSummary } from '@/lib/ecke-control-plane-summary'
import ComingSoonPaymentsCard from '@/components/organizer/tools/ComingSoonPaymentsCard'
import ExternalPublishingSection from '@/components/organizer/tools/ExternalPublishingSection'
import ProgramExportsSection from '@/components/organizer/tools/ProgramExportsSection'
import QuickLinksCard from '@/components/organizer/tools/QuickLinksCard'
import {
  PublishingChecklistCard,
  ToolStatusGrid,
  ToolsFooterNote,
  ToolsNeedHelpCard,
  ToolsPageHeader,
  WhereToolsLiveCard,
  type ToolStatusCard,
} from '@/components/organizer/tools/tools-ui'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'
import {
  buildOrgProgramRows,
  buildPublishingChecklist,
  canManageConventionTools,
  canUseOrgPublishActions,
  eckeStatusLabel,
  type EckePublishSummary,
  type OrgScheduleConvention,
  type OrgScheduleEvent,
} from '@/lib/organizer/org-tools-utils'

type OrgFlags = {
  calendarEnabled: boolean
}

type Props = {
  orgSlug: string
  orgId: string
  displayName: string
  visibility: string
  featureFlags: OrgFlags
  conventions: OrgScheduleConvention[]
  events: OrgScheduleEvent[]
  showSettings: boolean
  viewerRole: string | null
  hasBranding: boolean
}

export default function OrganizerOrgToolsPanel({
  orgSlug,
  orgId,
  displayName,
  visibility,
  featureFlags,
  conventions,
  events,
  showSettings,
  viewerRole,
  hasBranding,
}: Props) {
  const [hasWelcomeContent, setHasWelcomeContent] = useState(false)
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const scheduleHref = `${orgBase}?tab=schedule`
  const publishHref = `${orgBase}?tab=settings&settingsSection=publish`
  const settingsHref = `${orgBase}?tab=settings`
  const publicHubHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Overview`
  const publicCalendarHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Calendar`
  const communicationsHref = `${orgBase}?tab=communications`
  const moderationHref = `${orgBase}?tab=moderation`

  const [ecke, setEcke] = useState<EckePublishSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const orgRes = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
        if (orgRes.ok && !cancelled) {
          const o = (await orgRes.json()) as { organization?: { community?: { welcomeHtml?: string | null } } }
          setHasWelcomeContent(Boolean(o.organization?.community?.welcomeHtml?.trim()))
        }
        const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/ecke-publish`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (!r.ok) {
          setEcke({
            bridgeConnected: false,
            listingStatus: null,
            externalSlug: null,
            lastPublishedAt: null,
            lastPreviewAt: null,
            loadError: r.status === 403 ? 'Insufficient role' : 'Could not load',
          })
          return
        }
        const summary = parseEckeControlPlaneSummary(await r.json())
        setEcke({
          bridgeConnected: summary.bridgeConnected,
          listingStatus: summary.aggregateStatus,
          externalSlug: summary.externalSlug,
          lastPublishedAt: summary.lastPublishedAt,
          lastPreviewAt: summary.lastPreviewAt,
          loadError: null,
        })
      } catch {
        if (!cancelled) {
          setEcke({
            bridgeConnected: false,
            listingStatus: null,
            externalSlug: null,
            lastPublishedAt: null,
            lastPreviewAt: null,
            loadError: 'Network error',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug])

  const programRows = useMemo(() => buildOrgProgramRows(conventions, events), [conventions, events])
  const conventionRows = useMemo(() => programRows.filter((r) => r.kind === 'convention'), [programRows])
  const canManagePrograms = canManageConventionTools(viewerRole)
  const canPublish = canUseOrgPublishActions(viewerRole)
  const canModerate = canManagePrograms

  const eckeLabel = eckeStatusLabel(ecke)
  const eckePreviewBuilt = Boolean(ecke?.lastPreviewAt || ecke?.listingStatus === 'draft' || ecke?.listingStatus === 'published')

  const statusCards: ToolStatusCard[] = [
    {
      label: 'Program exports',
      value: featureFlags.calendarEnabled ? 'Available' : 'Calendar off',
      sub: 'In convention program managers',
      tone: featureFlags.calendarEnabled ? 'success' : 'muted',
      href: scheduleHref,
      linkLabel: 'Open Events & conventions →',
    },
    {
      label: 'ECKE publishing',
      value: eckeLabel.label,
      sub: ecke?.bridgeConnected ? 'Publish bridge' : 'Preview or unavailable',
      tone: eckeLabel.tone === 'danger' ? 'warning' : eckeLabel.tone,
      href: canPublish ? publishHref : undefined,
      linkLabel: canPublish ? 'Edit publish settings →' : undefined,
    },
    {
      label: 'Public calendar',
      value: featureFlags.calendarEnabled ? 'Enabled' : 'Disabled',
      sub: 'Member-facing programs',
      tone: featureFlags.calendarEnabled ? 'success' : 'muted',
      href: featureFlags.calendarEnabled ? publicCalendarHref : settingsHref,
      linkLabel: featureFlags.calendarEnabled ? 'View public calendar →' : 'Feature settings →',
    },
    {
      label: 'Payments',
      value: 'Coming soon',
      sub: 'Not active on Kink Social',
      tone: 'muted',
      disabled: true,
    },
  ]

  const createConventionFlow: OpenCreateFlowOptions | null =
    showSettings && featureFlags.calendarEnabled ? { type: 'convention', prefillOrgId: orgId } : null

  const quickLinks = [
    { href: scheduleHref, title: 'Events & conventions', description: 'Create and manage programs' },
    ...(showSettings ?
      [{ href: settingsHref, title: 'Organization settings', description: 'Identity, branding, features, content, publishing' }]
    : []),
    ...(featureFlags.calendarEnabled ?
      [{ href: publicCalendarHref, title: 'Public member calendar', description: 'Preview what members and visitors see' }]
    : []),
    { href: publicHubHref, title: 'Public hub', description: 'Open your organization page' },
    ...(canManagePrograms ?
      [{ href: communicationsHref, title: 'Communications', description: 'Manage forums and chat' }]
    : []),
    ...(canModerate ? [{ href: moderationHref, title: 'Moderation', description: 'Review reports and safety tools' }] : []),
  ]

  const publishingChecks = buildPublishingChecklist({
    displayName,
    visibility,
    hasBranding,
    hasWelcome: hasWelcomeContent,
    hasPrograms: programRows.length > 0,
    eckePreviewBuilt,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ToolsPageHeader
        scheduleHref={scheduleHref}
        publishHref={publishHref}
        publicHubHref={publicHubHref}
        showPublishSettings={canPublish}
      />

      <ToolStatusGrid cards={statusCards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          <ProgramExportsSection
            orgSlug={orgSlug}
            calendarEnabled={featureFlags.calendarEnabled}
            conventionRows={conventionRows}
            createConventionFlow={createConventionFlow}
            canManagePrograms={canManagePrograms}
            showSettings={showSettings}
            scheduleHref={scheduleHref}
            publicCalendarHref={publicCalendarHref}
          />

          <ExternalPublishingSection
            orgSlug={orgSlug}
            displayName={displayName}
            publishHref={publishHref}
            scheduleHref={scheduleHref}
            showPublishActions={canPublish}
          />

          <QuickLinksCard links={quickLinks} />

          <ComingSoonPaymentsCard orgSlug={orgSlug} />
        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <WhereToolsLiveCard scheduleHref={scheduleHref} />
          <PublishingChecklistCard
            checks={publishingChecks}
            publishHref={publishHref}
            showPublishSettings={canPublish}
          />
          <ToolsNeedHelpCard publicHubHref={publicHubHref} scheduleHref={scheduleHref} />
        </aside>
      </div>

      <ToolsFooterNote scheduleHref={scheduleHref} />
    </div>
  )
}
