import ConventionDancecardOrganizerClient from '@/components/organizer/convention/ConventionDancecardOrganizerClient'

type Props = {
  conventionSlug: string
  orgSlug: string
  onProgramChanged?: () => void
}

/** Convention organizer - full Dancecard kit shell and tabs. */
export default function ConventionOrganizerClient({ conventionSlug, orgSlug, onProgramChanged }: Props) {
  return (
    <ConventionDancecardOrganizerClient
      conventionSlug={conventionSlug}
      orgSlug={orgSlug}
      onProgramChanged={onProgramChanged}
    />
  )
}
