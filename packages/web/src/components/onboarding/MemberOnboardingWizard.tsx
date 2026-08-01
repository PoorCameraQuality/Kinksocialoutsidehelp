import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  clampOnboardingStep,
  ONBOARDING_FLOW_VERSION,
  ONBOARDING_STEP_COUNT,
  type PrivacySettings,
} from '@c2k/shared'
import { useAuth } from '@/contexts/AuthContext'
import { useAppToast } from '@/components/ui/AppToast'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { buildLoginHref, coercePostAuthPath } from '@/lib/auth-links'
import { orderOnboardingFirstSteps } from '@/lib/onboarding-first-steps'
import type { ZipPlaceCandidate } from '@/lib/profile-edit-location'
import {
  FormStatusMessage,
  PageShell,
  WizardFooter,
  WizardShell,
  type WizardStepMeta,
} from '@/components/ui/primitives'
import { SettingsPageSkeleton } from '@/components/ui/skeleton'
import { ALPHA_UPLOAD_DISABLED_COPY } from '@/lib/alpha-mode'
import { attachUploadedProfilePhoto, uploadProfilePhotoFile } from '@/lib/profile-photo-upload'
import WelcomeStep from './steps/WelcomeStep'
import AgeAttestationStep from './steps/AgeAttestationStep'
import EmailVerifyStep from './steps/EmailVerifyStep'
import PhotoStep from './steps/PhotoStep'
import AboutYouStep from './steps/AboutYouStep'
import KinksStep from './steps/KinksStep'
import DetailsStep from './steps/DetailsStep'
import PrivacyStep from './steps/PrivacyStep'
import InterestsStep from './steps/InterestsStep'
import GalleryStep from './steps/GalleryStep'
import FirstStepsStep from './steps/FirstStepsStep'

const icon = (path: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
  </svg>
)

const STEPS: WizardStepMeta[] = [
  { id: 'welcome', label: 'Welcome', icon: icon('M5 3v4M3 5h4m6-2l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z') },
  { id: 'age', label: 'Age', icon: icon('M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z') },
  { id: 'email', label: 'Email', icon: icon('M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z') },
  { id: 'photo', label: 'Photo', icon: icon('M3 8h4l2-3h6l2 3h4v11H3V8z') },
  { id: 'about', label: 'About', icon: icon('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z') },
  { id: 'kinks', label: 'Kinks', icon: icon('M7 7h.01M3 11l8.5-8.5a2 2 0 012.8 0L21 9.2a2 2 0 010 2.8L12.5 20.5a2 2 0 01-2.8 0L3 14V11z') },
  { id: 'details', label: 'Details', icon: icon('M4 6h16M4 12h10M4 18h14') },
  { id: 'privacy', label: 'Privacy', icon: icon('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z') },
  { id: 'intents', label: 'Goals', icon: icon('M15.5 8.5l-2 5-5 2 2-5 5-2z') },
  { id: 'gallery', label: 'Gallery', icon: icon('M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z') },
  { id: 'firstSteps', label: 'First steps', icon: icon('M5 13l4 4L19 7') },
]

const STEP_IDS = STEPS.map((s) => s.id)

export default function MemberOnboardingWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = coercePostAuthPath(searchParams.get('redirect'))
  const { isAuthenticated, isFallback, viewerUsername, viewerDisplayName } = useAuth()
  const { loading, error, feed, privacy, setPrivacy, saving, save } = useOnboardingState(isAuthenticated && !isFallback)
  const toast = useAppToast()

  const [step, setStep] = useState(1)
  const [ageChecked, setAgeChecked] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [homeZip, setHomeZip] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)
  const [locationDisplay, setLocationDisplay] = useState('')
  const [zipCandidates, setZipCandidates] = useState<ZipPlaceCandidate[]>([])
  const [zipLocality, setZipLocality] = useState<string | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [stateId, setStateId] = useState<string | null>(null)
  const [genders, setGenders] = useState<string[]>([])
  const [orientations, setOrientations] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [kinkIds, setKinkIds] = useState<string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState<string | null>(null)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryMessage, setGalleryMessage] = useState<string | null>(null)

  const onEmailVerified = useCallback(() => setEmailVerified(true), [])

  useEffect(() => {
    if (feed.onboardingStep) setStep(clampOnboardingStep(feed.onboardingStep))
    if (feed.onboardingSafetyAckAt) setAgeChecked(true)
  }, [feed.onboardingStep, feed.onboardingSafetyAckAt])

  useEffect(() => {
    if (!viewerUsername) return
    let cancelled = false
    void (async () => {
      try {
        const [profileRes, kinksRes] = await Promise.all([
          fetch('/api/profile/me', { credentials: 'include' }),
          fetch('/api/profile/me/kinks', { credentials: 'include' }),
        ])
        if (cancelled) return
        if (profileRes.ok) {
          const data = (await profileRes.json()) as {
            profile?: {
              displayName?: string | null
              bio?: string | null
              homeZip?: string | null
              location?: string | null
              genders?: string[]
              sexualOrientations?: string[]
              roles?: string[]
            }
          }
          const p = data.profile
          if (p) {
            setDisplayName(p.displayName ?? viewerDisplayName ?? '')
            setBio(p.bio ?? '')
            if (p.homeZip) setHomeZip(p.homeZip)
            if (p.location) setLocationDisplay(p.location)
            if (p.genders?.length) setGenders(p.genders)
            if (p.sexualOrientations?.length) setOrientations(p.sexualOrientations)
            if (p.roles?.length) setRoles(p.roles)
          }
        }
        if (kinksRes.ok) {
          const kj = (await kinksRes.json()) as { kinks?: Array<{ kinkTagId: string }> }
          if (Array.isArray(kj.kinks)) setKinkIds(kj.kinks.map((k) => k.kinkTagId))
        }
      } catch {
        /* optional preload */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viewerUsername, viewerDisplayName])

  const intents = useMemo(() => new Set(feed.onboardingIntents ?? []), [feed.onboardingIntents])
  const orderedFirstSteps = useMemo(() => orderOnboardingFirstSteps(intents), [intents])

  if (!isAuthenticated || isFallback) {
    return <Navigate to={buildLoginHref('/onboarding')} replace />
  }

  if (loading) {
    return (
      <PageShell title="Getting started">
        <SettingsPageSkeleton />
      </PageShell>
    )
  }

  if (feed.onboardingCompletedAt) {
    return <Navigate to={redirect} replace />
  }

  async function goTo(nextStep: number, patch: Parameters<typeof save>[0] = {}) {
    setLocalError(null)
    const ok = await save({
      feed: {
        onboardingFlowVersion: ONBOARDING_FLOW_VERSION,
        ...patch.feed,
        onboardingStep: nextStep,
      },
      privacy: patch.privacy,
    })
    if (ok) setStep(nextStep)
  }

  async function finishOnboarding(destination?: string) {
    const now = new Date().toISOString()
    const ok = await save({
      feed: {
        onboardingCompletedAt: now,
        onboardingStep: ONBOARDING_STEP_COUNT,
        onboardingFlowVersion: ONBOARDING_FLOW_VERSION,
        startHereDismissedAt: null,
      },
    })
    if (ok) {
      toast.push('Welcome to kink.social.')
      navigate(destination ?? redirect, { replace: true })
    }
  }

  function selectZipCandidate(candidatePlaceId: string) {
    const hit = zipCandidates.find((c) => c.placeId === candidatePlaceId)
    if (!hit) return
    setPlaceId(candidatePlaceId)
    setLocationDisplay(hit.display)
  }

  async function lookupZip() {
    const zip = homeZip.replace(/\D/g, '').slice(0, 5)
    if (zip.length < 5) {
      setZipError('Enter a 5-digit ZIP.')
      return
    }
    setZipError(null)
    setZipCandidates([])
    setZipLocality(null)
    setPlaceId(null)
    setLocationDisplay('')
    try {
      const r = await fetch(`/api/locations/by-zip?zip=${encodeURIComponent(zip)}`, { credentials: 'include' })
      const data = (await r.json().catch(() => ({}))) as {
        error?: string
        stateId?: string
        zipLocality?: string
        candidates?: ZipPlaceCandidate[]
      }
      if (!r.ok) {
        setZipError(data.error ?? 'ZIP not found.')
        return
      }
      setZipCandidates(data.candidates ?? [])
      setZipLocality(data.zipLocality ?? null)
      setStateId(data.stateId ?? null)
      setHomeZip(zip)
    } catch {
      setZipError('Could not look up ZIP. Try again.')
    }
  }

  async function saveAboutYou() {
    setLocalError(null)
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      }
      const zip = homeZip.replace(/\D/g, '').slice(0, 5)
      if (zip.length >= 5) body.homeZip = zip
      if (placeId) body.placeId = placeId
      if (stateId) body.stateId = stateId

      const r = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        setLocalError(typeof data.error === 'string' ? data.error : 'Could not save profile.')
        return false
      }
      return true
    } catch {
      setLocalError('Network error while saving profile.')
      return false
    }
  }

  async function saveDetails() {
    setLocalError(null)
    try {
      const r = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genders,
          sexualOrientations: orientations,
          roles,
        }),
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        setLocalError(typeof data.error === 'string' ? data.error : 'Could not save details.')
        return false
      }
      return true
    } catch {
      setLocalError('Network error while saving details.')
      return false
    }
  }

  async function saveKinks() {
    setLocalError(null)
    try {
      const r = await fetch('/api/profile/me/kinks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(kinkIds.map((kinkTagId) => ({ kinkTagId, interestStatus: 'into' as const }))),
      })
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string }
        setLocalError(typeof data.error === 'string' ? data.error : 'Could not save kinks.')
        return false
      }
      return true
    } catch {
      setLocalError('Network error while saving kinks.')
      return false
    }
  }

  async function handleProfilePhoto(file: File | null) {
    if (!file) return
    setPhotoUploading(true)
    setPhotoMessage(null)
    try {
      const uploaded = await uploadProfilePhotoFile(file)
      if (!uploaded.url && !uploaded.quarantineKey) {
        setPhotoMessage(uploaded.code === 'alpha_upload_disabled' ? ALPHA_UPLOAD_DISABLED_COPY : (uploaded.error ?? 'Upload failed.'))
        return
      }
      const attached = await attachUploadedProfilePhoto(uploaded)
      if (!attached.ok) {
        setPhotoMessage(attached.code === 'alpha_upload_disabled' ? ALPHA_UPLOAD_DISABLED_COPY : attached.error)
        return
      }
      setPhotoMessage(
        attached.outcome === 'pending_review'
          ? (attached.message ?? 'Profile photo saved — under review.')
          : (attached.message ?? 'Profile photo saved.'),
      )
    } catch {
      setPhotoMessage('Upload failed. Try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleGalleryFiles(files: FileList | null) {
    if (!files?.length) return
    setGalleryUploading(true)
    setGalleryMessage(null)
    let okCount = 0
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadProfilePhotoFile(file)
        if (!uploaded.url && !uploaded.quarantineKey) continue
        const attached = await attachUploadedProfilePhoto(uploaded)
        if (attached.ok) okCount += 1
      }
      setGalleryMessage(okCount > 0 ? `Added ${okCount} photo${okCount === 1 ? '' : 's'}.` : 'Upload failed. Try again.')
    } catch {
      setGalleryMessage('Upload failed. Try again.')
    } finally {
      setGalleryUploading(false)
    }
  }

  function toggleIntent(id: string) {
    const next = new Set(intents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void save({ feed: { onboardingIntents: [...next], onboardingFlowVersion: ONBOARDING_FLOW_VERSION } })
  }

  const currentStepId = STEP_IDS[step - 1] ?? 'welcome'

  const footer = (() => {
    const back = (prev: number) => ({ label: 'Back', onClick: () => setStep(prev) })
    switch (step) {
      case 1:
        return <WizardFooter next={{ label: 'Continue', loading: saving, onClick: () => void goTo(2) }} />
      case 2:
        return (
          <WizardFooter
            back={back(1)}
            next={{
              label: 'Agree and continue',
              loading: saving,
              disabled: !ageChecked,
              onClick: () => void goTo(3, { feed: { onboardingSafetyAckAt: new Date().toISOString() } }),
            }}
          />
        )
      case 3:
        return (
          <WizardFooter
            back={back(2)}
            skip={{
              label: 'Skip for now',
              onClick: () =>
                void goTo(4, { feed: { emailVerificationSkippedAt: new Date().toISOString() } }),
            }}
            next={{
              label: emailVerified ? 'Continue' : 'Continue',
              loading: saving,
              onClick: () => void goTo(4),
            }}
          />
        )
      case 4:
        return (
          <WizardFooter
            back={back(3)}
            skip={{ label: 'Skip for now', onClick: () => void goTo(5) }}
            next={{ label: 'Continue', loading: saving, onClick: () => void goTo(5) }}
          />
        )
      case 5:
        return (
          <WizardFooter
            back={back(4)}
            skip={{
              label: 'Skip for now',
              onClick: () => void goTo(6),
            }}
            next={{
              label: 'Continue',
              loading: saving,
              onClick: () =>
                void (async () => {
                  const ok = await saveAboutYou()
                  if (ok) await goTo(6)
                })(),
            }}
          />
        )
      case 6:
        return (
          <WizardFooter
            back={back(5)}
            skip={{ label: 'Skip for now', onClick: () => void goTo(7) }}
            next={{
              label: 'Continue',
              loading: saving,
              onClick: () =>
                void (async () => {
                  const ok = await saveKinks()
                  if (ok) await goTo(7)
                })(),
            }}
          />
        )
      case 7:
        return (
          <WizardFooter
            back={back(6)}
            skip={{ label: 'Skip for now', onClick: () => void goTo(8) }}
            next={{
              label: 'Continue',
              loading: saving,
              onClick: () =>
                void (async () => {
                  const ok = await saveDetails()
                  if (ok) await goTo(8)
                })(),
            }}
          />
        )
      case 8:
        return (
          <WizardFooter
            back={back(7)}
            next={{ label: 'Save and continue', loading: saving, onClick: () => void goTo(9, { privacy }) }}
          />
        )
      case 9:
        return (
          <WizardFooter
            back={back(8)}
            next={{ label: 'Continue', loading: saving, onClick: () => void goTo(10) }}
          />
        )
      case 10:
        return (
          <WizardFooter
            back={back(9)}
            skip={{ label: 'Skip for now', onClick: () => void goTo(11) }}
            next={{ label: 'Continue', loading: saving, onClick: () => void goTo(11) }}
          />
        )
      case 11:
        return (
          <WizardFooter
            back={back(10)}
            next={{ label: 'Enter kink.social', loading: saving, onClick: () => void finishOnboarding() }}
          />
        )
      default:
        return null
    }
  })()

  return (
    <WizardShell
      brand="kink.social"
      title="Let’s get you set up"
      description="A short, private setup. Skip anything optional and share more whenever you are ready."
      steps={STEPS}
      currentStepId={currentStepId}
      onStepSelect={(id) => setStep(STEP_IDS.indexOf(id) + 1)}
      footer={footer}
    >
      {error || localError ? (
        <div className="mb-5">
          <FormStatusMessage tone="error">{error ?? localError}</FormStatusMessage>
        </div>
      ) : null}

      {step === 1 ? <WelcomeStep /> : null}
      {step === 2 ? <AgeAttestationStep checked={ageChecked} onCheckedChange={setAgeChecked} /> : null}
      {step === 3 ? <EmailVerifyStep onVerified={onEmailVerified} /> : null}
      {step === 4 ? (
        <PhotoStep
          photoUploading={photoUploading}
          photoMessage={photoMessage}
          onPhotoChange={(file) => void handleProfilePhoto(file)}
        />
      ) : null}
      {step === 5 ? (
        <AboutYouStep
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          bio={bio}
          onBioChange={setBio}
          homeZip={homeZip}
          onHomeZipChange={(value) => {
            setHomeZip(value)
            setZipCandidates([])
            setZipLocality(null)
            setPlaceId(null)
            setLocationDisplay('')
            setZipError(null)
          }}
          onHomeZipBlur={() => {
            if (homeZip.replace(/\D/g, '').length >= 5) void lookupZip()
          }}
          onLookupZip={() => void lookupZip()}
          zipError={zipError}
          zipCandidates={zipCandidates}
          zipLocality={zipLocality}
          placeId={placeId}
          onSelectZipCandidate={selectZipCandidate}
          locationDisplay={locationDisplay}
        />
      ) : null}
      {step === 6 ? <KinksStep selectedIds={kinkIds} onChange={setKinkIds} /> : null}
      {step === 7 ? (
        <DetailsStep
          genders={genders}
          onGendersChange={setGenders}
          orientations={orientations}
          onOrientationsChange={setOrientations}
          roles={roles}
          onRolesChange={setRoles}
        />
      ) : null}
      {step === 8 ? (
        <PrivacyStep privacy={privacy} onChange={(next: PrivacySettings) => setPrivacy(next)} />
      ) : null}
      {step === 9 ? <InterestsStep intents={intents} onToggle={toggleIntent} /> : null}
      {step === 10 ? (
        <GalleryStep
          uploading={galleryUploading}
          message={galleryMessage}
          onFiles={(files) => void handleGalleryFiles(files)}
        />
      ) : null}
      {step === 11 ? (
        <FirstStepsStep
          orderedFirstSteps={orderedFirstSteps}
          hasIntents={intents.size > 0}
          onPickAction={(href) => void finishOnboarding(href)}
        />
      ) : null}
    </WizardShell>
  )
}
