import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback, useId } from 'react'
import type { BadgeId } from '@/data/types'
import type { MockProfilePhoto } from '@/data/mock-data'
import { getMockPersonByUsername, getMockEndorsementsForUser } from '@/data/mock-data'
import { useAuth, useViewerUsername } from '@/contexts/AuthContext'
import { type ProfileIsoPayload } from '@/components/profile/ProfileIsoView'
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
import ProfileViewerActions from '@/components/profile/ProfileViewerActions'
import ProfilePhotoGallery, { type ProfileGalleryPhoto } from '@/components/profile/ProfilePhotoGallery'
import ProfilePhotoManager from '@/components/profile/ProfilePhotoManager'
import { useAdultContentPreference } from '@/hooks/useAdultContentPreference'
import { ADULT_CONTENT_PREFERENCES, formatPronounDisplay, normalizeProfilePhotoDisplaySettings, pickPrimaryProfilePhoto } from '@c2k/shared'
import { shouldBlurMediaForViewer } from '@/lib/media-visibility'
import ProfileExtendedSection from '@/components/profile/ProfileExtendedSection'
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
import ProfileRelationshipsList, {
  type PublicRelationshipItem,
} from '@/components/profile/ProfileRelationshipsList'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import { fetchUserEcosystem } from '@/lib/user-ecosystem'
import { useGraphStatus } from '@/hooks/useGraphStatus'
import { usePublicProfileTabFromUrl } from '@/hooks/usePublicProfileTabFromUrl'
import { PROFILE_MEDIA_GALLERY_ID, scrollToProfileMediaGallery } from '@/lib/profile-gallery-nav'
import {
  DEFAULT_PUBLIC_PROFILE_TAB,
  getVisiblePublicProfileTabs,
  type CommunitySection,
  type PublicProfileTab,
  type PublicProfileTabCounts,
} from '@/lib/public-profile-tabs'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import TsReportModal, { type TsReportTarget } from '@/components/moderation/TsReportModal'
import EmptyState from '@/components/ui/EmptyState'
import ProfileRecentPostsSection from '@/components/profile/ProfileRecentPostsSection'
import { useApiProfileFeedPosts, useApiMyProfileFeedPosts } from '@/hooks/useApiProfileFeedPosts'

function formatTeachingCreditDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-').map((n) => Number(n))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate
  const [y, m, d] = parts
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString()
}

type ReferenceItem = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
  referrerTrustScore: number
  referrerTrustAtAccept?: number | null
}

type IncomingRef = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
}

export default function ProfileUsernamePage() {
  const viewerUsername = useViewerUsername()
  const { isAuthenticated, isFallback } = useAuth()
  const params = useParams()
  const username = params.username as string
  const viewerIsSelf = Boolean(viewerUsername && viewerUsername === username)
  const profileData = getMockPersonByUsername(username)
  const [references, setReferences] = useState<ReferenceItem[]>([])
  const [incoming, setIncoming] = useState<IncomingRef[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const [refCategory, setRefCategory] = useState<
    'character' | 'play' | 'community' | 'technique' | 'general'
  >('general')
  const [refNote, setRefNote] = useState('')
  const refNoteId = useId()
  const [storedPhotos, setStoredPhotos] = useState<MockProfilePhoto[] | null>(null)
  const [ecosystem, setEcosystem] = useState<UserEcosystemPayload | null>(null)
  const [apiProfileStatus, setApiProfileStatus] = useState<'idle' | 'loading' | 'ok' | 'missing'>('idle')
  const [publicProfile, setPublicProfile] = useState<{
    user: { id: string; username: string; memberSince?: string }
    profile: {
      bio: string | null
      displayName: string | null
      location: string | null
      roles: string[] | null
      sexuality: string | null
      sexualOrientations?: string[] | null
      romanticOrientations?: string[] | null
      pronouns?: string | null
      pronounTags?: string[] | null
      age?: number | null
      genders?: string[] | null
      lifestyleActivity?: string | null
      lookingFor?: string[] | null
    } | null
    kinks?: {
      kinkTagId: string
      interestStatus: string
      note: string | null
      slug: string
      displayName: string
    }[]
    iso?: ProfileIsoPayload
    photos?: {
      id: string
      url: string
      caption: string | null
      order: number
      displaySettings?: unknown
      mediaAssetId?: string | null
      uploadStatus?: string | null
      contentRating?: string | null
      visibility?: string | null
      isBlurredByDefault?: boolean
    }[]
    connectionsSummary?: ProfileConnectionsSummary
    followsSummary?: ProfileFollowsSummary
    mutualConnections?: ProfileMutualConnections
  } | null>(null)
  const [publicRelationships, setPublicRelationships] = useState<PublicRelationshipItem[]>([])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [activeTab, setActiveTabState, communitySection] = usePublicProfileTabFromUrl()
  const [journalArticles, setJournalArticles] = useState<ApiEducationArticle[]>([])
  const [journalLoading, setJournalLoading] = useState(false)
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
    if (viewerIsSelf) {
      navigate('/profile/edit')
      return
    }
    selectTab('Media')
    scrollToProfileMediaGallery()
  }, [viewerIsSelf, navigate, selectTab])
  const [reportOpen, setReportOpen] = useState<TsReportTarget | null>(null)
  const [photoReportOpen, setPhotoReportOpen] = useState<TsReportTarget | null>(null)
  const adultContentPref = useAdultContentPreference(isAuthenticated && !isFallback)
  const [connectBusy, setConnectBusy] = useState(false)
  const [connectNotice, setConnectNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const apiBackedPublic =
    Boolean(publicProfile?.user) && username !== viewerUsername && isAuthenticated && !isFallback
  const { status: graphStatus, reload: reloadGraph } = useGraphStatus(username, apiBackedPublic)
  const [graphBusy, setGraphBusy] = useState(false)
  const showProfilePosts = isAuthenticated && !isFallback && apiProfileStatus === 'ok'
  const ownProfileFeedPosts = useApiMyProfileFeedPosts(showProfilePosts && viewerIsSelf, 10)
  const publicProfileFeedPosts = useApiProfileFeedPosts(username, showProfilePosts && !viewerIsSelf, 10)
  const profileFeedPosts = viewerIsSelf ? ownProfileFeedPosts : publicProfileFeedPosts

  const sendConnectionRequest = useCallback(async () => {
    if (!apiBackedPublic || connectBusy) return
    setConnectBusy(true)
    setConnectNotice(null)
    try {
      const r = await fetch('/api/v1/connections/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUsername: username }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (r.ok) {
        setConnectNotice({
          kind: 'success',
          text: 'Connection request sent. They can accept from Connections. You will see it under Outgoing.',
        })
        await reloadGraph()
        return
      }
      setConnectNotice({ kind: 'error', text: j.error ?? 'Could not send request.' })
    } catch {
      setConnectNotice({ kind: 'error', text: 'Network error. Try again in a moment.' })
    } finally {
      setConnectBusy(false)
    }
  }, [apiBackedPublic, connectBusy, username, reloadGraph])

  const toggleFollow = useCallback(async () => {
    if (!apiBackedPublic || graphBusy) return
    setGraphBusy(true)
    try {
      const method = graphStatus?.isFollowing ? 'DELETE' : 'POST'
      const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method,
        credentials: 'include',
      })
      if (r.ok) await reloadGraph()
    } finally {
      setGraphBusy(false)
    }
  }, [apiBackedPublic, graphBusy, graphStatus?.isFollowing, username, reloadGraph])

  const mockRefsFallback = useMemo(() => {
    if (isAuthenticated) return []
    return getMockEndorsementsForUser(username).map((e) => ({
      id: e.id,
      referrerUsername: e.endorserUsername,
      category: 'general',
      note: e.note ?? null,
      createdAt: e.createdAt,
      referrerTrustScore: e.endorserTrustScore,
    }))
  }, [username, isAuthenticated])

  const displayReferences = references.length > 0 ? references : mockRefsFallback

  const viewerHasPendingOrAccepted = useMemo(() => {
    if (!viewerUsername || !isAuthenticated) return false
    const fromApi = references.some((r) => r.referrerUsername === viewerUsername)
    if (fromApi) return true
    return getMockEndorsementsForUser(username).some((e) => e.endorserUsername === viewerUsername)
  }, [references, viewerUsername, username, isAuthenticated])

  const loadReferences = useCallback(async () => {
    setRefLoading(true)
    try {
      const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/references`, {
        credentials: 'include',
      })
      if (r.ok) {
        const data = (await r.json()) as { items: ReferenceItem[] }
        setReferences(data.items ?? [])
      } else {
        setReferences([])
      }
      if (isAuthenticated && username === viewerUsername) {
        const ir = await fetch('/api/v1/profile/references/incoming', { credentials: 'include' })
        if (ir.ok) {
          const idata = (await ir.json()) as { items: IncomingRef[] }
          setIncoming(idata.items ?? [])
        } else setIncoming([])
      } else {
        setIncoming([])
      }
    } catch {
      setReferences([])
      setIncoming([])
    } finally {
      setRefLoading(false)
    }
  }, [username, isAuthenticated, viewerUsername])

  useEffect(() => {
    void loadReferences()
  }, [loadReferences])

  useEffect(() => {
    if (activeTab !== 'Media') return
    let cancelled = false
    void (async () => {
      setJournalLoading(true)
      try {
        const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/journal`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (!r.ok) {
          setJournalArticles([])
          return
        }
        const data = (await r.json()) as { items?: ApiEducationArticle[] }
        const items = Array.isArray(data.items) ? data.items : []
        setJournalArticles(
          viewerIsSelf ? items : items.filter((a) => a.publicationStatus === 'PUBLISHED'),
        )
      } catch {
        if (!cancelled) setJournalArticles([])
      } finally {
        if (!cancelled) setJournalLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, username, viewerIsSelf])

  useEffect(() => {
    setConnectNotice(null)
  }, [username])

  useEffect(() => {
    if (!connectNotice || connectNotice.kind !== 'success') return
    const timer = window.setTimeout(() => setConnectNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [connectNotice])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    void (async () => {
      const data = await fetchUserEcosystem(username)
      if (!cancelled) setEcosystem(data)
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  const loadPublicProfile = useCallback(async () => {
    if (!username) return
    setApiProfileStatus('loading')
    try {
      const r = await fetch(`/api/profile/${encodeURIComponent(username)}`, { credentials: 'include' })
      if (r.status === 404) {
        setPublicProfile(null)
        setApiProfileStatus('missing')
        return
      }
      if (!r.ok) {
        setPublicProfile(null)
        setApiProfileStatus('idle')
        return
      }
      const data = (await r.json()) as {
        user: { id: string; username: string; memberSince?: string }
        profile: {
          bio: string | null
          displayName: string | null
          location: string | null
          roles: string[] | null
          sexuality: string | null
        } | null
        kinks?: {
          kinkTagId: string
          interestStatus: string
          note: string | null
          slug: string
          displayName: string
        }[]
        iso?: ProfileIsoPayload
        photos?: {
          id: string
          url: string
          caption: string | null
          order: number
          displaySettings?: unknown
          mediaAssetId?: string | null
          uploadStatus?: string | null
          contentRating?: string | null
          visibility?: string | null
          isBlurredByDefault?: boolean
        }[]
        connectionsSummary?: ProfileConnectionsSummary
        followsSummary?: ProfileFollowsSummary
        mutualConnections?: ProfileMutualConnections
      }
      setPublicProfile({
        user: data.user,
        profile: data.profile,
        kinks: data.kinks,
        iso: data.iso,
        photos: data.photos,
        connectionsSummary: data.connectionsSummary,
        followsSummary: data.followsSummary,
        mutualConnections: data.mutualConnections,
      })
      setApiProfileStatus('ok')
    } catch {
      setPublicProfile(null)
      setApiProfileStatus('idle')
    }
  }, [username])

  useEffect(() => {
    void loadPublicProfile()
  }, [loadPublicProfile])

  useEffect(() => {
    const onPrivacySaved = () => void loadPublicProfile()
    const onProfileSaved = () => void loadPublicProfile()
    window.addEventListener('c2k:profile-privacy-saved', onPrivacySaved)
    window.addEventListener('c2k:profile-saved', onProfileSaved)
    return () => {
      window.removeEventListener('c2k:profile-privacy-saved', onPrivacySaved)
      window.removeEventListener('c2k:profile-saved', onProfileSaved)
    }
  }, [loadPublicProfile])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/profile/${encodeURIComponent(username)}/relationships`, {
          credentials: 'include',
        })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { relationships?: PublicRelationshipItem[] }
        if (!cancelled) setPublicRelationships(data.relationships ?? [])
      } catch {
        if (!cancelled) setPublicRelationships([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    if (username !== viewerUsername) return
    if (apiProfileStatus === 'ok') return
    if (isAuthenticated && !isFallback) return
    try {
      const raw = localStorage.getItem('c2k_profile_photos_mock')
      setStoredPhotos(raw ? JSON.parse(raw) : null)
    } catch {
      setStoredPhotos(null)
    }
  }, [username, viewerUsername, apiProfileStatus, isAuthenticated, isFallback])

  const offerReference = useCallback(async () => {
    if (!viewerUsername || username === viewerUsername || !isAuthenticated) return
    const note = refNote.trim()
    const res = await fetch('/api/v1/profile/references', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectUsername: username,
        category: refCategory,
        note: note.length > 0 ? note : undefined,
      }),
    })
    if (res.ok) {
      setRefNote('')
      await loadReferences()
    }
  }, [username, refNote, refCategory, viewerUsername, isAuthenticated, loadReferences])

  const respondIncoming = useCallback(
    async (id: string, action: 'accept' | 'decline') => {
      const r = await fetch(`/api/v1/profile/references/${id}/${action === 'accept' ? 'accept' : 'decline'}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) await loadReferences()
    },
    [loadReferences]
  )

  const apiBackedPublicProfile = Boolean(publicProfile?.profile)

  const profile = useMemo(() => {
    const apiP = publicProfile?.profile
    if (apiBackedPublicProfile && publicProfile && apiP) {
      return {
        username: publicProfile.user.username,
        displayName: apiP.displayName?.trim() || publicProfile.user.username,
        location: apiP.location?.trim() || '',
        roles: apiP.roles ?? [],
        badges: (profileData?.badges ?? []) as BadgeId[],
        sexuality: apiP.sexuality ?? undefined,
        sexualOrientations: apiP.sexualOrientations ?? [],
        romanticOrientations: apiP.romanticOrientations ?? [],
        genders: apiP.genders ?? [],
        lifestyleActivity: apiP.lifestyleActivity?.trim() || undefined,
        lookingFor: apiP.lookingFor ?? [],
        pronouns: formatPronounDisplay(apiP.pronounTags ?? (apiP.pronouns ? [apiP.pronouns] : null)) || undefined,
        ageLabel: apiP.age != null ? String(apiP.age) : undefined,
        bio: apiP.bio ?? '',
      }
    }
    if (profileData && (!isAuthenticated || isFallback)) {
      return {
        username: profileData.username,
        displayName: profileData.username,
        location: profileData.location ?? '',
        roles: profileData.roles,
        badges: profileData.badges ?? [],
        sexuality: profileData.sexuality,
        bio: profileData.bio ?? '',
      }
    }
    return {
      username,
      displayName: username,
      location: '',
      roles: [] as string[],
      badges: [] as BadgeId[],
      sexuality: undefined,
      bio: '',
    }
  }, [apiBackedPublicProfile, publicProfile, profileData, username, isAuthenticated, isFallback])

  const mediaViewer = useMemo(
    () => ({
      authenticated: isAuthenticated && !isFallback,
      adultContentPref:
        isAuthenticated && !isFallback
          ? adultContentPref.preference
          : ADULT_CONTENT_PREFERENCES.blur,
    }),
    [isAuthenticated, isFallback, adultContentPref.preference]
  )

  const displayPhotos = useMemo((): ProfileGalleryPhoto[] => {
    if (apiProfileStatus === 'ok' && publicProfile) {
      return (publicProfile.photos ?? []).map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption ?? undefined,
        order: p.order,
        displaySettings: normalizeProfilePhotoDisplaySettings(p.displaySettings),
        mediaAssetId: p.mediaAssetId,
        uploadStatus: p.uploadStatus as ProfileGalleryPhoto['uploadStatus'],
        contentRating: p.contentRating as ProfileGalleryPhoto['contentRating'],
        visibility: p.visibility as ProfileGalleryPhoto['visibility'],
        isBlurredByDefault: p.isBlurredByDefault,
      }))
    }
    if (apiProfileStatus !== 'ok' && username === viewerUsername && storedPhotos && (!isAuthenticated || isFallback)) {
      return storedPhotos
    }
    if (apiProfileStatus !== 'ok' && profileData) {
      return profileData.profilePhotos ?? []
    }
    return []
  }, [apiProfileStatus, publicProfile, username, viewerUsername, storedPhotos, profileData, isAuthenticated, isFallback])

  const primaryPhoto = pickPrimaryProfilePhoto(displayPhotos) ?? displayPhotos[0]
  const primaryPhotoBlurred =
    primaryPhoto &&
    !viewerIsSelf &&
    shouldBlurMediaForViewer(mediaViewer, {
      contentRating: primaryPhoto.contentRating ?? null,
      visibility: primaryPhoto.visibility ?? null,
      uploadStatus: primaryPhoto.uploadStatus ?? null,
      isBlurredByDefault: primaryPhoto.isBlurredByDefault ?? false,
    })
  const primaryPhotoUrl =
    primaryPhoto && !primaryPhotoBlurred && primaryPhoto.url?.trim() ? primaryPhoto.url : undefined
  const primaryPhotoCaption = primaryPhotoUrl ? primaryPhoto?.caption : undefined
  const primaryPhotoDisplaySettings =
    primaryPhotoUrl ? primaryPhoto?.displaySettings : undefined

  const serverKinks = publicProfile?.kinks ?? []
  const journalPublished = useMemo(
    () => journalArticles.filter((a) => a.publicationStatus === 'PUBLISHED'),
    [journalArticles],
  )
  const isoPayload = publicProfile?.iso
  const publicIsoVisible = Boolean(
    isoPayload?.body?.trim() &&
      (isoPayload.visibility === 'public' ||
        (isoPayload.visibility !== 'private' && isAuthenticated)),
  )

  const connectionsSummary = publicProfile?.connectionsSummary
  const followsSummary = publicProfile?.followsSummary
  const mutualConnections = publicProfile?.mutualConnections

  const tabVisibility = useMemo(
    () => ({
      viewerIsOwner: viewerIsSelf,
      isAuthenticated,
      hasRelationships: publicRelationships.length > 0,
      hasConnections:
        viewerIsSelf ||
        Boolean(connectionsSummary?.listVisible && (connectionsSummary?.totalCount ?? 0) > 0),
      hasEventHistory: false,
      hasMedia: journalPublished.length > 0 || displayPhotos.length > 0,
      hasReviews: displayReferences.length > 0,
      hasIso: publicIsoVisible,
    }),
    [
      viewerIsSelf,
      isAuthenticated,
      publicRelationships.length,
      journalPublished.length,
      displayPhotos.length,
      displayReferences.length,
      publicIsoVisible,
      connectionsSummary?.listVisible,
      connectionsSummary?.totalCount,
    ],
  )

  const profileTabCounts = useMemo((): PublicProfileTabCounts | undefined => {
    const count = connectionsSummary?.totalCount
    if (count == null) return undefined
    return { Community: count }
  }, [connectionsSummary?.totalCount])

  const communityVisibleSections = useMemo((): CommunitySection[] => {
    if (viewerIsSelf) return ['relationships', 'connections', 'feedback']
    const sections: CommunitySection[] = []
    if (publicRelationships.length > 0) sections.push('relationships')
    if (connectionsSummary?.listVisible && (connectionsSummary?.totalCount ?? 0) > 0) {
      sections.push('connections')
    }
    if (displayReferences.length > 0) sections.push('feedback')
    return sections
  }, [
    viewerIsSelf,
    publicRelationships.length,
    connectionsSummary?.listVisible,
    connectionsSummary?.totalCount,
    displayReferences.length,
  ])

  const visibleTabs = useMemo(
    () => getVisiblePublicProfileTabs(tabVisibility),
    [tabVisibility],
  )

  useEffect(() => {
    if (apiProfileStatus === 'loading') return
    if (apiProfileStatus === 'missing' && !profileData) return
    if (!visibleTabs.includes(activeTab)) {
      selectTab(visibleTabs[0] ?? DEFAULT_PUBLIC_PROFILE_TAB)
    }
  }, [visibleTabs, activeTab, selectTab, apiProfileStatus, profileData])

  if (apiProfileStatus === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" role="status">
        <div className="rounded-2xl border border-dc-border overflow-hidden">
          <div className="h-44 animate-pulse bg-dc-elevated-muted" />
          <div className="px-6 pb-6 -mt-16 flex gap-4">
            <div className="h-28 w-28 rounded-full animate-pulse bg-dc-elevated-muted shrink-0" />
            <div className="flex-1 space-y-3 pt-8">
              <div className="h-9 w-48 animate-pulse rounded-lg bg-dc-elevated-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-dc-elevated-muted" />
              <div className="h-11 w-56 animate-pulse rounded-xl bg-dc-elevated-muted" />
            </div>
          </div>
        </div>
        <div className="mt-6 h-12 animate-pulse rounded-xl bg-dc-elevated-muted" />
        <div className="mt-6 flex gap-8">
          <div className="flex-1 h-64 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          <div className="hidden lg:block w-72 h-64 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        </div>
      </div>
    )
  }

  if (apiProfileStatus === 'missing' && !profileData) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          message={`No profile found for @${username}.`}
          ctaLabel="Find people"
          ctaHref="/people"
          secondaryCtaLabel="Home"
          secondaryCtaHref="/home"
        />
      </div>
    )
  }

  const profileHeroActions = (
    <ProfileViewerActions
      username={username}
      viewerUsername={viewerUsername}
      apiBacked={apiBackedPublic}
      graphStatus={graphStatus}
      connectBusy={connectBusy}
      graphBusy={graphBusy}
      connectNotice={connectNotice}
      isAuthenticated={isAuthenticated}
      onConnect={() => void sendConnectionRequest()}
      onToggleFollow={() => void toggleFollow()}
      onDismissConnectNotice={() => setConnectNotice(null)}
      mutualConnectionsCount={connectionsSummary?.mutualCount ?? undefined}
      canMessage={!viewerIsSelf && (graphStatus?.canMessage === true)}
    />
  )

  const profileSelfNotice =
    viewerIsSelf ?
      <p
        className="mb-6 rounded-2xl bg-dc-accent/[0.06] px-4 py-3.5 text-sm leading-relaxed text-dc-text-muted ring-1 ring-inset ring-dc-accent/15"
        role="status"
      >
        You are viewing your <strong className="text-dc-text">public profile</strong>. What others see on Kink Social.
      </p>
    : null

  const profileHero = (
    <ProfileHero
      displayName={profile.displayName}
      username={profile.username}
      ageLabel={'ageLabel' in profile ? profile.ageLabel : undefined}
      pronouns={'pronouns' in profile ? profile.pronouns : undefined}
      genders={'genders' in profile ? profile.genders : undefined}
      sexualOrientations={'sexualOrientations' in profile ? profile.sexualOrientations : undefined}
      romanticOrientations={'romanticOrientations' in profile ? profile.romanticOrientations : undefined}
      location={profile.location}
      roles={profile.roles}
      photoUrl={primaryPhotoUrl ?? undefined}
      photoCaption={primaryPhotoCaption ?? undefined}
      photoDisplaySettings={primaryPhotoDisplaySettings ?? undefined}
      photoCount={displayPhotos.length}
      onOpenGallery={viewerIsSelf || displayPhotos.length > 0 ? openPhotoGallery : undefined}
      managePhotosHref={viewerIsSelf ? '/profile/edit' : undefined}
      actions={profileHeroActions}
    />
  )

  const profileGallery = (
    <ProfileGalleryStrip
      photos={displayPhotos}
      viewer={mediaViewer}
      totalCount={displayPhotos.length}
      onViewAll={viewerIsSelf ? undefined : openPhotoGallery}
      managePhotosHref={viewerIsSelf ? '/profile/edit' : undefined}
      viewerIsOwner={viewerIsSelf}
    />
  )

  const profilePrimary = (
    <>
      <ProfileAboutBlock bio={profile.bio || null} viewerIsOwner={viewerIsSelf} />
      <ProfileInterestsCard kinks={serverKinks} viewerIsOwner={viewerIsSelf} />
      <ProfileLookingForCard
        lookingFor={publicProfile?.profile?.lookingFor ?? []}
        viewerIsOwner={viewerIsSelf}
      />
      {showProfilePosts ?
        <ProfileRecentPostsSection
          viewerIsOwner={viewerIsSelf}
          viewerUsername={viewerUsername}
          profileUsername={username}
          items={profileFeedPosts.items}
          status={profileFeedPosts.status}
          error={profileFeedPosts.error}
          onRetry={() => void profileFeedPosts.reload()}
          graphStatus={viewerIsSelf ? null : graphStatus}
          canMessage={!viewerIsSelf && (graphStatus?.canMessage === true)}
          onFollow={viewerIsSelf ? undefined : () => void toggleFollow()}
          onConnect={viewerIsSelf ? undefined : () => void sendConnectionRequest()}
        />
      : null}
    </>
  )

  const profileSecondary = (
    <>
      <ProfileNetworkCard
        username={username}
        viewerIsOwner={viewerIsSelf}
        connections={connectionsSummary}
        follows={followsSummary}
        mutualConnections={mutualConnections}
        onViewConnections={
          !viewerIsSelf && connectionsSummary?.listVisible ?
            () => selectTab('Community', 'connections')
          : undefined
        }
      />
      <ProfileUpcomingEventsCard ecosystem={ecosystem} username={username} viewerIsOwner={viewerIsSelf} />
      <ProfileOrganizationsCard ecosystem={ecosystem} username={username} />
      <ProfileCommunitySnapshotCard
        ecosystem={ecosystem}
        memberSince={publicProfile?.user.memberSince}
        roles={profile.roles}
        lifestyleActivity={'lifestyleActivity' in profile ? profile.lifestyleActivity : undefined}
        eventsAttended={0}
      />
    </>
  )

  const profileMore = (
    <>
      <ProfileExtendedSection
        viewerIsOwner={viewerIsSelf}
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
                  <ProfileRelationshipsList relationships={publicRelationships} title="Relationships & D/s" />
                }
                connections={
                  <ProfileConnectionsTab
                    username={username}
                    listVisible={viewerIsSelf || (connectionsSummary?.listVisible ?? false)}
                    totalCount={connectionsSummary?.totalCount ?? 0}
                    mutualCount={connectionsSummary?.mutualCount ?? null}
                    viewerIsOwner={viewerIsSelf}
                  />
                }
                feedback={
                  <ProfileReviewsTab
                    viewerIsOwner={viewerIsSelf}
                    username={username}
                    viewerUsername={viewerUsername}
                    isAuthenticated={isAuthenticated}
                    references={displayReferences}
                    incoming={incoming}
                    loading={refLoading}
                    viewerHasPendingOrAccepted={viewerHasPendingOrAccepted}
                    refCategory={refCategory}
                    refNote={refNote}
                    refNoteId={refNoteId}
                    onRefCategoryChange={setRefCategory}
                    onRefNoteChange={setRefNote}
                    onOfferReference={() => void offerReference()}
                    onRespondIncoming={(id, action) => void respondIncoming(id, action)}
                  />
                }
              />
            )}

            {activeTab === 'Media' && (
              <ProfileMediaTabPanel
                id={PROFILE_MEDIA_GALLERY_ID}
                username={username}
                apiBacked={apiBackedPublicProfile}
                viewerIsOwner={viewerIsSelf}
                mediaViewer={mediaViewer}
                writing={
                  <ProfileWritingTab
                    viewerIsOwner={viewerIsSelf}
                    loading={journalLoading}
                    unavailable={false}
                    articles={journalArticles}
                    teachingCredits={[]}
                    formatTeachingDate={formatTeachingCreditDate}
                  />
                }
                profilePhotosSlot={
                  viewerIsSelf && isAuthenticated && !isFallback ?
                    <ProfilePhotoManager apiBacked embedded onPhotosChanged={() => void loadPublicProfile()} />
                  : displayPhotos.length === 0 ?
                    <EmptyState title="No photos" message="This member has not shared profile photos." inline compact className="text-left" />
                  : <ProfilePhotoGallery
                      photos={displayPhotos}
                      viewer={mediaViewer}
                      onReportPhoto={
                        isAuthenticated && username !== viewerUsername
                          ? (photo) => {
                              if (photo.mediaAssetId) {
                                setPhotoReportOpen({
                                  targetType: 'media_asset',
                                  targetId: photo.mediaAssetId,
                                  label: `photo on @${username}`,
                                })
                                return
                              }
                              setPhotoReportOpen({
                                targetType: 'profile_photo',
                                targetId: photo.id,
                                label: `photo on @${username}`,
                              })
                            }
                          : undefined
                      }
                    />
                }
              />
            )}

            {activeTab === 'ISO' && publicProfile?.user && (
              <ProfileIsoTab
                viewerIsOwner={viewerIsSelf}
                isAuthenticated={isAuthenticated}
                iso={publicProfile.iso}
                username={publicProfile.user.username}
                userId={publicProfile.user.id}
              />
            )}
        </ProfileExtendedSection>
    </>
  )

  const profileFooter =
    publicProfile?.user && username !== viewerUsername ?
      <p className="text-xs text-dc-muted">
        <button
          type="button"
          onClick={() =>
            setReportOpen({
              targetType: 'profile',
              targetId: publicProfile.user.id,
              label: `@${username}`,
            })
          }
          className="text-dc-accent hover:underline"
        >
          Report profile
        </button>
        <span className="mx-2">·</span>
        <Link to="/support" className="text-dc-accent hover:underline">
          Support center
        </Link>
      </p>
    : null

  return (
    <>
      <ProfileLayout
        alerts={profileSelfNotice}
        hero={profileHero}
        gallery={profileGallery}
        primary={profilePrimary}
        secondary={profileSecondary}
        more={profileMore}
        footer={profileFooter}
      />
      <TsReportModal open={reportOpen} onClose={() => setReportOpen(null)} />
      <TsReportModal open={photoReportOpen} onClose={() => setPhotoReportOpen(null)} />
    </>
  )
}
