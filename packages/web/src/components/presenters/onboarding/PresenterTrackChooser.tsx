import type { PresenterOnboardingTrack } from '@/lib/presenter-focus'
import {
  LoadingButton,
  WizardChoiceCard,
  WizardChoiceGrid,
  WizardStepHeader,
} from '@/components/ui/primitives'

const TRACK_CARDS: {
  track: PresenterOnboardingTrack
  title: string
  description: string
}[] = [
  {
    track: 'educator',
    title: 'Educator or instructor',
    description:
      'For people who teach classes, workshops, skills, consent, safety, technique, or community education.',
  },
  {
    track: 'speaker',
    title: 'Presenter, speaker, or panelist',
    description:
      'For people who give talks, facilitate discussions, appear on panels, demo with others, or present at events.',
  },
  {
    track: 'author',
    title: 'Author or writer',
    description:
      'For people who publish guides, essays, education articles, interviews, or written resources.',
  },
  {
    track: 'photographer',
    title: 'Photographer or media creator',
    description:
      'For people offering event photography, portraits, media work, documentation, or visual storytelling.',
  },
  {
    track: 'hybrid',
    title: 'Hybrid profile',
    description: 'For people who do more than one of these.',
  },
]

type Props = {
  selected: PresenterOnboardingTrack | null
  onSelect: (track: PresenterOnboardingTrack) => void
  onContinue: () => void
}

export default function PresenterTrackChooser({ selected, onSelect, onContinue }: Props) {
  return (
    <div>
      <WizardStepHeader
        eyebrow="Profile type"
        title="What kind of profile are you setting up?"
        description="Choose the profile type that best fits how you want organizers and community members to find you."
      />
      <WizardChoiceGrid columns={1} label="Profile type">
        {TRACK_CARDS.map((card) => (
          <WizardChoiceCard
            key={card.track}
            title={card.title}
            description={card.description}
            selected={selected === card.track}
            onSelect={() => onSelect(card.track)}
          />
        ))}
      </WizardChoiceGrid>
      <div className="mt-6">
        <LoadingButton disabled={!selected} onClick={onContinue} className="w-full sm:w-auto sm:min-w-[10rem]">
          Continue
        </LoadingButton>
      </div>
    </div>
  )
}
