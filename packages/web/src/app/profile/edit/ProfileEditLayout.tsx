import { useMemo, useState, useEffect } from 'react'
import { Link, Navigate, Outlet, useBlocker, useLocation, useSearchParams } from 'react-router-dom'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import ProfileEditTabNav, {
  getProfileEditTab,
  resolveActiveProfileEditTab,
} from '@/components/profile/edit/ProfileEditTabNav'
import ProfileStudioCoachRail from '@/components/profile/studio/ProfileStudioCoachRail'
import ProfileStudioSaveBar, { type AutosaveBarState } from '@/components/profile/studio/ProfileStudioSaveBar'
import MediaAttestationModal from '@/components/media/MediaAttestationModal'
import { ProfileEditProvider, useProfileEdit } from '@/contexts/ProfileEditContext'
import { buildLoginHref } from '@/lib/auth-links'
import { buildOnboardingHref } from '@/lib/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import { formatPronounDisplay, parseProfileFieldVisibility } from '@c2k/shared'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import { MOCK_VIEWER_USERNAME } from '@/data/mock-data'
import { deriveStudioSectionStatus } from '@/lib/profile-studio/completion'
import type { PresenceSectionId } from '@/components/profile/edit/PresencePanel'

function resolvePresenceSubsection(raw: string | null): PresenceSectionId {
  if (raw === 'relationships' || raw === 'links' || raw === 'visibility') return raw
  return 'connections'
}

function deriveAutosaveState(input: {
  saving: boolean
  hasUnsavedChanges: boolean
  saveNotice: string | null
  photoUploadStage: 'idle' | 'uploading' | 'processing' | null
  photoUploadError: string | null
  isOnline: boolean
}): { state: AutosaveBarState; message: string; saveFailed: boolean } {
  if (!input.isOnline) {
    return {
      state: 'offline',
      message: 'Offline — will save when connection returns',
      saveFailed: false,
    }
  }

  if (input.photoUploadStage === 'uploading') {
    return { state: 'saving', message: 'Updating profile picture…', saveFailed: false }
  }
  if (input.photoUploadStage === 'processing') {
    return { state: 'saving', message: 'Scanning your photo…', saveFailed: false }
  }
  if (input.photoUploadError) {
    return { state: 'error', message: "Couldn't save photo — try again", saveFailed: true }
  }

  if (input.saving || input.hasUnsavedChanges) {
    return { state: 'saving', message: 'Saving…', saveFailed: false }
  }

  if (input.saveNotice) {
    const saved =
      input.saveNotice.includes('saved') ||
      input.saveNotice.includes('updated') ||
      input.saveNotice.includes('approved')
    if (saved) {
      return { state: 'saved', message: 'Saved just now', saveFailed: false }
    }
    return {
      state: 'error',
      message: "Couldn't save changes — edits still on this device",
      saveFailed: true,
    }
  }

  return { state: 'idle', message: 'Your changes save automatically', saveFailed: false }
}

function ProfileEditLayoutInner() {
  const { isAuthenticated, isFallback, status: authStatus } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const redirectAfter = searchParams.get('redirect')
  const ctx = useProfileEdit()

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!ctx.hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [ctx.hasUnsavedChanges])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      ctx.hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm('You have unsaved profile changes. Leave without saving?')
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const activeSection = resolveActiveProfileEditTab(location.pathname)
  const activeTab = getProfileEditTab(activeSection)
  const presenceSubsection = resolvePresenceSubsection(searchParams.get('section'))
  const isExpandedEditor = /\/profile\/edit\/(photos|interests)(\/|$)/.test(location.pathname)

  const publicProfileHref =
    ctx.viewerUsername ? `/profile/${encodeURIComponent(ctx.viewerUsername)}` : null

  const completionInput = useMemo(
    () => ({
      displayName: ctx.displayName,
      bio: ctx.bio,
      locationLabel: ctx.locationLabel,
      hasPhoto: ctx.hasPhoto,
      roles: ctx.roles,
      lifestyleActivity: ctx.lifestyleActivity,
      lookingFor: ctx.lookingFor,
      kinksCount: ctx.kinks.length,
      linksCount: ctx.links.length,
      relationshipsCount: ctx.relationships.length,
      pronounTags: ctx.pronounTags,
    }),
    [ctx],
  )

  const sectionStatus = useMemo(() => deriveStudioSectionStatus(completionInput), [completionInput])

  const previewDraft = useMemo(
    () => ({
      displayName:
        ctx.displayName.trim() ||
        (ctx.profileMe.data?.profile.displayName as string | null) ||
        ctx.viewerUsername ||
        MOCK_VIEWER_USERNAME,
      username: ctx.profileMe.data?.user.username ?? ctx.viewerUsername ?? MOCK_VIEWER_USERNAME,
      bio: ctx.bio,
      locationLabel: ctx.locationLabel,
      ageLabel:
        ctx.profileMe.data?.profile.age != null ? String(ctx.profileMe.data.profile.age) : undefined,
      pronouns: formatPronounDisplay(ctx.pronounTags) || undefined,
      genders: ctx.genders,
      sexualOrientations: ctx.sexualOrientations,
      romanticOrientations: ctx.romanticOrientations,
      roles: ctx.roles,
      lifestyleActivity: ctx.lifestyleActivity,
      lookingFor: ctx.lookingFor,
      kinksCount: ctx.kinks.length,
      kinkLabels: ctx.kinks.map((kink) => kink.displayName).filter(Boolean),
      linksCount: ctx.links.length,
      photoUrl: ctx.photoPreviewUrl,
      photoCaption: ctx.photoCaption.trim() || null,
      photoDisplaySettings: ctx.photoDisplaySettings,
      fieldVisibility: parseProfileFieldVisibility(ctx.profileMe.data?.profile.fieldVisibility),
    }),
    [ctx],
  )

  const autosave = useMemo(
    () =>
      deriveAutosaveState({
        saving: ctx.saving,
        hasUnsavedChanges: ctx.hasUnsavedChanges,
        saveNotice: ctx.saveNotice,
        photoUploadStage: ctx.photoUploadStage,
        photoUploadError: ctx.photoUploadError,
        isOnline,
      }),
    [ctx.saving, ctx.hasUnsavedChanges, ctx.saveNotice, ctx.photoUploadStage, ctx.photoUploadError, isOnline],
  )

  const coachRail = (
    <ProfileStudioCoachRail
      section={activeSection}
      presenceSubsection={presenceSubsection}
      draft={previewDraft}
      hasUnsavedChanges={ctx.hasUnsavedChanges}
      photoUploadStage={ctx.photoUploadStage === 'idle' ? null : ctx.photoUploadStage}
    />
  )

  if (searchParams.get('onboarding') === '1') {
    return <Navigate to={buildOnboardingHref(redirectAfter)} replace />
  }

  if (authStatus === 'ready' && (!isAuthenticated || isFallback)) {
    return <Navigate to={buildLoginHref('/profile/edit')} replace />
  }

  if (ctx.loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading profile">
        <div className="mb-6 space-y-2">
          <div className="dc-skeleton-bone h-8 w-48 rounded-lg" />
          <div className="dc-skeleton-bone h-4 w-full max-w-md rounded-lg" />
        </div>
        <div className="dc-skeleton-stagger space-y-6">
          <DancecardPanelSkeleton lines={4} />
          <DancecardPanelSkeleton lines={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-8 lg:px-8 pb-[calc(var(--c2k-save-bar-h)+var(--c2k-mobile-breathing)+env(safe-area-inset-bottom,0px)+1.25rem)] md:pb-[calc(var(--c2k-save-bar-h)+1rem)]">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-dc-text sm:text-2xl lg:text-3xl">Profile Studio</h1>
          <p className="mt-1 text-sm text-dc-muted">Your changes save automatically.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {publicProfileHref ?
            <Link
              to={publicProfileHref}
              className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted sm:px-4 sm:text-sm"
            >
              Preview profile
            </Link>
          : null}
          <Link
            to="/profile"
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text sm:px-4 sm:text-sm"
          >
            Exit Studio
          </Link>
        </div>
      </div>

      {ctx.saveNotice && autosave.state === 'error' ?
        <p className="mb-6 rounded-xl border border-dc-warning/30 bg-dc-warning-muted px-4 py-3 text-sm text-dc-warning" role="alert">
          {ctx.saveNotice}
        </p>
      : null}

      <div className="mb-3 space-y-2 lg:hidden">
        <ProfileEditTabNav sectionStatus={sectionStatus} />
        <button
          type="button"
          onClick={() => setMobilePreviewOpen((open) => !open)}
          className="w-full min-h-10 rounded-xl border border-dc-border text-sm font-medium text-dc-accent hover:bg-dc-accent-muted/20"
        >
          {mobilePreviewOpen ? 'Hide preview' : 'Preview section'}
        </button>
        {mobilePreviewOpen ? coachRail : null}
      </div>

      <div
        className={
          isExpandedEditor ?
            'lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start'
          : 'lg:grid lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-8 lg:items-start'
        }
      >
        <aside className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          <ProfileEditTabNav sectionStatus={sectionStatus} />
        </aside>

        <div className="min-w-0">
          {activeTab ?
            <header className="mb-5">
              <h2 className="text-lg font-semibold text-dc-text sm:text-xl">{activeTab.label}</h2>
              <p className="mt-1 text-sm text-dc-muted">{activeTab.description}</p>
            </header>
          : null}
          <TabContentTransition tabKey={`${location.pathname}?${searchParams.get('section') ?? ''}`}>
            <Outlet />
          </TabContentTransition>
        </div>

        {!isExpandedEditor ?
          <aside className="hidden lg:block">{coachRail}</aside>
        : null}
      </div>

      <ProfileStudioSaveBar
        state={autosave.state}
        message={autosave.message}
        onRetry={autosave.saveFailed ? () => void ctx.handleSave() : undefined}
        onDiscard={autosave.saveFailed && ctx.hasUnsavedChanges ? () => ctx.discardChanges() : undefined}
        showDiscard={autosave.saveFailed && ctx.hasUnsavedChanges}
      />

      <MediaAttestationModal
        open={ctx.attestationTarget}
        onClose={() => ctx.setAttestationTarget(null)}
        onSubmitted={() => ctx.onAttestationCompleted()}
        profilePhotoOnly
      />
    </div>
  )
}

export default function ProfileEditLayout() {
  return (
    <ProfileEditProvider>
      <ProfileEditLayoutInner />
    </ProfileEditProvider>
  )
}
