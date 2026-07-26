import { isValidElement, type ReactNode } from 'react'
import type { PresenterOnboardingTrack } from '@/lib/presenter-focus'
import type { ProfileFocus } from '@/lib/presenter-focus'
import { PRESENTER_OPTIONAL_STEPS, PRESENTER_STEP_LABELS, stepsForTrack } from '@/lib/presenter-onboarding'
import { WizardFooter, WizardShell, type WizardFooterAction, type WizardStepMeta } from '@/components/ui/primitives'

const picon = (path: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
  </svg>
)

const PRESENTER_STEP_ICONS: Record<string, string> = {
  chooseTrack: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  hybridFocusPick: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  welcome: 'M5 3v4M3 5h4m6-2l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z',
  basics: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  visibility: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  teachingStyle: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  catalog: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  organizerMaterials: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  skillsMentorship: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  linksGallery: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  topicsFormats: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  sessionCatalog: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  logistics: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  linksMedia: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  writingFocus: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  publicationsLinks: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  optionalTalks: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  media: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  portfolioGallery: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  services: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  consentPrivacyDelivery: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  links: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  educatorModule: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  speakerModule: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  authorModule: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  photoModule: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  review: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  done: 'M5 13l4 4L19 7',
}

function skipFromSecondaryAction(node: ReactNode): WizardFooterAction | undefined {
  if (!node || !isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) return undefined
  const onClick = node.props.onClick
  if (!onClick) return undefined
  const child = node.props.children
  const label = typeof child === 'string' ? child : 'Skip for now'
  return { label, onClick }
}

type OnboardingShellProps = {
  track: PresenterOnboardingTrack | null
  step: string
  hybridFocuses?: ProfileFocus[]
  children: React.ReactNode
  /** Enables click-to-revisit on completed steps in the left rail. */
  onStepSelect?: (id: string) => void
  /** Optional footer slot (typically StepNav rendered outside step content). */
  footer?: ReactNode
}

export function OnboardingShell({
  track,
  step,
  hybridFocuses = [],
  children,
  onStepSelect,
  footer,
}: OnboardingShellProps) {
  const stepIds = stepsForTrack(track, hybridFocuses)
  const currentIndex = Math.max(0, stepIds.indexOf(step))
  const revisitable = Boolean(onStepSelect) && currentIndex > 0 && step !== 'done'

  const steps: WizardStepMeta[] = stepIds.map((id) => ({
    id,
    label: PRESENTER_STEP_LABELS[id] ?? id,
    optional: PRESENTER_OPTIONAL_STEPS.has(id),
    icon: PRESENTER_STEP_ICONS[id] ? picon(PRESENTER_STEP_ICONS[id]) : undefined,
  }))

  return (
    <WizardShell
      brand="Professional profile"
      title="Set up your professional profile"
      description="Creator and educator profiles share one capability profile on your account — portable across organizations and events."
      steps={steps}
      currentStepId={step}
      onStepSelect={revisitable ? onStepSelect : undefined}
      footer={footer}
    >
      {children}
    </WizardShell>
  )
}

type StepNavProps = {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  secondaryAction?: React.ReactNode
  saving?: boolean
}

export function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  secondaryAction,
  saving,
}: StepNavProps) {
  if (!onNext) return null

  return (
    <WizardFooter
      back={onBack ? { label: 'Back', onClick: onBack } : undefined}
      skip={skipFromSecondaryAction(secondaryAction)}
      next={{
        label: nextLabel,
        onClick: onNext,
        disabled: nextDisabled,
        loading: saving,
      }}
    />
  )
}

export function OnboardingError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-lg border border-dc-danger/30 bg-dc-danger/10 px-3 py-2 text-sm text-dc-danger">
      {message}
    </p>
  )
}

const inputClass =
  'mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text'
const textareaClass =
  'mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text'
const labelClass = 'block text-sm font-medium text-dc-text'

export function FieldInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  helper,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  helper?: string
}) {
  const helperId = helper ? `${id}-helper` : undefined
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={helperId}
        className={inputClass}
      />
      {helper ?
        <p id={helperId} className="mt-1 text-xs text-dc-text-muted">
          {helper}
        </p>
      : null}
    </div>
  )
}

export function FieldTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  helper,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  helper?: string
}) {
  const helperId = helper ? `${id}-helper` : undefined
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={helperId}
        className={textareaClass}
      />
      {helper ?
        <p id={helperId} className="mt-1 text-xs text-dc-text-muted">
          {helper}
        </p>
      : null}
    </div>
  )
}
