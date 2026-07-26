import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PROFILE_COMPLETION_REASSURANCE } from '@/lib/alpha-activation-copy'
import { profileCompletionPercent } from '@/lib/onboarding'
import { ONBOARDING_FIRST_STEP_ACTIONS } from '@/lib/onboarding-first-steps'
import { getProfileOnboardingGaps } from '@/lib/profile-onboarding'
import { FeatureCard, SectionCard } from './layout'

type ProfileCompletionCardProps = {
  displayName?: string | null
  bio?: string | null
  photoCount?: number
  privacyConfigured?: boolean
  joinedOrFollowed?: boolean
  className?: string
}

export function ProfileCompletionCard({
  displayName,
  bio,
  photoCount,
  privacyConfigured,
  joinedOrFollowed,
  className = '',
}: ProfileCompletionCardProps) {
  const percent = profileCompletionPercent({
    displayName,
    bio,
    photoCount,
    privacyConfigured,
    joinedOrFollowed,
  })
  const gaps = getProfileOnboardingGaps({
    homeZip: '00000',
    birthDate: '2000-01-01',
    photoCount,
  })
  const checklist = [
    { done: (displayName ?? '').trim().length > 0, label: 'Add display name', href: '/profile/edit' },
    { done: (bio ?? '').trim().length > 0, label: 'Add a short bio', href: '/profile/edit' },
    { done: (photoCount ?? 0) > 0, label: 'Add profile photo', href: '/profile/edit' },
    { done: !!privacyConfigured, label: 'Set privacy preferences', href: '/settings/privacy' },
    { done: !!joinedOrFollowed, label: 'Join or follow something', href: '/groups' },
  ]

  return (
    <SectionCard
      eyebrow="Profile"
      title={`Profile ${percent}% complete`}
      description={PROFILE_COMPLETION_REASSURANCE}
      className={className}
    >
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className={item.done ? 'text-dc-text-muted line-through' : 'text-dc-text'}>{item.label}</span>
            {!item.done ?
              <Link to={item.href} className="shrink-0 font-medium text-dc-accent hover:underline">
                Add
              </Link>
            : null}
          </li>
        ))}
      </ul>
      {gaps.includes('photo') ?
        <p className="mt-3 text-xs text-dc-text-muted">
          Profile photos use our standard upload path with moderation review when needed.
        </p>
      : null}
    </SectionCard>
  )
}

type StartHereCardProps = {
  onDismiss?: () => void
  className?: string
}

export function StartHereCard({ onDismiss, className = '' }: StartHereCardProps) {
  return (
    <SectionCard eyebrow="Start here" title="Recommended first steps" className={className}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ONBOARDING_FIRST_STEP_ACTIONS.map((action) => (
          <FeatureCard
            key={action.id}
            title={action.title}
            description={action.description}
            href={action.href}
          />
        ))}
      </div>
      {onDismiss ?
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 text-xs text-dc-text-muted hover:text-dc-text underline-offset-2 hover:underline"
        >
          Dismiss this section
        </button>
      : null}
    </SectionCard>
  )
}

export function OnboardingStepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionCard title={title} className="dc-panel-enter motion-reduce:animate-none">
      {children}
    </SectionCard>
  )
}

export function FadeIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dc-panel-enter motion-reduce:animate-none ${className}`.trim()}>{children}</div>
}

export function SlideUp({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dc-panel-enter motion-reduce:animate-none ${className}`.trim()}>{children}</div>
}

export function RouteTransition({ children }: { children: ReactNode }) {
  return <div className="dc-panel-enter motion-reduce:animate-none">{children}</div>
}
