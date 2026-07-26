import type { ReactNode } from 'react'
import ConventionWelcomeTab from '@/components/conventions/ConventionWelcomeTab'
import type { ConventionOfficialLink } from '@/lib/convention-description'
import type { PublicAttendeeGuide } from '@/lib/dancecard/attendeeGuideJson'

type Props = {
  guide: PublicAttendeeGuide
  conventionName: string
  conventionDescription: string | null
  highlights?: string[]
  officialLinks?: ConventionOfficialLink[]
  venue?: {
    locationLabel: string | null
    venueLabel: string | null
    venueName?: string | null
    accessibilityNotes?: string | null
    hotelBlocks?: Array<{ label: string; url?: string; code?: string }> | null
  } | null
  logisticsSlot?: ReactNode
}

export default function ConventionWelcomePanel({
  guide,
  conventionName,
  conventionDescription,
  highlights,
  officialLinks,
  venue,
  logisticsSlot,
}: Props) {
  return (
    <ConventionWelcomeTab
      guide={guide}
      convention={{ name: conventionName, description: conventionDescription }}
      highlights={highlights}
      officialLinks={officialLinks}
      venue={venue}
      logisticsSlot={logisticsSlot}
    />
  )
}
