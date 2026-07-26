import { useMemo, useState, useEffect } from 'react'
import { Link, Navigate, Outlet, useBlocker, useLocation, useSearchParams } from 'react-router-dom'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import ProfileEditTabNav from '@/components/profile/edit/ProfileEditTabNav'
import ProfileStudioCoachRail from '@/components/profile/studio/ProfileStudioCoachRail'
import ProfileStudioSaveBar from '@/components/profile/studio/ProfileStudioSaveBar'
import MediaAttestationModal from '@/components/media/MediaAttestationModal'
import { ProfileEditProvider, useProfileEdit } from '@/contexts/ProfileEditContext'
import { buildLoginHref } from '@/lib/auth-links'
import { buildOnboardingHref } from '@/lib/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import { formatPronounDisplay, parseProfileFieldVisibility } from '@c2k/shared'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import { MOCK_VIEWER_USERNAME } from '@/data/mock-data'
import {
  deriveStudioSectionStatus,
  deriveVisitorReadout,
} from '@/lib/profile-studio/completion'

function ProfileEditLayoutInner() {
  const { isAuthenticated, isFallback, status: authStatus } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const redirectAfter = searchParams.get('redirect')
  const ctx = useProfileEdit()

  useEffect(() => {
    if (!ctx.hasUnsavedChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
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

  const publicProfileHref = ctx.viewerUsername ?
    `/profile/${encodeURIComponent(ctx.viewerUsername)}`
  : null

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
  const visitorReadout = useMemo(() => deriveVisitorReadout(completionInput), [completionInput])

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
      photoUrl: ctx.photoPreviewUrl,
      photoCaption: ctx.photoCaption.trim() || null,
      photoDisplaySettings: ctx.photoDisplaySettings,
      fieldVisibility: parseProfileFieldVisibility(ctx.profileMe.data?.profile.fieldVisibility),
    }),
    [ctx],
  )

  const coachRail = (
    <ProfileStudioCoachRail
      draft={previewDraft}
      publicProfileHref={publicProfileHref}
      hasUnsavedChanges={ctx.hasUnsavedChanges}
      photoUploadStage={ctx.photoUploadStage === 'idle' ? null : ctx.photoUploadStage}
      visitorReadout={visitorReadout}
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
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8" aria-busy="true" aria-label="Loading profile">
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

  const footerHint =
    location.pathname.endsWith('/links') ?
      'Websites save with Save link in the panel—not this footer bar.'
    : location.pathname.endsWith('/relationships') ?
      'Relationships save with the buttons in that panel—not this footer bar.'
    : location.pathname.endsWith('/privacy') ?
      'Privacy choices here save immediately when you change them.'
    : 'Text fields and interests auto-save after you leave a field. Photos save when you pick a file.'

  const footerStatus =
    ctx.photoUploadStage === 'uploading' ? 'Uploading photo to server…'
    : ctx.photoUploadStage === 'processing' ? 'Scanning your photo…'
    : ctx.photoUploadError ? 'Photo upload failed — see message above'
    : ctx.saving ? 'Saving…'
    : ctx.hasUnsavedChanges ? 'Unsaved changes — auto-saves when you leave a field'
    : ctx.saveNotice && !ctx.saveNotice.includes('saved') && !ctx.saveNotice.includes('updated') ?
      'Something needs attention — see message above'
    : ctx.saveNotice?.includes('saved') || ctx.saveNotice?.includes('updated') ? 'All changes saved'
    : 'Up to date'

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 sm:py-8 lg:px-8 pb-[calc(var(--c2k-save-bar-h)+var(--c2k-mobile-breathing)+env(safe-area-inset-bottom,0px)+1.25rem)] md:pb-[calc(var(--c2k-save-bar-h)+1rem)]">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-dc-text sm:text-2xl lg:text-3xl">Profile Studio</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {publicProfileHref ?
            <Link
              to={publicProfileHref}
              className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted sm:min-h-10 sm:px-4 sm:text-sm"
            >
              View public profile
            </Link>
          : null}
          <Link
            to="/profile"
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text sm:border-0 sm:bg-dc-accent sm:px-4 sm:text-sm sm:font-medium sm:text-dc-accent-foreground sm:hover:bg-dc-accent-hover"
          >
            Your dashboard
          </Link>
        </div>
      </div>

      {ctx.saveNotice ?
        <p
          className={`mb-6 text-sm rounded-xl border px-4 py-3 ${
            ctx.saveNotice.includes('saved') || ctx.saveNotice.includes('updated') ?
              'border-dc-accent-border bg-dc-accent-muted text-dc-text'
            : 'border-dc-warning/30 bg-dc-warning-muted text-dc-warning'
          }`}
          role="status"
        >
          {ctx.saveNotice}
        </p>
      : null}

      <div className="mb-3 space-y-2 lg:hidden">
        <ProfileEditTabNav sectionStatus={sectionStatus} />
        <button
          type="button"
          onClick={() => setMobilePreviewOpen((o) => !o)}
          className="w-full min-h-10 rounded-xl border border-dc-border text-sm font-medium text-dc-accent hover:bg-dc-accent-muted/20"
        >
          {mobilePreviewOpen ? 'Hide live preview' : 'Preview profile'}
        </button>
        {mobilePreviewOpen ? coachRail : null}
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        <aside className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          <ProfileEditTabNav sectionStatus={sectionStatus} />
        </aside>

        <div className="min-w-0">
          <TabContentTransition tabKey={location.pathname}>
            <Outlet />
          </TabContentTransition>
        </div>

        <aside className="hidden lg:block">{coachRail}</aside>
      </div>

      <ProfileStudioSaveBar
        status={footerStatus}
        hint={footerHint}
        saving={ctx.saving}
        hasUnsavedChanges={ctx.hasUnsavedChanges}
        onSave={() => void ctx.handleSave()}
        onDiscard={ctx.hasUnsavedChanges ? () => ctx.discardChanges() : undefined}
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
