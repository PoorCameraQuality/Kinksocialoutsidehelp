import { Link } from 'react-router-dom'
import OrganizerOrgToolsPanel from '@/components/organizer/tools/OrganizerOrgToolsPanel'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import type { OrgScheduleConvention, OrgScheduleEvent } from '@/lib/organizer/org-tools-utils'

type OrgFlags = {
  calendarEnabled: boolean
}

type Props = {
  scopeKind?: 'org' | 'group'
  orgSlug?: string
  orgId?: string
  groupId?: string
  orgDisplayName?: string
  visibility?: string
  featureFlags?: OrgFlags
  conventions?: OrgScheduleConvention[]
  events?: OrgScheduleEvent[]
  showSettings?: boolean
  viewerRole?: string | null
  hasBranding?: boolean
}

export default function OrganizerToolsPanel({
  scopeKind = 'org',
  orgSlug,
  orgId,
  groupId,
  orgDisplayName,
  visibility = 'PUBLIC',
  featureFlags = { calendarEnabled: true },
  conventions = [],
  events = [],
  showSettings = false,
  viewerRole = null,
  hasBranding = false,
}: Props) {
  if (scopeKind === 'org' && orgSlug && orgId && orgDisplayName) {
    return (
      <OrganizerOrgToolsPanel
        orgSlug={orgSlug}
        orgId={orgId}
        displayName={orgDisplayName}
        visibility={visibility}
        featureFlags={featureFlags}
        conventions={conventions}
        events={events}
        showSettings={showSettings}
        viewerRole={viewerRole}
        hasBranding={hasBranding}
      />
    )
  }

  const publicGroupHref = scopeKind === 'group' && groupId ? `/groups/${encodeURIComponent(groupId)}` : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <OrganizerPanel
        title="Tools & exports"
        description="Group-level operational tools are limited. Use the parent organization console for exports and publishing."
      />
      {publicGroupHref ?
        <OrganizerPanel title="Quick links">
          <Link to={publicGroupHref} className="text-sm font-medium text-dc-accent hover:underline">
            Open group page
          </Link>
        </OrganizerPanel>
      : null}
    </div>
  )
}
