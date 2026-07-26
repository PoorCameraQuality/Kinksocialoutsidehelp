import { useParams } from 'react-router-dom'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import EventOrganizerPanel from '@/components/organizer/EventOrganizerPanel'

export default function OrganizerOrgEventPageClient() {
  const { slug: orgSlug = '', eventId = '' } = useParams()

  return (
    <OrganizerAppShell
      scopeKind="org"
      eyebrow="Event manager"
      title="Event settings"
      breadcrumbs={[
        { label: 'Organizer', href: '/organizer' },
        { label: orgSlug, href: `/organizer/orgs/${encodeURIComponent(orgSlug)}` },
        {
          label: 'Events & conventions',
          href: `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule`,
        },
        { label: 'Event' },
      ]}
      publicHubHref={`/events/${encodeURIComponent(eventId)}`}
    >
      <EventOrganizerPanel eventId={eventId} orgSlug={orgSlug} />
    </OrganizerAppShell>
  )
}
