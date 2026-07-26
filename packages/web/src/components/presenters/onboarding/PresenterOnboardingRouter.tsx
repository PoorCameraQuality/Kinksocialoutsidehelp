import { useCallback, useEffect, useMemo, useState } from 'react'
import { validatePresenterExternalUrl } from '@c2k/shared'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import PresenterTrackChooser from '@/components/presenters/onboarding/PresenterTrackChooser'
import OfferingCatalogStep, {
  AUTHOR_TALK_FORMATS,
  EDUCATOR_FORMAT_OPTIONS,
  PHOTO_FORMAT_OPTIONS,
  SPEAKER_FORMAT_OPTIONS,
  type OfferingDraft,
} from '@/components/presenters/onboarding/shared/OfferingCatalogStep'
import {
  OnboardingError,
  OnboardingShell,
  FieldInput,
  FieldTextarea,
  StepNav,
} from '@/components/presenters/onboarding/shared/OnboardingShell'
import ProfileBasicsStep from '@/components/presenters/onboarding/shared/ProfileBasicsStep'
import ReviewStep, { DoneStep } from '@/components/presenters/onboarding/shared/ReviewStep'
import VisibilityStep from '@/components/presenters/onboarding/shared/VisibilityStep'
import { useAuth } from '@/contexts/AuthContext'
import { useApiPresenterMe } from '@/hooks/useApiPresenterMe'
import { buildLoginHref } from '@/lib/auth-links'
import {
  HYBRID_FOCUS_OPTIONS,
  PHOTOGRAPHER_FOCUS_OPTIONS,
  profileKindFromFocuses,
  SPEAKER_FOCUS_OPTIONS,
  tagsFromCsv,
  type PresenterOnboardingTrack,
  type ProfileFocus,
} from '@/lib/presenter-focus'
import {
  defaultFocusesForTrack,
  initialPresenterOnboardingStep,
  inferTrackFromFocuses,
  stepsForTrack,
  trackFromQueryParam,
} from '@/lib/presenter-onboarding'

const emptyOffering = (): OfferingDraft => ({
  title: '',
  tease: '',
  outline: '',
  durationMinutes: '',
  level: '',
  format: '',
  tagsInput: '',
  isPublic: true,
})

function welcomeCopy(track: PresenterOnboardingTrack): { title: string; body: string } {
  switch (track) {
    case 'educator':
      return {
        title: 'Educator profile setup',
        body: 'Build a teaching profile and class catalog organizers can browse when planning programs.',
      }
    case 'speaker':
      return {
        title: 'Speaker profile setup',
        body: 'Set up talks, panels, demos, and session topics for event organizers.',
      }
    case 'author':
      return {
        title: 'Author profile setup',
        body: 'Create a writing profile and link your published work. Teaching catalog is optional.',
      }
    case 'photographer':
      return {
        title: 'Photographer profile setup',
        body: 'Build a portfolio and service profile with consent and delivery expectations.',
      }
    case 'hybrid':
      return {
        title: 'Hybrid professional profile',
        body: 'Combine the modules you need without repeating the same identity fields.',
      }
  }
}

function nextStep(track: PresenterOnboardingTrack | null, step: string, hybridFocuses: ProfileFocus[]): string {
  const steps = stepsForTrack(track, hybridFocuses)
  const idx = steps.indexOf(step)
  return steps[idx + 1] ?? 'done'
}

function prevStep(track: PresenterOnboardingTrack | null, step: string, hybridFocuses: ProfileFocus[]): string {
  const steps = stepsForTrack(track, hybridFocuses)
  const idx = steps.indexOf(step)
  return steps[Math.max(0, idx - 1)] ?? 'chooseTrack'
}

export default function PresenterOnboardingRouter() {
  const { status, isAuthenticated, viewerUsername } = useAuth()
  const [searchParams] = useSearchParams()
  const api = useApiPresenterMe(isAuthenticated)

  const [track, setTrack] = useState<PresenterOnboardingTrack | null>(trackFromQueryParam(searchParams.get('track')))
  const [step, setStep] = useState('chooseTrack')
  const [resumeApplied, setResumeApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [profileFocuses, setProfileFocuses] = useState<ProfileFocus[]>([])
  const [primaryProfileFocus, setPrimaryProfileFocus] = useState<ProfileFocus | null>(null)
  const [speakerFocusPick, setSpeakerFocusPick] = useState<ProfileFocus[]>(['PRESENTER'])
  const [photoFocusPick, setPhotoFocusPick] = useState<ProfileFocus>('PHOTOGRAPHER')
  const [hybridFocusPick, setHybridFocusPick] = useState<ProfileFocus[]>([])
  const [hybridPrimary, setHybridPrimary] = useState<ProfileFocus | null>(null)

  const [headline, setHeadline] = useState('')
  const [bioShort, setBioShort] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [bio, setBio] = useState('')
  const [backgroundStory, setBackgroundStory] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>('UNLISTED')
  const [mentorshipOffered, setMentorshipOffered] = useState(false)
  const [mentorshipNotes, setMentorshipNotes] = useState('')
  const [skillLabel, setSkillLabel] = useState('')

  const [links, setLinks] = useState<Record<string, string>>({})
  const [galleryUrl, setGalleryUrl] = useState('')
  const [galleryCaption, setGalleryCaption] = useState('')
  const [runnerMaterials, setRunnerMaterials] = useState<{ label: string; url: string }[]>([
    { label: '', url: '' },
  ])

  const [offering, setOffering] = useState<OfferingDraft>(emptyOffering())
  const [catalogSkipped, setCatalogSkipped] = useState(false)
  const [optionalTalksSkipped, setOptionalTalksSkipped] = useState(false)
  const [speakerTopicsFilled, setSpeakerTopicsFilled] = useState(false)
  const [portfolioSatisfied, setPortfolioSatisfied] = useState(false)

  const hybridFocuses = track === 'hybrid' ? profileFocuses : []

  const effectiveFocuses = useMemo(() => {
    if (track === 'hybrid') return profileFocuses
    if (track === 'speaker') return speakerFocusPick
    if (track === 'photographer') return [photoFocusPick]
    if (track) return defaultFocusesForTrack(track)
    return profileFocuses
  }, [track, profileFocuses, speakerFocusPick, photoFocusPick])

  const applyLoadedData = useCallback(() => {
    if (api.status !== 'ready') return
    const p = api.profile
    if (p) {
      setHeadline(p.headline ?? '')
      setBioShort(p.bioShort ?? '')
      setTagsInput((p.expertiseTags ?? []).join(', '))
      setBio(p.bio ?? '')
      setBackgroundStory(p.backgroundStory ?? '')
      setVisibility(p.directoryVisibility ?? 'UNLISTED')
      setMentorshipOffered(p.mentorshipOffered ?? false)
      setMentorshipNotes(p.mentorshipNotes ?? '')
      setLinks(p.links ?? {})
    }
    if (api.profileFocuses.length) {
      setProfileFocuses(api.profileFocuses)
      setPrimaryProfileFocus(api.primaryProfileFocus)
      if (!track) setTrack(inferTrackFromFocuses(api.profileFocuses))
    }
    if (!resumeApplied) {
      const resumeTrack = track ?? inferTrackFromFocuses(api.profileFocuses)
      const hasPortfolio =
        api.gallery.length > 0 ||
        Object.values(p?.links ?? {}).some((v) => /portfolio|website|writing/i.test(v))
      setStep(
        initialPresenterOnboardingStep({
          track: resumeTrack,
          profileFocuses: api.profileFocuses,
          primaryProfileFocus: api.primaryProfileFocus,
          profile: p,
          offeringCount: api.offerings.length,
          galleryCount: api.gallery.length,
          skillClaimCount: api.skillClaims.length,
          catalogSkipped,
          optionalTalksSkipped,
          speakerTopicsFilled,
          portfolioSatisfied: portfolioSatisfied || hasPortfolio,
        })
      )
      setResumeApplied(true)
    }
  }, [
    api.status,
    api.profile,
    api.profileFocuses,
    api.primaryProfileFocus,
    api.offerings.length,
    api.gallery.length,
    api.skillClaims.length,
    track,
    resumeApplied,
    catalogSkipped,
    optionalTalksSkipped,
    speakerTopicsFilled,
    portfolioSatisfied,
  ])

  useEffect(() => {
    applyLoadedData()
  }, [applyLoadedData])

  const saveCoreProfile = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      setSaving(true)
      setError(null)
      try {
        const focuses = effectiveFocuses.length ? effectiveFocuses : defaultFocusesForTrack(track ?? 'educator')
        const primary = primaryProfileFocus ?? focuses[0] ?? null
        await api.saveProfile({
          headline: headline.trim() || null,
          bioShort: bioShort.trim() || null,
          bio: bio.trim() || null,
          backgroundStory: backgroundStory.trim() || null,
          expertiseTags: tagsFromCsv(tagsInput),
          directoryVisibility: visibility,
          profileKind: profileKindFromFocuses(focuses),
          links,
          mentorshipOffered,
          mentorshipNotes: mentorshipNotes.trim() || null,
          profileFocuses: focuses,
          primaryProfileFocus: primary,
          ...extra,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save profile')
        throw e
      } finally {
        setSaving(false)
      }
    },
    [
      api,
      effectiveFocuses,
      track,
      primaryProfileFocus,
      headline,
      bioShort,
      bio,
      backgroundStory,
      tagsInput,
      visibility,
      links,
      mentorshipOffered,
      mentorshipNotes,
    ]
  )

  const saveOfferingFromDraft = useCallback(async () => {
    if (!offering.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.createOffering({
        title: offering.title.trim(),
        tease: offering.tease.trim() || null,
        outline: offering.outline.trim() || null,
        durationMinutes: offering.durationMinutes ? Number(offering.durationMinutes) : null,
        level: offering.level.trim() || null,
        format: offering.format || null,
        tags: tagsFromCsv(offering.tagsInput),
        isPublic: offering.isPublic,
        runnerMaterials: runnerMaterials.filter((m) => m.label.trim() && m.url.trim()),
      })
      setOffering(emptyOffering())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save offering')
      throw e
    } finally {
      setSaving(false)
    }
  }, [api, offering, runnerMaterials])

  const saveGalleryUrl = useCallback(async () => {
    if (!galleryUrl.trim()) return
    const validated = validatePresenterExternalUrl(galleryUrl)
    if (!validated.ok) {
      setError(validated.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.createGalleryImage({ imageUrl: validated.href, caption: galleryCaption.trim() || null })
      setGalleryUrl('')
      setGalleryCaption('')
      setPortfolioSatisfied(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add gallery image')
      throw e
    } finally {
      setSaving(false)
    }
  }, [api, galleryUrl, galleryCaption])

  if (status === 'loading' || api.status === 'loading') {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-dc-muted">Loading…</div>
  }

  if (!isAuthenticated) {
    const q = track ? `?track=${track}` : ''
    return <Navigate to={buildLoginHref(`/presenters/onboarding${q}`)} replace />
  }

  const goNext = () => setStep(nextStep(track, step, hybridFocuses))
  const goBack = () => setStep(prevStep(track, step, hybridFocuses))

  const welcome = track ? welcomeCopy(track) : null

  return (
    <>
      <Link
        to="/presenters"
        className="mx-auto block max-w-5xl px-4 pt-6 text-sm text-dc-accent hover:underline sm:px-6 lg:px-8"
      >
        ← Community professionals directory
      </Link>

      <OnboardingShell
        track={track}
        step={step}
        hybridFocuses={hybridFocuses}
        onStepSelect={(id) => setStep(id)}
      >
        <OnboardingError message={error} />

          {step === 'chooseTrack' ?
            <PresenterTrackChooser
              selected={track}
              onSelect={setTrack}
              onContinue={() => {
                if (!track) return
                if (track === 'hybrid') setStep('hybridFocusPick')
                else {
                  const focuses = defaultFocusesForTrack(track)
                  setProfileFocuses(focuses)
                  setPrimaryProfileFocus(focuses[0] ?? null)
                  setStep('welcome')
                }
              }}
            />
          : null}

          {step === 'hybridFocusPick' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Which focuses apply to you?</h2>
              <p className="text-sm text-dc-text-muted">Select all that apply, then choose your primary focus.</p>
              <div className="space-y-2">
                {HYBRID_FOCUS_OPTIONS.map((opt) => {
                  const checked = hybridFocusPick.includes(opt.focus)
                  return (
                    <label key={opt.focus} className="flex items-center gap-2 rounded-lg border border-dc-border p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setHybridFocusPick((prev) =>
                            checked ? prev.filter((f) => f !== opt.focus) : [...prev, opt.focus]
                          )
                        }}
                      />
                      <span className="text-sm text-dc-text">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
              {hybridFocusPick.length > 0 ?
                <div>
                  <label htmlFor="hybrid-primary" className="block text-sm font-medium text-dc-text">
                    Primary focus
                  </label>
                  <select
                    id="hybrid-primary"
                    value={hybridPrimary ?? hybridFocusPick[0]}
                    onChange={(e) => setHybridPrimary(e.target.value as ProfileFocus)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm"
                  >
                    {hybridFocusPick.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              : null}
              <StepNav
                onBack={() => setStep('chooseTrack')}
                onNext={() => {
                  if (hybridFocusPick.length === 0) {
                    setError('Select at least one focus.')
                    return
                  }
                  const primary = hybridPrimary ?? hybridFocusPick[0]
                  setProfileFocuses(hybridFocusPick)
                  setPrimaryProfileFocus(primary)
                  setStep('welcome')
                }}
                nextDisabled={hybridFocusPick.length === 0}
              />
            </div>
          : null}

          {step === 'welcome' && track && welcome ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">{welcome.title}</h2>
              <p className="text-sm text-dc-text-muted">{welcome.body}</p>
              <StepNav onBack={() => setStep(track === 'hybrid' ? 'hybridFocusPick' : 'chooseTrack')} onNext={goNext} />
            </div>
          : null}

          {step === 'basics' ?
            <ProfileBasicsStep
              headline={headline}
              bioShort={bioShort}
              tagsInput={tagsInput}
              onHeadline={setHeadline}
              onBioShort={setBioShort}
              onTagsInput={setTagsInput}
              identityLabel={
                track === 'author' ? 'Writing identity'
                : track === 'photographer' ? 'Media identity'
                : track === 'speaker' ? 'Speaking identity'
                : 'Teaching identity'
              }
              onBack={goBack}
              onContinue={async () => {
                try {
                  await saveCoreProfile()
                  goNext()
                } catch {
                  /* error set */
                }
              }}
              saving={saving}
            />
          : null}

          {step === 'visibility' ?
            <VisibilityStep
              visibility={visibility}
              onVisibility={setVisibility}
              onBack={goBack}
              onContinue={async () => {
                try {
                  await saveCoreProfile()
                  goNext()
                } catch {
                  /* error set */
                }
              }}
              saving={saving}
            />
          : null}

          {step === 'teachingStyle' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Teaching style and audience</h2>
              <FieldTextarea id="bio-full" label="Full bio" value={bio} onChange={setBio} rows={4} />
              <FieldTextarea
                id="bg-story"
                label="Background story"
                value={backgroundStory}
                onChange={setBackgroundStory}
                rows={3}
              />
              <FieldTextarea
                id="teaching-approach"
                label="Teaching approach"
                value={backgroundStory}
                onChange={setBackgroundStory}
                rows={2}
                helper="Describe how you teach, prerequisites, and accessibility notes."
              />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'catalog' || step === 'sessionCatalog' || step === 'services' ?
            <OfferingCatalogStep
              heading={
                step === 'services' ? 'Services and coverage'
                : step === 'sessionCatalog' ? 'Session catalog'
                : 'Class catalog'
              }
              intro={
                step === 'services' ?
                  'Describe photography or media services you offer. These are ideas — not confirmed bookings.'
                : step === 'sessionCatalog' ?
                  'Add session ideas organizers can review. These are not confirmed program slots.'
                : 'At least one class is strongly recommended. Organizers use offerings when building programs.'
              }
              titleLabel={step === 'services' ? 'Service title' : step === 'sessionCatalog' ? 'Talk title' : 'Class title'}
              draft={offering}
              onDraft={(patch) => setOffering((o) => ({ ...o, ...patch }))}
              formatOptions={
                step === 'services' ? PHOTO_FORMAT_OPTIONS
                : step === 'sessionCatalog' ? SPEAKER_FORMAT_OPTIONS
                : EDUCATOR_FORMAT_OPTIONS
              }
              onBack={goBack}
              onContinue={async () => {
                try {
                  if (offering.title.trim()) await saveOfferingFromDraft()
                  setCatalogSkipped(false)
                  goNext()
                } catch {
                  /* */
                }
              }}
              onSkip={() => {
                setCatalogSkipped(true)
                goNext()
              }}
              saving={saving}
            />
          : null}

          {step === 'topicsFormats' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Topics and formats</h2>
              <p className="text-sm text-dc-text-muted">What do you speak on, and in what formats?</p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-dc-text">Speaking roles</p>
                {SPEAKER_FOCUS_OPTIONS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={speakerFocusPick.includes(f)}
                      onChange={() => {
                        setSpeakerFocusPick((prev) =>
                          prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                        )
                      }}
                    />
                    {f.replace('_', ' ')}
                  </label>
                ))}
              </div>
              <FieldTextarea
                id="topics"
                label="Topics you speak on"
                value={bio}
                onChange={setBio}
                rows={3}
              />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  if (speakerFocusPick.length === 0) {
                    setError('Select at least one speaking role.')
                    return
                  }
                  setSpeakerTopicsFilled(true)
                  setProfileFocuses(speakerFocusPick)
                  setPrimaryProfileFocus(speakerFocusPick[0])
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'organizerMaterials' || step === 'logistics' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">
                {step === 'logistics' ? 'Logistics and organizer notes' : 'Organizer materials'}
              </h2>
              <p className="text-sm text-dc-text-muted">
                These materials are not public. They are visible only to you and eligible organizers after a program
                relationship exists.
              </p>
              {runnerMaterials.map((m, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <FieldInput
                    id={`rm-label-${i}`}
                    label="Label"
                    value={m.label}
                    onChange={(v) => {
                      const next = [...runnerMaterials]
                      next[i] = { ...next[i], label: v }
                      setRunnerMaterials(next)
                    }}
                    placeholder="Handout"
                  />
                  <FieldInput
                    id={`rm-url-${i}`}
                    label="URL"
                    value={m.url}
                    onChange={(v) => {
                      const next = [...runnerMaterials]
                      next[i] = { ...next[i], url: v }
                      setRunnerMaterials(next)
                    }}
                    placeholder="https://"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRunnerMaterials((r) => [...r, { label: '', url: '' }])}
                className="text-sm text-dc-accent hover:underline"
              >
                Add another material
              </button>
              <FieldTextarea
                id="logistics-notes"
                label="Additional notes"
                value={backgroundStory}
                onChange={setBackgroundStory}
                rows={3}
                helper="AV needs, room setup, accessibility, co-presenter needs, content warnings."
              />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'skillsMentorship' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Skills and mentorship</h2>
              <FieldInput
                id="skill-label"
                label="Skill or experience claim"
                value={skillLabel}
                onChange={setSkillLabel}
                placeholder="Negotiation facilitation"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mentorshipOffered}
                  onChange={(e) => setMentorshipOffered(e.target.checked)}
                />
                I offer mentorship
              </label>
              {mentorshipOffered ?
                <FieldTextarea
                  id="mentorship-notes"
                  label="Mentorship notes"
                  value={mentorshipNotes}
                  onChange={setMentorshipNotes}
                  rows={2}
                />
              : null}
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    if (skillLabel.trim()) {
                      await api.createSkillClaim({ skillLabel: skillLabel.trim() })
                    }
                    goNext()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not save')
                  }
                }}
                saving={saving}
                secondaryAction={
                  <button
                    type="button"
                    onClick={goNext}
                    className="w-full sm:flex-1 min-h-11 py-3 rounded-xl border border-dc-border text-dc-text-muted hover:text-dc-text font-medium"
                  >
                    Skip for now
                  </button>
                }
              />
            </div>
          : null}

          {step === 'linksGallery' || step === 'linksMedia' || step === 'links' || step === 'media' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Links{step === 'linksGallery' ? ' and gallery' : ''}</h2>
              {['Website', 'Portfolio', 'Social', 'Newsletter'].map((key) => (
                <FieldInput
                  key={key}
                  id={`link-${key}`}
                  label={key}
                  value={links[key] ?? ''}
                  onChange={(v) => setLinks((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
              {step === 'linksGallery' || step === 'media' ?
                <>
                  <FieldInput
                    id="gallery-url"
                    label="Gallery image URL"
                    value={galleryUrl}
                    onChange={setGalleryUrl}
                    placeholder="https://"
                    helper="Paste a URL to an image you already host elsewhere."
                  />
                  <FieldInput
                    id="gallery-cap"
                    label="Caption"
                    value={galleryCaption}
                    onChange={setGalleryCaption}
                  />
                </>
              : null}
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    if (galleryUrl.trim()) await saveGalleryUrl()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'writingFocus' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Writing focus</h2>
              <FieldTextarea id="author-bio" label="Full bio" value={bio} onChange={setBio} rows={4} />
              <FieldTextarea
                id="author-bg"
                label="Background story"
                value={backgroundStory}
                onChange={setBackgroundStory}
                rows={3}
                helper="Topics covered, writing style, audience, and subject matter boundaries."
              />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'publicationsLinks' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Publications and links</h2>
              {[
                'Website',
                'Writing portfolio',
                'Published articles',
                'Newsletter',
                'Media',
                'Social',
              ].map((key) => (
                <FieldInput
                  key={key}
                  id={`pub-${key}`}
                  label={key}
                  value={links[key] ?? ''}
                  onChange={(v) => setLinks((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'optionalTalks' ?
            <OfferingCatalogStep
              heading="Optional talks or readings"
              intro="Only add these if you want to offer readings, lectures, or author events. This is optional."
              titleLabel="Session title"
              draft={offering}
              onDraft={(patch) => setOffering((o) => ({ ...o, ...patch }))}
              formatOptions={AUTHOR_TALK_FORMATS}
              onBack={goBack}
              onContinue={async () => {
                try {
                  if (offering.title.trim()) await saveOfferingFromDraft()
                  goNext()
                } catch {
                  /* */
                }
              }}
              onSkip={() => {
                setOptionalTalksSkipped(true)
                goNext()
              }}
              saving={saving}
            />
          : null}

          {step === 'portfolioGallery' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Portfolio and gallery</h2>
              <p className="text-sm text-dc-text-muted">
                Add at least one gallery image URL or a portfolio link to continue.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-dc-text">Media creator type</p>
                {PHOTOGRAPHER_FOCUS_OPTIONS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="photo-focus"
                      checked={photoFocusPick === f}
                      onChange={() => setPhotoFocusPick(f)}
                    />
                    {f.replace('_', ' ')}
                  </label>
                ))}
              </div>
              <FieldInput
                id="portfolio-link"
                label="Portfolio link"
                value={links.Portfolio ?? links.portfolio ?? ''}
                onChange={(v) => setLinks((prev) => ({ ...prev, Portfolio: v }))}
              />
              <FieldInput
                id="pg-url"
                label="Gallery image URL"
                value={galleryUrl}
                onChange={setGalleryUrl}
                placeholder="https://"
              />
              <FieldInput id="pg-cap" label="Caption" value={galleryCaption} onChange={setGalleryCaption} />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  const portfolioRaw = (links.Portfolio ?? links.portfolio ?? '').trim()
                  const portfolioValid = portfolioRaw ? validatePresenterExternalUrl(portfolioRaw) : null
                  const hasLink = portfolioValid?.ok === true
                  const hasGallery = Boolean(galleryUrl.trim()) || api.gallery.length > 0
                  if (!hasLink && !hasGallery) {
                    setError('Add a gallery image URL or portfolio link.')
                    return
                  }
                  if (portfolioRaw && !hasLink) {
                    setError(portfolioValid && !portfolioValid.ok ? portfolioValid.error : 'Portfolio link must be a valid HTTPS URL.')
                    return
                  }
                  if (galleryUrl.trim()) {
                    const galleryValid = validatePresenterExternalUrl(galleryUrl)
                    if (!galleryValid.ok) {
                      setError(galleryValid.error)
                      return
                    }
                  }
                  try {
                    setProfileFocuses([photoFocusPick])
                    setPrimaryProfileFocus(photoFocusPick)
                    const nextLinks =
                      portfolioValid?.ok ?
                        { ...links, Portfolio: portfolioValid.href }
                      : links
                    if (portfolioValid?.ok) setLinks(nextLinks)
                    await saveCoreProfile({
                      profileFocuses: [photoFocusPick],
                      primaryProfileFocus: photoFocusPick,
                      links: nextLinks,
                    })
                    if (galleryUrl.trim()) await saveGalleryUrl()
                    setPortfolioSatisfied(true)
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {step === 'consentPrivacyDelivery' ?
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-dc-text">Consent, privacy, and delivery</h2>
              <FieldTextarea
                id="consent-approach"
                label="Consent approach"
                value={bio}
                onChange={setBio}
                rows={3}
                helper="How you obtain consent, public posting policy, delivery expectations, editing style, watermark policy, and takedown requests."
              />
              <FieldTextarea
                id="boundaries"
                label="Boundaries on explicit or sensitive imagery"
                value={backgroundStory}
                onChange={setBackgroundStory}
                rows={3}
              />
              <StepNav
                onBack={goBack}
                onNext={async () => {
                  try {
                    await saveCoreProfile()
                    goNext()
                  } catch {
                    /* */
                  }
                }}
                saving={saving}
              />
            </div>
          : null}

          {(step === 'educatorModule' || step === 'speakerModule' || step === 'authorModule' || step === 'photoModule') ?
            <OfferingCatalogStep
              heading={
                step === 'educatorModule' ? 'Teaching catalog'
                : step === 'speakerModule' ? 'Sessions and talks'
                : step === 'authorModule' ? 'Writing and optional talks'
                : 'Portfolio services'
              }
              intro="Add catalog entries for this part of your hybrid profile. You can add more later in settings."
              titleLabel="Title"
              draft={offering}
              onDraft={(patch) => setOffering((o) => ({ ...o, ...patch }))}
              formatOptions={
                step === 'photoModule' ? PHOTO_FORMAT_OPTIONS
                : step === 'speakerModule' ? SPEAKER_FORMAT_OPTIONS
                : step === 'authorModule' ? AUTHOR_TALK_FORMATS
                : EDUCATOR_FORMAT_OPTIONS
              }
              onBack={goBack}
              onContinue={async () => {
                try {
                  if (offering.title.trim()) await saveOfferingFromDraft()
                  if (step === 'photoModule' && galleryUrl.trim()) await saveGalleryUrl()
                  goNext()
                } catch {
                  /* */
                }
              }}
              onSkip={goNext}
              saving={saving}
            />
          : null}

          {step === 'review' && track ?
            <ReviewStep
              track={track}
              profileFocuses={effectiveFocuses}
              primaryProfileFocus={primaryProfileFocus}
              headline={headline}
              visibility={visibility}
              offeringCount={api.offerings.length}
              galleryCount={api.gallery.length}
              onBack={goBack}
              onContinue={async () => {
                try {
                  await saveCoreProfile()
                  setStep('done')
                } catch {
                  /* */
                }
              }}
            />
          : null}

          {step === 'done' && track ?
            <DoneStep track={track} profileFocuses={effectiveFocuses} viewerUsername={viewerUsername} />
          : null}
      </OnboardingShell>
    </>
  )
}
