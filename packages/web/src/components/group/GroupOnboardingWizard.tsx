import type { GroupRule } from '@c2k/shared'
import {
  GROUP_CATEGORY_DESCRIPTIONS,
  GROUP_CATEGORY_VALUES,
  groupRulesSchema,
  normalizeGroupTags,
} from '@c2k/shared'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FormStatusMessage,
  WizardField,
  WizardFooter,
  WizardSelect,
  WizardShell,
  WizardStepHeader,
  type WizardStepMeta,
} from '@/components/ui/primitives'
import { TAG_SEEDS } from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { uploadGroupBrandingAsset } from '@/lib/group-branding-upload'
import {
  GROUP_BASICS_HEADING,
  GROUP_BASICS_INTRO,
  GROUP_COMMUNITY_HEADING,
  GROUP_COMMUNITY_INTRO,
  GROUP_LAUNCH_HEADING,
  GROUP_LAUNCH_INTRO,
  GROUP_ONBOARDING_STEP_LABELS,
  GROUP_ONBOARDING_STEPS,
  GROUP_WELCOME_INTRO,
  GROUP_WELCOME_TITLE,
  type GroupOnboardingStep,
} from '@/lib/group-onboarding'

const gicon = (path: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
  </svg>
)

const STEP_ICONS: Record<GroupOnboardingStep, string> = {
  welcome: 'M5 3v4M3 5h4m6-2l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z',
  basics: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  community: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  launch: 'M5 13l4 4L19 7',
}

const STEPS: WizardStepMeta[] = GROUP_ONBOARDING_STEPS.map((id) => ({
  id,
  label: GROUP_ONBOARDING_STEP_LABELS[id],
  icon: gicon(STEP_ICONS[id]),
}))

const VISIBILITY_LABELS: Record<'public' | 'private' | 'invite-only', string> = {
  public: 'Public — listed in directory',
  private: 'Private — members only',
  'invite-only': 'Invite only — join by invitation',
}

function slugFromName(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'
  return `${base}-${Date.now().toString(36)}`
}

const emptyRule = (): GroupRule => ({ title: '', body: '' })

export default function GroupOnboardingWizard() {
  const navigate = useNavigate()
  const bannerInputId = useId()
  const { status, isAuthenticated } = useAuth()
  const [step, setStep] = useState<GroupOnboardingStep>('welcome')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(GROUP_CATEGORY_VALUES[0])
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private' | 'invite-only'>('public')
  const [rules, setRules] = useState<GroupRule[]>([])
  const [showRules, setShowRules] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(bannerFile)
    setBannerPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [bannerFile])

  const bannerLabel = useMemo(() => {
    if (!bannerFile) return 'None'
    return bannerFile.name
  }, [bannerFile])

  const validateBasics = useCallback((): string | null => {
    if (!name.trim()) return 'Name is required.'
    if (!category) return 'Choose a purpose category.'
    return null
  }, [name, category])

  const validateCommunity = useCallback((): string | null => {
    const activeRules = rules.filter((r) => r.title.trim() && r.body.trim())
    const rulesParsed = groupRulesSchema.safeParse(activeRules)
    if (!rulesParsed.success) return 'Each rule needs a title and body (max 20 rules).'
    return null
  }, [rules])

  async function handleCreate() {
    setError(null)
    const basicsErr = validateBasics()
    if (basicsErr) {
      setError(basicsErr)
      setStep('basics')
      return
    }
    const communityErr = validateCommunity()
    if (communityErr) {
      setError(communityErr)
      setStep('community')
      return
    }
    const activeRules = rules.filter((r) => r.title.trim() && r.body.trim())
    const rulesParsed = groupRulesSchema.safeParse(activeRules)
    if (!rulesParsed.success) {
      setError('Each rule needs a title and body (max 20 rules).')
      setStep('community')
      return
    }
    const tagParts = tagsInput.split(/[,;\s]+/).filter(Boolean)
    const tags = normalizeGroupTags(tagParts)
    setSubmitting(true)
    try {
      const r = await fetch('/api/v1/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slugFromName(name.trim()),
          category,
          ...(tags.length > 0 ? { tags } : {}),
          visibility,
          ...(rulesParsed.data.length > 0 ? { rules: rulesParsed.data } : {}),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        group?: { id: string; name: string; slug: string }
      }
      if (!r.ok) {
        setError(j.error ?? 'Could not create group.')
        return
      }
      if (!j.group?.id) {
        setError('Group was created but no id was returned.')
        return
      }
      if (bannerFile) {
        try {
          await uploadGroupBrandingAsset(j.group.id, 'banner', bannerFile)
        } catch (uploadErr) {
          setError(
            uploadErr instanceof Error ?
              `Group created, but banner upload failed: ${uploadErr.message}`
            : 'Group created, but banner upload failed.',
          )
          navigate(`/organizer/groups/${encodeURIComponent(j.group.id)}`)
          return
        }
      }
      navigate(`/organizer/groups/${encodeURIComponent(j.group.id)}`)
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateRule(index: number, patch: Partial<GroupRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  if (status === 'loading') {
    return <div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-dc-elevated-muted px-4 py-12" />
  }

  if (status === 'ready' && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="mb-2 text-xl font-bold text-dc-text">Sign in to create a group</h1>
        <p className="mb-6 text-sm text-dc-text-muted">Groups are tied to your Kink Social profile.</p>
        <Link
          to={buildLoginHref('/groups/onboarding')}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Sign in
        </Link>
      </div>
    )
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
              disabled: !name.trim() || !category,
              onClick: () => {
                setError(null)
                const err = validateBasics()
                if (err) {
                  setError(err)
                  return
                }
                setStep('community')
              },
            }}
          />
        )
      case 'community':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('basics') }}
            skip={{ label: 'Skip for now', onClick: () => setStep('launch') }}
            next={{
              label: 'Continue',
              onClick: () => {
                setError(null)
                const err = validateCommunity()
                if (err) {
                  setError(err)
                  return
                }
                setStep('launch')
              },
            }}
          />
        )
      case 'launch':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('community') }}
            next={{
              label: submitting ? 'Creating…' : 'Create group',
              loading: submitting,
              disabled: submitting,
              onClick: () => void handleCreate(),
            }}
          />
        )
      default:
        return null
    }
  })()

  const activeRuleCount = rules.filter((r) => r.title.trim() && r.body.trim()).length

  return (
    <WizardShell
      brand="Group setup"
      title="Create a group"
      description={GROUP_WELCOME_INTRO}
      steps={STEPS}
      currentStepId={step}
      onStepSelect={(id) => setStep(id as GroupOnboardingStep)}
      footer={footer}
    >
      {step === 'welcome' ?
        <div>
          <WizardStepHeader
            icon={gicon(STEP_ICONS.welcome)}
            eyebrow="Welcome"
            title={GROUP_WELCOME_TITLE}
            description={GROUP_WELCOME_INTRO}
          />
          <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
            <li>Name your group and choose a purpose category</li>
            <li>Set privacy and optional tags for discovery</li>
            <li>Add community rules members accept when joining</li>
          </ul>
          <p className="mt-4 text-xs text-dc-text-muted">
            <Link to="/groups" className="text-dc-accent hover:underline">
              ← Back to groups
            </Link>
          </p>
        </div>
      : null}

      {step === 'basics' ?
        <div>
          <WizardStepHeader
            icon={gicon(STEP_ICONS.basics)}
            eyebrow="Basics"
            title={GROUP_BASICS_HEADING}
            description={GROUP_BASICS_INTRO}
          />
          <div className="space-y-5">
            <WizardField
              name="grp-name"
              label="Name"
              hint="e.g. Philly Rope Munch"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              placeholder="e.g. Philly Rope Munch"
            />
            <WizardSelect
              name="grp-category"
              label="Purpose"
              hint="Choose the category that best describes your group."
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {GROUP_CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value} · {GROUP_CATEGORY_DESCRIPTIONS[value]}
                </option>
              ))}
            </WizardSelect>
            <WizardField
              name="grp-tags"
              label="Tags"
              optional
              hint={`Comma-separated interests. Suggestions: ${TAG_SEEDS.slice(0, 5).map((t) => `#${t}`).join(', ')}…`}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. rope, munch, gear-swap"
            />
            <WizardSelect
              name="grp-visibility"
              label="Who can find this group?"
              hint={VISIBILITY_LABELS[visibility]}
              required
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            >
              <option value="public">Public — listed in directory</option>
              <option value="private">Private — members only</option>
              <option value="invite-only">Invite only</option>
            </WizardSelect>
            <div>
              <p className="text-sm font-medium text-dc-text">
                Banner image <span className="font-normal text-dc-text-muted">(optional)</span>
              </p>
              <p className="mt-1 text-xs text-dc-text-muted">
                Wide header on your group page (3:1 or 16:9). You can change this later in organizer settings.
              </p>
              {bannerPreviewUrl ?
                <div className="mt-3 overflow-hidden rounded-xl border border-dc-border">
                  <img src={bannerPreviewUrl} alt="" className="aspect-[3/1] w-full object-cover" />
                </div>
              : (
                <div className="mt-3 flex aspect-[3/1] w-full items-center justify-center rounded-xl border-2 border-dashed border-dc-border bg-dc-surface-muted text-xs text-dc-muted">
                  No banner yet
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  id={bannerInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    e.target.value = ''
                    setBannerFile(file)
                  }}
                />
                <label
                  htmlFor={bannerInputId}
                  className="inline-flex min-h-touch cursor-pointer items-center rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  {bannerFile ? 'Replace banner' : 'Upload banner'}
                </label>
                {bannerFile ?
                  <button
                    type="button"
                    className="min-h-touch rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
                    onClick={() => setBannerFile(null)}
                  >
                    Remove
                  </button>
                : null}
              </div>
            </div>
            {error && step === 'basics' ?
              <FormStatusMessage tone="error">{error}</FormStatusMessage>
            : null}
          </div>
        </div>
      : null}

      {step === 'community' ?
        <div>
          <WizardStepHeader
            icon={gicon(STEP_ICONS.community)}
            eyebrow="Community"
            title={GROUP_COMMUNITY_HEADING}
            description={GROUP_COMMUNITY_INTRO}
          />
          <button
            type="button"
            onClick={() => {
              setShowRules((v) => !v)
              if (!showRules && rules.length === 0) setRules([emptyRule()])
            }}
            className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl border border-dc-border px-4 py-3 text-sm font-medium text-dc-text"
          >
            Add group rules
            <span className="text-xs text-dc-muted" aria-hidden>
              {showRules ? '▾' : '▸'}
            </span>
          </button>
          {showRules ?
            <div className="mt-3 space-y-3">
              <p className="text-xs text-dc-text-muted">
                Members accept these rules when joining. Keep language plain and actionable.
              </p>
              {rules.map((rule, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-dc-border p-3">
                  <WizardField
                    name={`grp-rule-title-${index}`}
                    label="Rule title"
                    value={rule.title}
                    onChange={(e) => updateRule(index, { title: e.target.value })}
                    placeholder="Rule title"
                    maxLength={200}
                  />
                  <label className="block text-sm font-medium text-dc-text">
                    Rule details
                    <textarea
                      value={rule.body}
                      onChange={(e) => updateRule(index, { body: e.target.value })}
                      placeholder="Rule details"
                      rows={3}
                      maxLength={5000}
                      className="mt-2 w-full resize-y rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted"
                    />
                  </label>
                  {rules.length > 1 ?
                    <button
                      type="button"
                      onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                      className="min-h-touch text-xs text-dc-muted hover:text-dc-text"
                    >
                      Remove rule
                    </button>
                  : null}
                </div>
              ))}
              {rules.length < 20 ?
                <button
                  type="button"
                  onClick={() => setRules((prev) => [...prev, emptyRule()])}
                  className="min-h-touch text-sm text-dc-accent hover:underline"
                >
                  Add another rule
                </button>
              : null}
            </div>
          : (
            <p className="mt-2 text-sm text-dc-text-muted">You can skip this step and add rules later from group settings.</p>
          )}
          {error && step === 'community' ?
            <FormStatusMessage tone="error">{error}</FormStatusMessage>
          : null}
        </div>
      : null}

      {step === 'launch' ?
        <div>
          <WizardStepHeader
            icon={gicon(STEP_ICONS.launch)}
            eyebrow="Launch"
            title={GROUP_LAUNCH_HEADING}
            description={GROUP_LAUNCH_INTRO}
          />
          <dl className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated-muted/40 p-4 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Name</dt>
              <dd className="font-medium text-dc-text">{name.trim() || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Purpose</dt>
              <dd className="font-medium text-dc-text">{category || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Visibility</dt>
              <dd className="font-medium text-dc-text">{VISIBILITY_LABELS[visibility]}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Banner</dt>
              <dd className="font-medium text-dc-text">{bannerLabel}</dd>
            </div>
            {tagsInput.trim() ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-dc-text-muted">Tags</dt>
                <dd className="text-dc-text">{tagsInput.trim()}</dd>
              </div>
            : null}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-dc-text-muted">Rules</dt>
              <dd className="font-medium text-dc-text">{activeRuleCount > 0 ? `${activeRuleCount} rule(s)` : 'None'}</dd>
            </div>
          </dl>
          {error ?
            <FormStatusMessage tone="error">{error}</FormStatusMessage>
          : null}
        </div>
      : null}
    </WizardShell>
  )
}
