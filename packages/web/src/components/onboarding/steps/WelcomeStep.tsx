import { LANDING_ALPHA_FRAMING } from '@/lib/alpha-activation-copy'
import { AlphaNotice, WizardStepHeader } from '@/components/ui/primitives'
import OnboardingThemePicker from '@/components/onboarding/OnboardingThemePicker'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const SparkleIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
  </svg>
)

/** Step 1 — welcome framing merged with the theme picker for a warm, branded start. */
export default function WelcomeStep() {
  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Private by design', body: 'You control what others see. Privacy choices come later in this setup.' },
        { title: 'Skip freely', body: 'Most steps are optional. Finish when you are ready.' },
      ]}
    >
      <WizardStepHeader
        icon={SparkleIcon}
        eyebrow="Welcome"
        title="Welcome to kink.social"
        description={LANDING_ALPHA_FRAMING}
      />

      <p className="max-w-prose text-sm leading-relaxed text-dc-text-muted">
        A short setup for age, email, profile, privacy, and first steps. Skip anything optional.
      </p>

      <section className="mt-6" aria-labelledby="welcome-theme-heading">
        <h3 id="welcome-theme-heading" className="text-sm font-semibold text-dc-text">
          Pick a look
        </h3>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-dc-text-muted">
          The site updates live as you tap a theme. You can change this anytime in Settings.
        </p>
        <div className="mt-4">
          <OnboardingThemePicker />
        </div>
      </section>

      <AlphaNotice className="mt-6" />
    </OnboardingStepLayout>
  )
}
