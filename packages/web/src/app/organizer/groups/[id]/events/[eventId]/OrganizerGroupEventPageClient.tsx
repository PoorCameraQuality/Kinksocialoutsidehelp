import { useParams } from 'react-router-dom'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import EventOrganizerPanel from '@/components/organizer/EventOrganizerPanel'

export default function OrganizerGroupEventPageClient() {
  const { id: groupId = '', eventId = '' } = useParams()

  return (
    <OrganizerAppShell
      scopeKind="group"
      eyebrow="Event manager"
      title="Event settings"
      breadcrumbs={[
        { label: 'Organizer', href: '/organizer' },
        { label: 'Group', href: `/organizer/groups/${encodeURIComponent(groupId)}` },
        {
          label: 'Schedule',
          href: `/organizer/groups/${encodeURIComponent(groupId)}?tab=schedule`,
        },
        { label: 'Event' },
      ]}
      publicHubHref={`/events/${encodeURIComponent(eventId)}`}
    >
      <EventOrganizerPanel eventId={eventId} groupId={groupId} />
    </OrganizerAppShell>
  )
}
