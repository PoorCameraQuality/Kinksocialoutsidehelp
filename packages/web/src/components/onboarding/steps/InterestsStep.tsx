import { ONBOARDING_INTENT_OPTIONS } from '@c2k/shared'
import { WizardChoiceCard, WizardChoiceGrid, WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const CompassIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </svg>
)

type InterestsStepProps = {
  intents: Set<string>
  onToggle: (id: string) => void
}

/** What brings you here — drives recommended first steps. */
export default function InterestsStep({ intents, onToggle }: InterestsStepProps) {
  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Pick a direction', body: 'These choices shape your first-step suggestions — not a permanent label.' },
        { title: 'Change later', body: 'You can explore everything regardless of what you pick here.' },
      ]}
    >
      <WizardStepHeader
        icon={CompassIcon}
        eyebrow="Goals"
        title="What brings you here?"
        description="Pick one or more. This helps us suggest a good place to begin. You can change direction anytime."
      />
      <WizardChoiceGrid multi label="What brings you here?">
        {ONBOARDING_INTENT_OPTIONS.map((opt) => (
          <WizardChoiceCard
            key={opt.id}
            multi
            title={opt.label}
            selected={intents.has(opt.id)}
            onSelect={() => onToggle(opt.id)}
          />
        ))}
      </WizardChoiceGrid>
    </OnboardingStepLayout>
  )
}
