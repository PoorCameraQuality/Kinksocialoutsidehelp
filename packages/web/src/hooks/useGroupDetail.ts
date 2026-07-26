import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  getMockChannelsForGroup,
  getMockEventsForGroup,
  getMockGroupById,
  getMockGroupBySlug,
  getMockGroupMembers,
  getMockPhotosForGroup,
  getMockPendingPhotosByAuthor,
  getMockPendingPhotosForGroup,
  getMockResourcesForGroup,
} from '@/data/mock-data'
import { useAuth, useViewerUsername } from '@/contexts/AuthContext'
import {
  allowMockGroupExperience,
  shouldFetchApiGroupDetail,
} from '@/lib/group-detail-guards'
import type { GroupRole } from '@/data/mock-data'
import type { MockGroup, MockGroupChannel, MockGroupMember, MockEvent, MockGroupPhoto, MockResource } from '@/data/mock-data'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import { mapApiEventToMockEvent } from '@/lib/api-event-mapper'
import { parseGroupRules, type GroupRule } from '@c2k/shared'

type ApiGroupDetail = {
  group: MockGroup
  members: MockGroupMember[]
  parentOrganization: { slug: string; displayName: string } | null
  leadershipVoteOpen: boolean
  groupOwnerId: string
  viewerMember?: {
    userId: string
    username: string
    role: string
    memberListVisibility?: 'visible' | 'hidden'
    showGroupOnProfile?: boolean
    announceGroupJoinInFeed?: boolean
  } | null
  staffHiddenMemberCount?: number
}

export interface UseGroupDetailReturn {
  group: MockGroup | null
  channels: MockGroupChannel[]
  members: MockGroupMember[]
  events: MockEvent[]
  photos: MockGroupPhoto[]
  pendingPhotos: MockGroupPhoto[]
  myPendingPhotos: MockGroupPhoto[]
  resources: MockResource[]
  viewerRole: GroupRole | undefined
  canManage: boolean
  canModerate: boolean
  isMember: boolean
  /** True while fetching `/api/v1/groups/:id` for a UUID route param */
  detailLoading: boolean
  /** Fetch failed (non-404) for UUID group */
  detailError: boolean
  /** API returned 404 for UUID group */
  detailNotFound: boolean
  refreshDetail: () => void
  /** UUID group loaded from API (join/leave use REST) */
  apiBacked: boolean
  /** Set when API group has `organizationId` and org row exists. */
  parentOrganization: { slug: string; displayName: string } | null
  /** From API `groups.leadership_vote_open` (dormancy flow). */
  leadershipVoteOpen: boolean
  /** `groups.owner_id` when API-backed. */
  groupOwnerId: string | null
  /** Viewer membership privacy fields when API-backed. */
  viewerMembership: ApiGroupDetail['viewerMember']
  /** Staff-only count of hidden regular members. */
  staffHiddenMemberCount: number
  /** True while fetching group events list (API-backed UUID groups). */
  /** Demo slug/id group blocked for signed-in real users (mock exists but gated). */
  mockPreviewBlocked: boolean
  eventsLoading: boolean
  refreshPhotos: () => void
  refreshChannels: () => void
  refreshResources: () => void
  refreshMembers: () => void
}

export function useGroupDetail(groupIdOrSlug: string | undefined): UseGroupDetailReturn {
  const { isAuthenticated } = useAuth()
  const viewerUsername = useViewerUsername()
  const [photosRefreshKey, setPhotosRefreshKey] = useState(0)
  const [channelsRefreshKey, setChannelsRefreshKey] = useState(0)
  const [resourcesRefreshKey, setResourcesRefreshKey] = useState(0)
  const [membersRefreshKey, setMembersRefreshKey] = useState(0)
  const [apiRefreshKey, setApiRefreshKey] = useState(0)
  const [apiMode, setApiMode] = useState<'idle' | 'loading' | 'ready' | 'error' | 'missing'>('idle')
  const [apiDetail, setApiDetail] = useState<ApiGroupDetail | null>(null)
  const [apiEvents, setApiEvents] = useState<MockEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)

  const fetchApiDetail = shouldFetchApiGroupDetail(groupIdOrSlug, isAuthenticated)
  const allowMock = allowMockGroupExperience(isAuthenticated)

  useEffect(() => {
    if (!groupIdOrSlug || !fetchApiDetail) {
      setApiMode('idle')
      setApiDetail(null)
      return
    }
    let cancelled = false
    setApiMode('loading')
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupIdOrSlug)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) {
            setApiMode(r.status === 404 ? 'missing' : 'error')
            setApiDetail(null)
          }
          return
        }
        const data = (await r.json()) as {
          group: {
            id: string
            name: string
            slug: string
            visibility: string
            ownerId: string
            createdAt: string
            category?: string | null
            tags?: string[] | null
            description?: string | null
            leadershipVoteOpen?: boolean
            bannerUrl?: string | null
            logoUrl?: string | null
            shareImageUrl?: string | null
            placeLabel?: string | null
            rules?: GroupRule[]
          }
          parentOrganization?: { slug: string; displayName: string } | null
          members: Array<{
            groupId: string
            userId: string
            username: string
            role: string
            joinedAt: string
            memberListHidden?: boolean
          }>
          viewerMember?: ApiGroupDetail['viewerMember']
          staffHiddenMemberCount?: number
        }
        if (cancelled) return
        const vis =
          data.group.visibility === 'private'
            ? 'private'
            : data.group.visibility === 'invite-only'
              ? 'invite-only'
              : 'public'
        const mockGroup: MockGroup = {
          id: data.group.id,
          name: data.group.name,
          members: data.members.length,
          slug: data.group.slug,
          visibility: vis,
          category: data.group.category ?? null,
          description: data.group.description ?? undefined,
          tags: data.group.tags ?? undefined,
          coverImageUrl: data.group.bannerUrl ?? null,
          logoUrl: data.group.logoUrl ?? null,
          shareImageUrl: data.group.shareImageUrl ?? null,
          placeLabel: data.group.placeLabel ?? null,
          location: data.group.placeLabel ?? undefined,
          rules: (() => {
            const rules = parseGroupRules(data.group.rules)
            return rules.length > 0 ? rules : undefined
          })(),
        }
        const mockMembers: MockGroupMember[] = data.members.map((m) => ({
          groupId: m.groupId,
          userId: m.userId,
          username: m.username,
          role: m.role as GroupRole,
          joinedAt: m.joinedAt,
          ...(m.memberListHidden ? { memberListHidden: true } : {}),
        }))
        setApiDetail({
          group: mockGroup,
          members: mockMembers,
          parentOrganization: data.parentOrganization ?? null,
          leadershipVoteOpen: Boolean(data.group.leadershipVoteOpen),
          groupOwnerId: data.group.ownerId,
          viewerMember: data.viewerMember ?? null,
          staffHiddenMemberCount: data.staffHiddenMemberCount ?? 0,
        })
        setApiMode('ready')
      } catch {
        if (!cancelled) {
          setApiMode('error')
          setApiDetail(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupIdOrSlug, apiRefreshKey, fetchApiDetail])

  useEffect(() => {
    const apiGroupId = apiDetail?.group.id ?? groupIdOrSlug
    if (!apiGroupId || !fetchApiDetail || apiMode !== 'ready') {
      setApiEvents([])
      setEventsLoading(false)
      return
    }
    let cancelled = false
    setEventsLoading(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events?groupId=${encodeURIComponent(apiGroupId)}`, {
          credentials: 'include',
        })
        if (!r.ok) {
          if (!cancelled) setApiEvents([])
          return
        }
        const d = (await r.json()) as { items?: ApiEventListItem[] }
        if (!cancelled) {
          setApiEvents((d.items ?? []).map((row) => mapApiEventToMockEvent(row)))
        }
      } catch {
        if (!cancelled) setApiEvents([])
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupIdOrSlug, apiDetail?.group.id, apiMode, eventsRefreshKey, fetchApiDetail])

  const rawMockGroup = useMemo(() => {
    if (!groupIdOrSlug) return null
    return getMockGroupById(groupIdOrSlug) ?? getMockGroupBySlug(groupIdOrSlug) ?? null
  }, [groupIdOrSlug])

  const mockGroup = allowMock ? rawMockGroup : null

  const group = useMemo(() => {
    if (!groupIdOrSlug) return null
    if (fetchApiDetail && apiMode === 'ready' && apiDetail) return apiDetail.group
    if (fetchApiDetail && (apiMode === 'loading' || apiMode === 'error' || apiMode === 'missing')) return null
    return mockGroup
  }, [groupIdOrSlug, fetchApiDetail, apiMode, apiDetail, mockGroup])

  const apiBacked = fetchApiDetail && apiMode === 'ready' && !!apiDetail
  const mockPreviewBlocked = fetchApiDetail && apiMode === 'missing' && !allowMock && !!rawMockGroup

  const refreshPhotos = useCallback(() => setPhotosRefreshKey((k) => k + 1), [])
  const refreshChannels = useCallback(() => setChannelsRefreshKey((k) => k + 1), [])
  const refreshResources = useCallback(() => setResourcesRefreshKey((k) => k + 1), [])
  const refreshMembers = useCallback(() => {
    setMembersRefreshKey((k) => k + 1)
    if (groupIdOrSlug && fetchApiDetail) {
      setApiRefreshKey((k) => k + 1)
    }
  }, [groupIdOrSlug, fetchApiDetail])

  const refreshDetail = useCallback(() => {
    if (groupIdOrSlug && fetchApiDetail) {
      setApiRefreshKey((k) => k + 1)
      setEventsRefreshKey((k) => k + 1)
    }
  }, [groupIdOrSlug, fetchApiDetail])

  const members = useMemo(() => {
    if (!group) return []
    if (apiBacked && apiDetail) return apiDetail.members
    return getMockGroupMembers(group.id)
  }, [group, apiBacked, apiDetail, membersRefreshKey])

  const channels = useMemo(() => {
    if (!group || apiBacked) return []
    return getMockChannelsForGroup(group.id)
  }, [group, apiBacked, channelsRefreshKey])

  const events = useMemo(() => {
    if (!group) return []
    if (apiBacked) return apiEvents
    return getMockEventsForGroup(group.id)
  }, [group, apiBacked, apiEvents])

  const photos = useMemo(() => {
    if (!group || apiBacked) return []
    return getMockPhotosForGroup(group.id)
  }, [group, apiBacked, photosRefreshKey])

  const pendingPhotos = useMemo(() => {
    if (!group || apiBacked) return []
    return getMockPendingPhotosForGroup(group.id)
  }, [group, apiBacked, photosRefreshKey])

  const myPendingPhotos = useMemo(() => {
    if (!group || apiBacked || !viewerUsername) return []
    return getMockPendingPhotosByAuthor(group.id, viewerUsername)
  }, [group, apiBacked, photosRefreshKey, viewerUsername])

  const resources = useMemo(() => {
    if (!group || apiBacked) return []
    return getMockResourcesForGroup(group.id)
  }, [group, apiBacked, resourcesRefreshKey])

  const viewerMember = group && viewerUsername ? members.find((m) => m.username === viewerUsername) : undefined
  const viewerRole: GroupRole | undefined = viewerMember?.role
  const canManage = viewerRole === 'owner' || viewerRole === 'admin'
  const canModerate = canManage || viewerRole === 'moderator'
  const isMember = !!viewerMember

  const detailLoading = fetchApiDetail && apiMode === 'loading'
  const detailError = fetchApiDetail && apiMode === 'error'
  const detailNotFound = fetchApiDetail && apiMode === 'missing' && !rawMockGroup

  const parentOrganization =
    apiBacked && apiDetail ? apiDetail.parentOrganization : null

  const leadershipVoteOpen = apiBacked && apiDetail ? apiDetail.leadershipVoteOpen : false
  const groupOwnerId = apiBacked && apiDetail ? apiDetail.groupOwnerId : null
  const viewerMembership = apiBacked && apiDetail ? (apiDetail.viewerMember ?? null) : null
  const staffHiddenMemberCount = apiBacked && apiDetail ? (apiDetail.staffHiddenMemberCount ?? 0) : 0

  return {
    group,
    channels,
    members,
    events,
    photos,
    pendingPhotos,
    myPendingPhotos,
    resources,
    viewerRole,
    canManage,
    canModerate,
    isMember,
    detailLoading,
    detailError,
    detailNotFound,
    refreshDetail,
    apiBacked,
    parentOrganization,
    leadershipVoteOpen,
    groupOwnerId,
    viewerMembership,
    staffHiddenMemberCount,
    mockPreviewBlocked,
    eventsLoading,
    refreshPhotos,
    refreshChannels,
    refreshResources,
    refreshMembers,
  }
}
