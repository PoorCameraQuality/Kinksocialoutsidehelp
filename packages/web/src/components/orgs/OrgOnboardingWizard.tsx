import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  FormStatusMessage,
  WizardChoiceCard,
  WizardChoiceGrid,
  WizardField,
  WizardFooter,
  WizardShell,
  WizardStepHeader,
  WizardTextarea,
  type WizardStepMeta,
} from '@/components/ui/primitives'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import {
  normalizeOrgSlugInput,
  orgSlugPreview,
  validateOrgSlugInput,
} from '@/lib/org-slug-utils'
import {
  ORG_BASICS_HEADING,
  ORG_BASICS_INTRO,
  ORG_LAUNCH_HEADING,
  ORG_LAUNCH_INTRO,
  ORG_ONBOARDING_STEP_LABELS,
  ORG_ONBOARDING_STEPS,
  ORG_VISIBILITY_HEADING,
  ORG_VISIBILITY_INTRO,
  ORG_VISIBILITY_OPTIONS,
  ORG_WELCOME_INTRO,
  ORG_WELCOME_TITLE,
  type OrgOnboardingStep,
  type OrgVisibility,
} from '@/lib/org-onboarding'

const oicon = (path: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
  </svg>
)

const STEP_ICONS: Record<OrgOnboardingStep, string> = {
  welcome: 'M5 3v4M3 5h4m6-2l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z',
  basics: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  visibility: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  launch: 'M5 13l4 4L19 7',
}

const STEPS: WizardStepMeta[] = ORG_ONBOARDING_STEPS.map((id) => ({
  id,
  label: ORG_ONBOARDING_STEP_LABELS[id],
  icon: oicon(STEP_ICONS[id]),
}))

const VISIBILITY_LABELS: Record<OrgVisibility, string> = {
  PUBLIC: 'Public',
  MEMBERS: 'Members only',
  PRIVATE: 'Private',
}

function mapCreateOrgError(status: number, error?: string): string {
  if (status === 401) return 'Sign in to create an organization.'
  if (error === 'Invalid slug') {
    return 'That URL slug is too short. Use at least two letters or numbers, or leave it blank to generate one.'
  }
  if (error === 'Invalid body') {
    return 'Check the form. Organization name is required and must be under 255 characters.'
  }
  return error ?? 'Could not create organization. Try again.'
}

export default function OrgOnboardingWizard() {
  const navigate = useNavigate()
  const { status, isAuthenticated } = useAuth()
  const [step, setStep] = useState<OrgOnboardingStep>('welcome')
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<OrgVisibility>('PUBLIC')
  const [slugTouched, setSlugTouched] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const slugPreview = useMemo(() => orgSlugPreview(displayName, slug), [displayName, slug])
  const slugFieldError = slugTouched ? validateOrgSlugInput(slug) : null

  if (status === 'loading') {
    return <div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-dc-elevated-muted px-4 py-12" />
  }

  if (status === 'ready' && !isAuthenticated) {
    return <Navigate to={buildLoginHref('/orgs/new')} replace />
  }

  async function createOrganization() {
    setErr(null)

    const name = displayName.trim()
    if (!name) {
      setErr('Organization name is required.')
      setStep('basics')
      return
    }

    const slugErr = validateOrgSlugInput(slug)
    if (slugErr) {
      setSlugTouched(true)
      setErr(slugErr)
      setStep('basics')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        displayName: name,
        bio: bio.trim() || undefined,
        visibility,
      }
      const normalizedSlug = normalizeOrgSlugInput(slug)
      if (normalizedSlug.length >= 2) body.slug = normalizedSlug

      const r = await fetch('/api/v1/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as { organization?: { slug: string }; error?: string }
      if (!r.ok) {
        setErr(mapCreateOrgError(r.status, j.error))
        return
      }
      if (j.organization?.slug) {
        navigate(`/organizer/orgs/${encodeURIComponent(j.organization.slug)}`)
        return
      }
      setErr('Unexpected response from the server.')
    } catch {
      setErr('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const footer = (() => {
    switch (step) {
      case 'welcome':
        return <WizardFooter next={{ label: 'Get started', onClick: () => setStep('basics') }} />
      case 'basics':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('welcome') }}
            next={{
              label: 'Continue',
              disabled: !displayName.trim() || Boolean(slugFieldError),
              onClick: () => {
                setErr(null)
                const slugErr = validateOrgSlugInput(slug)
                if (slugErr) {
                  setSlugTouched(true)
                  setErr(slugErr)
                  return
                }
                setStep('visibility')
              },
            }}
          />
        )
      case 'visibility':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('basics') }}
            next={{ label: 'Continue', onClick: () => setStep('launch') }}
          />
        )
      case 'launch':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('visibility') }}
            next={{
              label: loading ? 'Creating organization…' : 'Create organization',
              loading,
              disabled: loading,
              onClick: () => void createOrganization(),
            }}
          />
        )
      default:
        return null
    }
  })()

  return (
    <WizardShell
      brand="Organization setup"
      title="Create an organization"
      description={ORG_WELCOME_INTRO}
      steps={STEPS}
      currentStepId={step}
      onStepSelect={(id) => setStep(id as OrgOnboardingStep)}
      footer={footer}
    >
      {step === 'welcome' ?
        <div>
          <WizardStepHeader
            icon={oicon(STEP_ICONS.welcome)}
            eyebrow="Welcome"
            title={ORG_WELCOME_TITLE}
            description={ORG_WELCOME_INTRO}
          />
          <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
            <li>Public hub for events, posts, and member information</li>
            <li>Event infrastructure, conventions, schedules, and check-in tools</li>
            <li>Manage members, communications, and visibility from one console</li>
          </ul>
          <p className="mt-4 text-xs text-dc-text-muted">
            <Link to="/orgs" className="text-dc-accent hover:underline">
              ← Back to organizations
            </Link>
          </p>
        </div>
      : null}

      {step === 'basics' ?
        <div>
          <WizardStepHeader
            icon={oicon(STEP_ICONS.basics)}
            eyebrow="Details"
            title={ORG_BASICS_HEADING}
            description={ORG_BASICS_INTRO}
          />
          <div className="space-y-5">
            <WizardField
              name="org-name"
              label="Organization name"
              hint="Use the name people already know you by."
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <WizardField
              name="org-slug"
              label="Page address"
              optional
              hint="Leave blank to generate one automatically. If the URL is already in use, a number may be added for you."
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlugTouched(true)}
              spellCheck={false}
              autoComplete="off"
            />
            {slugFieldError ?
              <FormStatusMessage tone="error">{slugFieldError}</FormStatusMessage>
            : (
              <p className="rounded-lg border border-dc-border bg-dc-surface/50 px-3 py-2 font-mono text-xs text-dc-text-muted">
                <span className="text-dc-muted">Your URL: </span>
                /orgs/{slugPreview}
              </p>
            )}
            <WizardTextarea
              name="org-bio"
              label="Short description"
              hint="Describe who this organization is for and what you host."
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            {err && step === 'basics' ?
              <FormStatusMessage tone="error">{err}</FormStatusMessage>
            : null}
          </div>
        </div>
      : null}

      {step === 'visibility' ?
        <div>
          <WizardStepHeader
            icon={oicon(STEP_ICONS.visibility)}
            eyebrow="Visibility"
            title={ORG_VISIBILITY_HEADING}
            description={ORG_VISIBILITY_INTRO}
          />
          <WizardChoiceGrid label="Organization visibility" className="mt-2">
            {ORG_VISIBILITY_OPTIONS.map((opt) => (
              <WizardChoiceCard
                key={opt.value}
                title={opt.label}
                description={opt.description}
                selected={visibility === opt.value}
                onSelect={() => setVisibility(opt.value)}
              />
            ))}
          </WizardChoiceGrid>
        </div>
      : null}

      {step === 'launch' ?
        <div>
          <WizardStepHeader
            icon={oicon(STEP_ICONS.launch)}
            eyebrow="Launch"
            title={ORG_LAUNCH_HEADING}
            description={ORG_LAUNCH_INTRO}
          />
          <dl className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated-muted/40 p-4 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Name</dt>
              <dd className="font-medium text-dc-text">{displayName.trim() || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">URL</dt>
              <dd className="font-mono text-xs text-dc-text">/orgs/{slugPreview}</dd>
            </div>
            {bio.trim() ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-dc-text-muted">Description</dt>
                <dd className="text-dc-text">{bio.trim()}</dd>
              </div>
            : null}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Visibility</dt>
              <dd className="font-medium text-dc-text">{VISIBILITY_LABELS[visibility]}</dd>
            </div>
          </dl>
          {err ?
            <FormStatusMessage tone="error">{err}</FormStatusMessage>
          : null}
        </div>
      : null}
    </WizardShell>
  )
}
