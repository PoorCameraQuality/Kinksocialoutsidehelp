import { ONBOARDING_COMPLETE_BODY, ONBOARDING_COMPLETE_HEADLINE } from '@/lib/alpha-activation-copy'
import { FeatureCard, OnboardingSafetyReminderCard } from '@/components/ui/primitives'
import { onboardingStepIcon } from '@/components/onboarding/onboarding-step-icons'
import type { OnboardingFirstStepAction } from '@/lib/onboarding-first-steps'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

type FirstStepsStepProps = {
  orderedFirstSteps: OnboardingFirstStepAction[]
  hasIntents: boolean
  onPickAction: (href: string) => void
}

/** Completion + recommended first steps. */
export default function FirstStepsStep({ orderedFirstSteps, hasIntents, onPickAction }: FirstStepsStepProps) {
  return (
    <OnboardingStepLayout
      tips={[
        { title: 'You are in', body: 'Explore at your pace. Start Here cards stay on Home for a few days.' },
        { title: 'Safety first', body: 'Report concerns from any profile or post. Humans review reports.' },
      ]}
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/25"
            aria-hidden
          >
            <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-dc-text sm:text-2xl">{ONBOARDING_COMPLETE_HEADLINE}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-dc-text-muted">{ONBOARDING_COMPLETE_BODY}</p>
        </div>

        <OnboardingSafetyReminderCard compact />

        <section aria-labelledby="recommended-first-steps-heading">
          <h3 id="recommended-first-steps-heading" className="text-sm font-semibold text-dc-text">
            Recommended first steps
          </h3>
          {hasIntents ? (
            <p className="mt-1 text-xs text-dc-text-muted">
              Based on what you picked, we surfaced a few good places to begin.
            </p>
          ) : null}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Recommended first steps">
            {orderedFirstSteps.map((action) => (
              <li key={action.id}>
                <FeatureCard
                  title={action.title}
                  description={action.description}
                  icon={onboardingStepIcon(action.id)}
                  onClick={() => onPickAction(action.href)}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </OnboardingStepLayout>
  )
}
