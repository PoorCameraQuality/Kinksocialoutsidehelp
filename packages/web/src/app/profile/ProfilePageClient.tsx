import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProfilePhotoManager from '@/components/profile/ProfilePhotoManager'
import { usePublicProfileTabFromUrl } from '@/hooks/usePublicProfileTabFromUrl'
import { PROFILE_MEDIA_GALLERY_ID } from '@/lib/profile-gallery-nav'
import ProfileExtendedSection from '@/components/profile/ProfileExtendedSection'
import ProfileAttendedEventCard from '@/components/profile/ProfileAttendedEventCard'
import ProfileWritingTab from '@/components/profile/tabs/ProfileWritingTab'
import ProfileCommunityTab from '@/components/profile/tabs/ProfileCommunityTab'
import ProfileReviewsTab from '@/components/profile/tabs/ProfileReviewsTab'
import ProfileIsoTab from '@/components/profile/tabs/ProfileIsoTab'
import ProfileConnectionsTab from '@/components/profile/tabs/ProfileConnectionsTab'
import ProfileNetworkCard from '@/components/profile/social/ProfileNetworkCard'
import type {
  ProfileConnectionsSummary,
  ProfileFollowsSummary,
  ProfileMutualConnections,
} from '@/lib/profile-social-types'
import ProfileLayout from '@/components/profile/layout/ProfileLayout'
import ProfileHero from '@/components/profile/layout/ProfileHero'
import ProfileGalleryStrip from '@/components/profile/layout/ProfileGalleryStrip'
import ProfileAboutBlock from '@/components/profile/story/ProfileAboutBlock'
import ProfileInterestsCard from '@/components/profile/story/ProfileInterestsCard'
import ProfileLookingForCard from '@/components/profile/story/ProfileLookingForCard'
import ProfileUpcomingEventsCard from '@/components/profile/story/ProfileUpcomingEventsCard'
import ProfileOrganizationsCard from '@/components/profile/story/ProfileOrganizationsCard'
import ProfileCommunitySnapshotCard from '@/components/profile/story/ProfileCommunitySnapshotCard'
import ProfileMediaTabPanel from '@/components/profile/layout/ProfileMediaTabPanel'
import {
  DEFAULT_PUBLIC_PROFILE_TAB,
  getVisiblePublicProfileTabs,
  type CommunitySection,
  type PublicProfileTab,
  type PublicProfileTabCounts,
} from '@/lib/public-profile-tabs'
import { getMockPersonByUsername, MOCK_VIEWER_USERNAME } from '@/data/mock-data'
import { useAuth, useViewerUsername } from '@/contexts/AuthContext'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import { fetchUserEcosystem, vendorProfilePath } from '@/lib/user-ecosystem'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import ProfileMeHub from '@/components/profile/ProfileMeHub'
import ProfileRecentPostsSection from '@/components/profile/ProfileRecentPostsSection'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import ProfileOwnerActions from '@/components/profile/ProfileOwnerActions'
import { formatMyRsvpLabel, useApiMyRsvps } from '@/hooks/useApiMyRsvps'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import { useApiMyProfileFeedPosts } from '@/hooks/useApiProfileFeedPosts'
import { clearProfileEditLocalOverrides, PROFILE_EDIT_STORAGE_KEY } from '@/lib/profileEditLocalStorage'
import { ADULT_CONTENT_PREFERENCES, formatPronounDisplay, pickPrimaryProfilePhoto, visibleProfileIdentityFields } from '@c2k/shared'

function formatAttendedDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Attended'
  return `Attended ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
}

type ProfilePhotoView = {
  id: string
  url: string
  caption: string | null
  order: number
  displaySettings?: import('@c2k/shared').ProfilePhotoDisplaySettings
  pendingReview?: boolean
}

type RemoteProfileResponse = {
  user: { id: string; username: string; email: string }
  profile: {
    bio: string | null
    displayName: string | null
    location: string | null
    placeId: string | null
    stateId: string | null
    customLocation: string | null
    roles: string[] | null
    sexuality: string | null
    pronouns: string | null
  } | null
  kinks?: {
    kinkTagId: string
    interestStatus: string
    activity: string | null
    note: string | null
    slug: string
    displayName: string
  }[]
  iso?: {
    body: string
    visibility: string
    acceptDmsViaIso: boolean
    updatedAt: string
    images: { sortOrder: number; url: string }[]
  }
  photos?: ProfilePhotoView[]
  connectionsSummary?: ProfileConnectionsSummary
  followsSummary?: ProfileFollowsSummary
  mutualConnections?: ProfileMutualConnections
}

/** Loads persisted profile edits from localStorage. Returns null on SSR or parse error. */
function loadStoredProfile(): { bio?: string; location?: string; sexuality?: string; roles?: string[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_EDIT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('[Profile] Failed to load stored profile:', e)
    return null
  }
}

const MOCK_EVENTS_ATTENDED = [
  { id: 1, title: 'I-81 Southern PA Munch', date: 'Wed, Feb 18', location: 'Chambersburg, PA', rsvpCount: 72, hostVerified: true },
]

function formatTeachingCreditDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-').map((n) => Number(n))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate
  const [y, m, d] = parts
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString()
}

type MeTeachingCreditRow = {
  id: string
  title: string
  eventName: string
  eventDate: string | null
  verified: boolean
  conventionSlug?: string | null
}

export default function ProfilePageClient() {
  const viewerUsername = useViewerUsername()
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [activeTab, setActiveTabState, communitySection] = usePublicProfileTabFromUrl()

  const selectTab = useCallback(
    (tab: PublicProfileTab, section?: CommunitySection) => {
      setActiveTabState(tab)
      const params = new URLSearchParams()
      params.set('tab', tab)
      if (tab === 'Community' && section) params.set('section', section)
      navigate(`${pathname}?${params.toString()}`)
    },
    [pathname, navigate, setActiveTabState],
  )
  const selectCommunitySection = useCallback(
    (section: CommunitySection) => selectTab('Community', section),
    [selectTab],
  )
  const openPhotoGallery = useCallback(() => {
    navigate('/profile/edit')
  }, [navigate])
  const [storedProfile, setStoredProfile] = useState<ReturnType<typeof loadStoredProfile>>(null)
  const [remote, setRemote] = useState<RemoteProfileResponse | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteUnavailable, setRemoteUnavailable] = useState(false)
  const [ecosystem, setEcosystem] = useState<UserEcosystemPayload | null>(null)
  const [journalArticles, setJournalArticles] = useState<ApiEducationArticle[]>([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalUnavailable, setJournalUnavailable] = useState(false)
  const [eduTeachingCredits, setEduTeachingCredits] = useState<MeTeachingCreditRow[]>([])
  const [eduExtrasLoading, setEduExtrasLoading] = useState(false)
  const [eduExtrasUnavailable, setEduExtrasUnavailable] = useState(false)

  const person = getMockPersonByUsername(viewerUsername || MOCK_VIEWER_USERNAME)
  const signedInLive = isAuthenticated && !isFallback
  const useMockProfile = !signedInLive
  const profileMe = useApiProfileMe(signedInLive && authStatus === 'ready')
  const profileFeedPosts = useApiMyProfileFeedPosts(signedInLive, 10)
  const profileApiReady = profileMe.status === 'ready'
  const profileApiLoading = signedInLive && profileMe.status === 'loading'

  const loadRemoteProfile = useCallback(async () => {
    if (!viewerUsername || !isAuthenticated || isFallback) {
      setRemote(null)
      setRemoteUnavailable(false)
      setRemoteLoading(false)
      return
    }
    setRemoteLoading(true)
    setRemoteUnavailable(false)
    try {
      const r = await fetch(`/api/profile/${encodeURIComponent(viewerUsername)}`, {
        credentials: 'include',
      })
      if (r.status === 503) {
        setRemote(null)
        setRemoteUnavailable(true)
        return
      }
      if (!r.ok) {
        setRemote(null)
        setRemoteUnavailable(true)
        return
      }
      const data = (await r.json()) as RemoteProfileResponse
      setRemote(data)
    } catch {
      setRemote(null)
      setRemoteUnavailable(true)
    } finally {
      setRemoteLoading(false)
    }
  }, [viewerUsername, isAuthenticated, isFallback])

  const loadEcosystem = useCallback(async () => {
    if (!viewerUsername || !isAuthenticated || isFallback) {
      setEcosystem(null)
      return
    }
    const data = await fetchUserEcosystem(viewerUsername)
    setEcosystem(data)
  }, [viewerUsername, isAuthenticated, isFallback])

  useEffect(() => {
    if (authStatus !== 'ready') return
    void loadRemoteProfile()
    void loadEcosystem()
  }, [authStatus, loadRemoteProfile, loadEcosystem, pathname])

  useEffect(() => {
    const refreshRemoteProfile = () => {
      void loadRemoteProfile()
    }
    const refreshAll = () => {
      void loadRemoteProfile()
      profileMe.reload()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAll()
    }
    window.addEventListener('focus', refreshAll)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('c2k:profile-privacy-saved', refreshAll)
    // ProfileEditContext already applyProfilePatch after save — refetch causes stale UI flicker.
    window.addEventListener('c2k:profile-saved', refreshRemoteProfile)
    return () => {
      window.removeEventListener('focus', refreshAll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('c2k:profile-privacy-saved', refreshAll)
      window.removeEventListener('c2k:profile-saved', refreshRemoteProfile)
    }
  }, [loadRemoteProfile, profileMe.reload])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadEcosystem()
    }
    window.addEventListener('focus', loadEcosystem)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', loadEcosystem)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadEcosystem])

  const p = profileMe.data?.profile ?? remote?.profile
  const profileDataReady = profileApiReady || (Boolean(remote) && !remoteUnavailable)
  const profileApiFailed =
    signedInLive &&
    !profileApiLoading &&
    !remoteLoading &&
    !profileDataReady &&
    (profileMe.status === 'error' || profileMe.status === 'unavailable' || remoteUnavailable)
  const apiBackedProfile = signedInLive && profileDataReady

  useEffect(() => {
    if (apiBackedProfile) clearProfileEditLocalOverrides()
  }, [apiBackedProfile])
  const hasStoredProfileEdits =
    useMockProfile && Boolean(storedProfile && Object.keys(storedProfile).length > 0)


  const profilePhotos = useMemo((): ProfilePhotoView[] => {
    if (signedInLive) {
      return profileMe.data?.photos ?? remote?.photos ?? []
    }
    return (person?.profilePhotos ?? []).map((photo) => ({
      id: photo.id,
      url: photo.url ?? '',
      caption: photo.caption ?? null,
      order: photo.order,
      displaySettings: photo.displaySettings,
      pendingReview: false,
    }))
  }, [signedInLive, profileMe.data?.photos, remote?.photos, person?.profilePhotos])

  const refreshProfilePhotos = useCallback(() => {
    void loadRemoteProfile()
    profileMe.reload()
  }, [loadRemoteProfile, profileMe])

  const displayBio =
    signedInLive ? (p?.bio ?? '') : (p?.bio ?? storedProfile?.bio ?? person?.bio ?? '')
  const displayRoles =
    signedInLive ? (p?.roles ?? []) : (p?.roles ?? storedProfile?.roles ?? person?.roles ?? ['Switch', 'Rigger', 'Educator'])
  const primaryPhoto =
    pickPrimaryProfilePhoto(profilePhotos) ??
    profilePhotos.find((ph) => !ph.pendingReview && ph.url) ??
    profilePhotos[0]
  const primaryPhotoUrl = primaryPhoto?.url
  const primaryPhotoCaption = primaryPhoto?.caption
  const primaryPhotoDisplaySettings = primaryPhoto?.displaySettings
  const displayUsername =
    signedInLive
      ? (profileMe.data?.user?.username ?? remote?.user?.username ?? viewerUsername ?? '')
      : (remote?.user?.username ?? person?.username ?? viewerUsername ?? MOCK_VIEWER_USERNAME)
  const displayLookingFor = signedInLive ? (profileMe.data?.profile?.lookingFor ?? []) : []
  const visibleIdentity = useMemo(() => {
    const prof = profileMe.data?.profile
    if (!signedInLive || !prof) return null
    return visibleProfileIdentityFields(
      {
        gender: prof.gender ?? null,
        age: prof.age ?? null,
        sexuality: prof.sexuality ?? null,
        pronouns: prof.pronouns ?? null,
        genders: prof.genders,
        sexualOrientations: prof.sexualOrientations,
        romanticOrientations: prof.romanticOrientations,
        pronounTags: prof.pronounTags,
        location: prof.location ?? prof.customLocation ?? null,
        fieldVisibility: prof.fieldVisibility,
      },
      { isOwner: true, isFriend: false, asPublicProfileView: false },
    )
  }, [signedInLive, profileMe.data?.profile])
  const displayPronouns =
    signedInLive ?
      formatPronounDisplay(
        visibleIdentity?.pronounTags ??
          (visibleIdentity?.pronouns ? [visibleIdentity.pronouns] : null),
      ) || undefined
    : undefined
  const displayAgeLabel =
    signedInLive && visibleIdentity?.age != null ? String(visibleIdentity.age) : undefined
  const displayLifestyleActivity =
    signedInLive ? profileMe.data?.profile?.lifestyleActivity?.trim() || undefined : undefined
  const memberSince = signedInLive ? profileMe.data?.user?.memberSince : undefined
  const displayName =
    signedInLive
      ? (p?.displayName?.trim() || profileMe.data?.user?.username || remote?.user?.username || viewerUsername || '')
      : (p?.displayName?.trim() || remote?.user?.username || person?.username || viewerUsername || MOCK_VIEWER_USERNAME)
  const displayLocationForProfile =
    signedInLive ?
      (visibleIdentity?.location?.trim() || '')
    : (p?.location ?? storedProfile?.location ?? person?.location ?? 'Shippensburg, Pennsylvania')
  const serverKinks = profileMe.data?.kinks ?? remote?.kinks

  const retryProfileLoad = useCallback(() => {
    refreshProfilePhotos()
  }, [refreshProfilePhotos])

  useEffect(() => {
    setStoredProfile(loadStoredProfile())
  }, [pathname])

  const clearStoredProfileEdits = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(PROFILE_EDIT_STORAGE_KEY)
    setStoredProfile(null)
  }, [])

  const myRsvps = useApiMyRsvps(signedInLive)
  const pastAttendedEvents = useMemo(() => {
    const now = Date.now()
    return myRsvps.items.filter((r) => {
      const t = new Date(r.startsAt).getTime()
      return !Number.isNaN(t) && t < now
    })
  }, [myRsvps.items])

  const needsJournalData = activeTab === 'Media'

  useEffect(() => {
    if (!needsJournalData) return
    if (!viewerUsername || !isAuthenticated || isFallback) {
      setJournalArticles([])
      setJournalUnavailable(false)
      setJournalLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setJournalLoading(true)
      setJournalUnavailable(false)
      try {
        const r = await fetch(`/api/v1/users/${encodeURIComponent(viewerUsername)}/journal`, { credentials: 'include' })
        if (cancelled) return
        if (r.status === 503 || !r.ok) {
          setJournalUnavailable(true)
          setJournalArticles([])
          return
        }
        const data = (await r.json()) as { items?: ApiEducationArticle[] }
        setJournalArticles(Array.isArray(data.items) ? data.items : [])
      } catch {
        if (!cancelled) {
          setJournalUnavailable(true)
          setJournalArticles([])
        }
      } finally {
        if (!cancelled) setJournalLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsJournalData, viewerUsername, isAuthenticated, isFallback])

  useEffect(() => {
    if (activeTab !== 'Media' || !signedInLive) {
      setEduTeachingCredits([])
      setEduExtrasUnavailable(false)
      setEduExtrasLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setEduExtrasLoading(true)
      setEduExtrasUnavailable(false)
      try {
        const creditsRes = await fetch('/api/v1/presenters/me/teaching-credits', {
          credentials: 'include',
        })
        if (cancelled) return
        if (creditsRes.status === 503) {
          setEduExtrasUnavailable(true)
          return
        }
        if (creditsRes.ok) {
          const cred = (await creditsRes.json()) as { items?: MeTeachingCreditRow[] }
          setEduTeachingCredits(Array.isArray(cred.items) ? cred.items : [])
        }
      } catch {
        if (!cancelled) setEduExtrasUnavailable(true)
      } finally {
        if (!cancelled) setEduExtrasLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, signedInLive])

  const journalPublishedList = useMemo(
    () => journalArticles.filter((a) => a.publicationStatus === 'PUBLISHED'),
    [journalArticles],
  )

  const connectionsSummary = remote?.connectionsSummary
  const followsSummary = remote?.followsSummary
  const mutualConnections = remote?.mutualConnections

  const tabVisibility = useMemo(
    () => ({
      viewerIsOwner: true,
      isAuthenticated: isAuthenticated && !isFallback,
      hasRelationships: false,
      hasConnections: true,
      hasEventHistory: pastAttendedEvents.length > 0 || useMockProfile,
      hasMedia:
        journalPublishedList.length > 0 ||
        eduTeachingCredits.length > 0 ||
        profilePhotos.length > 0,
      hasReviews: false,
      hasIso: Boolean(remote?.iso?.body?.trim()),
    }),
    [
      isAuthenticated,
      isFallback,
      pastAttendedEvents.length,
      useMockProfile,
      journalPublishedList.length,
      eduTeachingCredits.length,
      profilePhotos.length,
      remote?.iso?.body,
    ],
  )

  const profileTabCounts = useMemo((): PublicProfileTabCounts | undefined => {
    const count = connectionsSummary?.totalCount
    if (count == null) return undefined
    return { Community: count }
  }, [connectionsSummary?.totalCount])

  const communityVisibleSections = useMemo(
    (): CommunitySection[] => ['relationships', 'connections', 'feedback'],
    [],
  )

  const visibleTabs = useMemo(
    () => getVisiblePublicProfileTabs(tabVisibility),
    [tabVisibility],
  )

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      selectTab(visibleTabs[0] ?? DEFAULT_PUBLIC_PROFILE_TAB)
    }
  }, [visibleTabs, activeTab, selectTab])

  const ownerHeroActions = (
    <ProfileOwnerActions
      viewerUsername={viewerUsername}
      apiBacked={apiBackedProfile}
      hasPresenter={Boolean(ecosystem?.presenter)}
      hasVendor={Boolean(ecosystem?.vendor)}
      vendorHref={ecosystem?.vendor ? vendorProfilePath(ecosystem.vendor) : null}
    />
  )

  const ownerStoryProps = {
    displayName,
    username: displayUsername,
    bio: displayBio || null,
    location: displayLocationForProfile || 'Unknown',
    ageLabel: displayAgeLabel,
    pronouns: displayPronouns,
    genders: visibleIdentity?.genders ?? [],
    sexualOrientations: visibleIdentity?.sexualOrientations ?? [],
    romanticOrientations: visibleIdentity?.romanticOrientations ?? [],
    roles: displayRoles,
    lookingFor: displayLookingFor,
    kinks: serverKinks ?? [],
    lifestyleActivity: displayLifestyleActivity,
    memberSince,
    photoUrl: primaryPhotoUrl,
    photoCaption: primaryPhotoCaption,
    photoDisplaySettings: primaryPhotoDisplaySettings,
    photoCount: profilePhotos.length,
    onOpenGallery: openPhotoGallery,
    ecosystem,
    references: [] as { createdAt: string; referrerUsername: string }[],
    referencesCount: 0,
    eventsAttended: pastAttendedEvents.length,
    educationContributions: journalPublishedList.length + eduTeachingCredits.length,
    viewerIsOwner: true as const,
    pronounTags: visibleIdentity?.pronounTags ?? undefined,
    onAddReference: () => selectTab('Community', 'feedback'),
    heroActions: ownerHeroActions,
  }

  return (
    <ProfileLayout
      alerts={
        <>
          {signedInLive && profileApiFailed && !profileApiLoading ?
            <LoadErrorBanner
              className="mb-4"
              message="Could not load your profile from the server. Check your connection and try again."
              onRetry={retryProfileLoad}
            />
          : null}
          {signedInLive && hasStoredProfileEdits && profileDataReady ?
            <div
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              <p>
                This browser has saved offline profile edits that may be outdated. Your live profile comes from the server.
              </p>
              <button
                type="button"
                onClick={clearStoredProfileEdits}
                className="mt-2 min-h-11 rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-500/10"
              >
                Clear saved browser edits
              </button>
            </div>
          : null}
        </>
      }
      hero={
        profileApiLoading ?
          <div className="rounded-2xl border border-dc-border p-8 text-center text-sm text-dc-muted" aria-busy="true">
            Loading your profile…
          </div>
        : <ProfileHero
            displayName={ownerStoryProps.displayName}
            username={ownerStoryProps.username}
            ageLabel={ownerStoryProps.ageLabel}
            pronouns={ownerStoryProps.pronouns}
            genders={ownerStoryProps.genders}
            sexualOrientations={ownerStoryProps.sexualOrientations}
            romanticOrientations={ownerStoryProps.romanticOrientations}
            location={ownerStoryProps.location}
            roles={ownerStoryProps.roles}
            photoUrl={ownerStoryProps.photoUrl}
            photoCaption={ownerStoryProps.photoCaption}
            photoDisplaySettings={ownerStoryProps.photoDisplaySettings}
            photoCount={ownerStoryProps.photoCount}
            onOpenGallery={ownerStoryProps.onOpenGallery}
            managePhotosHref="/profile/edit"
            actions={ownerStoryProps.heroActions}
          />
      }
      gallery={
        profileApiLoading ? undefined : (
          <ProfileGalleryStrip
            photos={profilePhotos}
            viewer={{ authenticated: true, adultContentPref: ADULT_CONTENT_PREFERENCES.blur }}
            totalCount={profilePhotos.length}
            managePhotosHref="/profile/edit"
            viewerIsOwner
          />
        )
      }
      primary={
        <>
          <ProfileAboutBlock bio={ownerStoryProps.bio} viewerIsOwner />
          <ProfileInterestsCard kinks={ownerStoryProps.kinks} viewerIsOwner />
          <ProfileLookingForCard lookingFor={ownerStoryProps.lookingFor} viewerIsOwner />
          {signedInLive && displayUsername ?
            <ProfileRecentPostsSection
              viewerIsOwner
              viewerUsername={viewerUsername}
              profileUsername={displayUsername}
              items={profileFeedPosts.items}
              status={profileFeedPosts.status}
              error={profileFeedPosts.error}
              onRetry={() => void profileFeedPosts.reload()}
            />
          : null}
        </>
      }
      secondary={
        <>
          <ProfileNetworkCard
            username={ownerStoryProps.username}
            viewerIsOwner
            connections={connectionsSummary}
            follows={followsSummary}
            mutualConnections={mutualConnections}
          />
          <ProfileUpcomingEventsCard ecosystem={ecosystem} username={ownerStoryProps.username} viewerIsOwner />
          <ProfileOrganizationsCard ecosystem={ecosystem} username={ownerStoryProps.username} />
          <ProfileCommunitySnapshotCard
            ecosystem={ecosystem}
            memberSince={memberSince}
            roles={ownerStoryProps.roles}
            lifestyleActivity={displayLifestyleActivity}
            eventsAttended={pastAttendedEvents.length}
          />
        </>
      }
      more={
        <>
        <ProfileExtendedSection
          viewerIsOwner
          visibleTabs={visibleTabs}
          activeTab={activeTab}
          onSelect={selectTab}
          tabCounts={profileTabCounts}
        >
            {activeTab === 'Community' && (
              <ProfileCommunityTab
                activeSection={communitySection}
                onSectionChange={selectCommunitySection}
                visibleSections={communityVisibleSections}
                relationships={
                  <EmptyState
                    title="Connections & relationships"
                    message="Relationship and D/s labels are managed in profile edit. They appear here publicly when you add them."
                    ctaLabel="Edit relationships"
                    ctaHref="/profile/edit/relationships"
                    inline
                  />
                }
                connections={
                  viewerUsername ?
                    <ProfileConnectionsTab
                      username={viewerUsername}
                      listVisible={connectionsSummary?.listVisible ?? true}
                      totalCount={connectionsSummary?.totalCount ?? 0}
                      mutualCount={connectionsSummary?.mutualCount ?? null}
                      viewerIsOwner
                    />
                  : null
                }
                feedback={
                  <ProfileReviewsTab
                    viewerIsOwner
                    username={viewerUsername ?? ''}
                    viewerUsername={viewerUsername}
                    isAuthenticated={isAuthenticated}
                    references={[]}
                    incoming={[]}
                    loading={false}
                    viewerHasPendingOrAccepted={false}
                    refCategory="general"
                    refNote=""
                    refNoteId="owner-reviews"
                    onRefCategoryChange={() => {}}
                    onRefNoteChange={() => {}}
                    onOfferReference={() => {}}
                    onRespondIncoming={() => {}}
                  />
                }
              />
            )}

            {activeTab === 'ISO' && (
              isAuthenticated && !isFallback && remote?.user ?
                <ProfileIsoTab
                  viewerIsOwner
                  isAuthenticated={isAuthenticated}
                  iso={remote.iso}
                  username={remote.user.username}
                  userId={remote.user.id}
                />
              : <p className="text-sm text-dc-text-muted">Sign in with a full account to edit your ISO.</p>
            )}

            {activeTab === 'Event history' && (
              signedInLive ?
                myRsvps.status === 'loading' ?
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" role="status">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-44 animate-pulse rounded-2xl bg-dc-elevated-muted" />
                    ))}
                  </div>
                : myRsvps.status === 'error' ?
                  <LoadErrorBanner
                    message="Could not load your event history. Check your connection and try again."
                    onRetry={() => myRsvps.reload()}
                  />
                : pastAttendedEvents.length === 0 ?
                  <EmptyState
                    message="Past events you attended will show here after they end. Upcoming RSVPs and hosting appear in your story summary above."
                    ctaLabel="Browse events"
                    ctaHref="/events"
                    secondaryCtaLabel="Find people"
                    secondaryCtaHref="/people"
                    inline
                  />
                : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pastAttendedEvents.map((r) => {
                      const { title } = formatMyRsvpLabel(r)
                      return (
                        <ProfileAttendedEventCard
                          key={r.eventId}
                          eventId={r.eventId}
                          title={title}
                          attendedLabel={formatAttendedDate(r.startsAt)}
                          showAddNote
                        />
                      )
                    })}
                  </div>
              : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MOCK_EVENTS_ATTENDED.map((event) => (
                    <ProfileAttendedEventCard
                      key={event.id}
                      eventId={String(event.id)}
                      title={event.title}
                      attendedLabel={`Attended ${event.date}`}
                      location={event.location}
                      verified={event.hostVerified}
                      showAddNote
                    />
                  ))}
                </div>
            )}

            {activeTab === 'Media' && (
              <ProfileMediaTabPanel
                id={PROFILE_MEDIA_GALLERY_ID}
                username={viewerUsername ?? ''}
                apiBacked={signedInLive}
                viewerIsOwner
                writing={
                  !isAuthenticated || isFallback ?
                    <p className="text-sm text-dc-text-muted">Sign in with a full account to see your writing on the server.</p>
                  : <ProfileWritingTab
                      viewerIsOwner
                      loading={journalLoading || eduExtrasLoading}
                      unavailable={journalUnavailable || eduExtrasUnavailable}
                      articles={journalArticles}
                      teachingCredits={eduTeachingCredits}
                      formatTeachingDate={formatTeachingCreditDate}
                    />
                }
                profilePhotosSlot={
                  <ProfilePhotoManager
                    apiBacked={signedInLive}
                    embedded
                    basePhotos={useMockProfile ? (person?.profilePhotos ?? []) : []}
                    onPhotosChanged={refreshProfilePhotos}
                  />
                }
              />
            )}
        </ProfileExtendedSection>
        {!profileApiLoading ? <ProfileMeHub /> : null}
        </>
      }
    />
  )
}
