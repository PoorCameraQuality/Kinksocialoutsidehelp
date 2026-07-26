import OrganizerGroupCommunicationsPanel from '@/components/organizer/communications/OrganizerGroupCommunicationsPanel'
import OrganizerOrgCommunicationsPanel from '@/components/organizer/communications/OrganizerOrgCommunicationsPanel'

type Props = {
  scopeKind?: 'org' | 'group'
  orgSlug?: string
  groupId?: string
  forumsEnabled?: boolean
  chatEnabled?: boolean
  showSettings?: boolean
  viewerRole?: string | null
}

export default function OrganizerCommunicationsPanel({
  scopeKind = 'org',
  orgSlug,
  groupId,
  forumsEnabled = true,
  chatEnabled = true,
  showSettings = false,
  viewerRole = null,
}: Props) {
  if (scopeKind === 'org' && orgSlug) {
    return (
      <OrganizerOrgCommunicationsPanel
        orgSlug={orgSlug}
        forumsEnabled={forumsEnabled !== false}
        chatEnabled={chatEnabled !== false}
        showSettings={showSettings}
        viewerRole={viewerRole}
      />
    )
  }

  if (scopeKind === 'group' && groupId) {
    return <OrganizerGroupCommunicationsPanel groupId={groupId} viewerRole={viewerRole} />
  }

  return null
}
