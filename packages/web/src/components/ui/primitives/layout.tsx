import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'

type PageShellProps = {
  title?: string
  description?: string
  children: ReactNode
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const maxWidthClass = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
} as const

export function PageShell({ title, description, children, maxWidth = 'xl', className = '' }: PageShellProps) {
  return (
    <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 ${maxWidthClass[maxWidth]} ${className}`.trim()}>
      {title ?
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-dc-text sm:text-3xl">{title}</h1>
          {description ?
            <p className="mt-2 max-w-2xl text-sm text-dc-text-muted">{description}</p>
          : null}
        </header>
      : null}
      {children}
    </div>
  )
}

type SectionCardProps = {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  eyebrow?: string
}

export function SectionCard({ title, description, eyebrow, children, className = '' }: SectionCardProps) {
  return (
    <section
      className={`${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass} p-5 sm:p-6 ${className}`.trim()}
    >
      {eyebrow ?
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">{eyebrow}</p>
      : null}
      {title ?
        <h2 className={`font-display font-semibold text-dc-text ${eyebrow ? 'mt-1' : ''} text-lg`}>{title}</h2>
      : null}
      {description ?
        <p className="mt-1 text-sm text-dc-text-muted">{description}</p>
      : null}
      <div className={title || description || eyebrow ? 'mt-4' : undefined}>{children}</div>
    </section>
  )
}

type FeatureCardProps = {
  title: string
  description: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
}

export function FeatureCard({ title, description, href, onClick, icon }: FeatureCardProps) {
  const inner = (
    <>
      {icon ?
        <div className="mb-3 text-dc-accent" aria-hidden>
          {icon}
        </div>
      : null}
      <h3 className="text-base font-semibold text-dc-text">{title}</h3>
      <p className="mt-1 text-sm text-dc-text-muted">{description}</p>
    </>
  )
  const className =
    'block rounded-xl border border-dc-border bg-dc-surface/60 p-4 text-left transition-colors hover:border-dc-accent-border hover:bg-dc-elevated-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent'
  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`w-full ${className}`}>
      {inner}
    </button>
  )
}

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <span
            key={n}
            className={`h-2 rounded-full transition-all motion-reduce:transition-none ${
              active ? 'w-6 bg-dc-accent' : done ? 'w-2 bg-dc-accent/70' : 'w-2 bg-dc-border'
            }`}
            aria-hidden
          />
        )
      })}
    </div>
  )
}

export function OnboardingProgress({ step, total, label }: { step: number; total: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, Math.round((step / total) * 100)))
  return (
    <div className="space-y-2 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">
        Step {step} of {total}
        {label ? ` · ${label}` : ''}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-dc-border"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Onboarding step ${step} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-dc-accent transition-[width] motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function AlphaNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3 text-sm text-dc-text-muted ${className}`.trim()}
      role="note"
    >
      <p className="font-medium text-dc-text">Public beta</p>
      <p className="mt-1">
        kink.social is in active public beta. Features may be incomplete or change. Some areas use demo content for
        testing. Share only what you are comfortable with. Profile photos are supported; other uploads may be disabled
        for now.
      </p>
    </div>
  )
}

export function PrivacyNoticeCard({ className = '' }: { className?: string }) {
  return (
    <SectionCard
      eyebrow="Privacy"
      title="You control your visibility"
      description="You can change profile visibility, messaging rules, and data controls in settings at any time."
      className={className}
    >
      <Link to="/settings/privacy" className="text-sm font-medium text-dc-accent hover:underline">
        Open privacy settings
      </Link>
    </SectionCard>
  )
}

export function OnboardingSafetyReminderCard({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div
        className={`rounded-xl border border-dc-border bg-dc-elevated-muted/60 px-3 py-3 ${className}`.trim()}
        role="note"
      >
        <p className="text-sm text-dc-text-muted">
          <span className="font-medium text-dc-text">Consent-first community.</span> Report concerns from profiles,
          messages, and events.{' '}
          <Link to="/guidelines" className="font-medium text-dc-accent hover:underline">
            Guidelines
          </Link>
          {' · '}
          <Link to="/privacy" className="font-medium text-dc-accent hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div
      className={`rounded-xl border border-dc-border bg-dc-elevated-muted/60 px-4 py-4 ${className}`.trim()}
      role="note"
    >
      <h3 className="text-sm font-semibold text-dc-text">A consent-first community</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Safety tools are available from profiles, messages, groups, and events. Report concerns when something feels
        unsafe, coercive, harassing, or out of bounds.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link to="/guidelines" className="font-medium text-dc-accent hover:underline">
          Community guidelines
        </Link>
        <Link to="/privacy" className="font-medium text-dc-accent hover:underline">
          Privacy policy
        </Link>
      </div>
    </div>
  )
}

export function SafetyNoticeCard({ className = '' }: { className?: string }) {
  return (
    <SectionCard
      eyebrow="Safety"
      title="Consent-first community"
      description="Report concerns from any profile or message menu. Moderators review reports. The site owner may access private content only for safety, abuse investigations, security, support, legal compliance, or operations."
      className={className}
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/guidelines" className="text-dc-accent hover:underline">
          Community guidelines
        </Link>
        <Link to="/privacy" className="text-dc-accent hover:underline">
          Privacy policy
        </Link>
      </div>
    </SectionCard>
  )
}

export function EncryptionNoticeCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`max-w-prose rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-4 text-sm text-dc-text-muted ${className}`.trim()}
      role="region"
      aria-label="Private message privacy"
    >
      <p className="font-medium leading-snug text-dc-text">
        Private messages are not public, but they are not end-to-end encrypted.
      </p>
      <p className="mt-2 leading-relaxed">
        Your DMs are private from other members. However, authorized kink.social staff may access or preserve private
        content when needed for safety reports, abuse investigations, platform security, support, legal compliance, or
        site operations.
      </p>
    </div>
  )
}

export function FormStatusMessage({ tone, children }: { tone: 'success' | 'error' | 'info' | 'warning'; children: ReactNode }) {
  const toneClass = {
    success: 'border-dc-accent-border bg-dc-accent-muted text-dc-text',
    error: 'border-dc-danger-border bg-dc-danger-muted text-dc-danger',
    info: 'border-dc-border bg-dc-elevated-muted text-dc-text-muted',
    warning: 'border-dc-warning/30 bg-dc-warning-muted text-dc-warning',
  }[tone]
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function LoadingButton({
  loading,
  children,
  className = '',
  ...props
}: React.ComponentProps<'button'> & { loading?: boolean }) {
  return (
    <Button {...props} disabled={loading || props.disabled} className={className}>
      {loading ? 'Working…' : children}
    </Button>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel,
  onAction,
  href,
}: {
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  href?: string
}) {
  return (
    <SectionCard title={title} description={message}>
      {actionLabel && href ?
        <Link to={href} className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover">
          {actionLabel}
        </Link>
      : null}
      {actionLabel && onAction ?
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {actionLabel}
        </button>
      : null}
    </SectionCard>
  )
}
