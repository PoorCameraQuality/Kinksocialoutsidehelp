import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import OrgCommunityShell from '@/components/org/OrgCommunityShell'
import { OrgHubAboutTab } from '@/components/org/hub/OrgHubAboutTab'
import { OrgHubCalendarTab } from '@/components/org/hub/OrgHubCalendarTab'
import ScopeEmailSignupForm from '@/components/email/ScopeEmailSignupForm'
import ScopePageMeta from '@/components/seo/ScopePageMeta'
import OrgCommunityModules, {
  OrgAnnouncementsBlock,
  OrgContactsBlock,
  OrgDocumentsBlock,
  OrgFeaturedVendorsBlock,
  OrgVolunteerBlock,
} from '@/components/org/OrgCommunityModules'
import OrgAnchorAttendeesCard from '@/components/org/OrgAnchorAttendeesCard'
import OrgVoicePanel from '@/components/org/OrgVoicePanel'
import OrgDiscordEmbedPanel from '@/components/org/OrgDiscordEmbedPanel'
import OrgHubVenueEvents, { isVenueListing } from '@/components/places/OrgHubVenueEvents'
import ForumPostList from '@/components/forum/ForumPostList'
import ForumThreadReplyComposer from '@/components/forum/ForumThreadReplyComposer'
import ReportAction from '@/components/moderation/ReportAction'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { resolvePublicSeedDisplayUrl } from '@/lib/public-seed-url'
import { orgModeratorUserIds } from '@/lib/forum/forumPostDisplay'
import { useTabFromUrl } from '@/hooks/useTabFromUrl'
import {
  orgChannelMessageTarget,
  orgForumPostTarget,
  orgForumThreadTarget,
  organizationTarget,
} from '@/lib/moderation/report-targets'
import {
  calendarApiFailureKind,
  mergeCalendarLoadState,
  type OrgCalendarLoadState,
} from '@/lib/org-calendar-fetch'
import type { CommunityPageModule } from '@/types/org-community-modules'

const ORG_TABS = ['Overview', 'Calendar', 'Forums', 'Chat', 'About', 'FAQ', 'Subgroups', 'Documents'] as const

function orgMediaDisplayUrl(url: string | null | undefined): string | undefined {
  return resolvePublicSeedDisplayUrl(url)
}

/** Stable per-username hue for Discord-style name colors and avatars. */
function usernameToHue(username: string): number {
  let h = 0
  for (let i = 0; i < username.length; i++) h = (h + username.charCodeAt(i) * (i + 7)) % 360
  return h
}

function formatChatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Short relative time for forum thread list / posts (Reddit-style). */
function formatForumRelativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 45_000) return 'just now'
  const m = Math.floor(diffMs / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function orgChatChannelPrefix(kind: string): ReactNode {
  if (kind === 'VOICE' || kind === 'VIDEO' || kind === 'LIVE_STREAM') {
    return (
      <span className="w-5 shrink-0 text-center text-sm text-zinc-500" title={kind}>
        🔊
      </span>
    )
  }
  if (kind === 'DISCORD') {
    return (
      <span className="w-5 shrink-0 text-center text-[10px] font-bold text-[#949cf7]" title="Discord">
        DC
      </span>
    )
  }
  return (
    <span className="w-5 shrink-0 text-center font-mono text-lg font-light leading-none text-zinc-500">#</span>
  )
}

/** Venue / play-space etiquette belongs on event pages, not the org overview. */
function isDeprecatedOrgVenueEtiquetteModule(m: CommunityPageModule): boolean {
  if (m.type !== 'richtext') return false
  if (m.id === 'house-rules') return true
  const t = (m.title ?? '').toLowerCase()
  if ((t.includes('play-space') || t.includes('play space')) && t.includes('etiquette')) return true
  if (t.includes('house') && t.includes('play') && t.includes('etiquette')) return true
  const html = m.html.toLowerCase()
  if (html.includes('dungeon monitors') && html.includes('red/yellow/green')) return true
  return false
}

const ORG_OVERVIEW_ACTIVITY_PREVIEW = 4

/** Checklist (“first week”) first in the main column; other module types keep their relative order. */
function sortOverviewCommunityModules(mods: CommunityPageModule[]): CommunityPageModule[] {
  const tier = (m: CommunityPageModule) => {
    if (m.type === 'checklist') return 0
    return 1
  }
  return [...mods]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const ta = tier(a.m)
      const tb = tier(b.m)
      if (ta !== tb) return ta - tb
      return a.i - b.i
    })
    .map(({ m }) => m)
}

const ORG_GROUP_CHAT_DISCLAIMER =
  'While we secure one-to-one messages, organization group chats are not private. Only discuss what you are comfortable with moderators, admins, and owners seeing. For sensitive topics, use DMs or a private group chat.'

function isMembersJoinPreview(org: Pick<OrgDetail, 'visibility' | 'isMember'>): boolean {
  return org.visibility === 'MEMBERS' && !org.isMember
}

function MembersJoinCommunityGate({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="rounded-xl border border-dc-accent-border/35 bg-dc-accent/5 px-4 py-8 text-center">
      <p className="text-sm font-medium text-dc-text">Join to see full community.</p>
      <p className="mt-1 text-sm text-dc-text-muted">Forums and chat are available to members after you join.</p>
      <button
        type="button"
        onClick={onJoin}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
      >
        Join organization
      </button>
    </div>
  )
}

type OrgReviewRow = {
  id: string
  rating: number
  body: string | null
  createdAt: string
  authorId: string
  username: string
}

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  subgroupsEnabled: boolean
  chatEnabled: boolean
  externalEmbedEnabled: boolean
  listingKind?: 'community' | 'venue' | 'dungeon'
  eckeDungeonListing?: boolean
}

type OrgCommunity = {
  welcomeHtml?: string | null
  faq?: { q: string; a: string }[]
  links?: { label: string; url: string }[]
  spotlightGroupId?: string | null
  recapThreadId?: string | null
  lastEventRecapUrl?: string | null
  /** Ordered customizable Overview sections (API-validated). */
  communityModules?: CommunityPageModule[] | null
  emailListEnabled?: boolean
  emailListHeadline?: string | null
  emailListBlurb?: string | null
}

type OrgDetail = {
  id: string
  slug: string
  displayName: string
  bio: string | null
  bioFormat?: 'text' | 'html'
  galleryPublic?: boolean
  logoUrl: string | null
  bannerUrl: string | null
  shareImageUrl?: string | null
  visibility: string
  theme: Record<string, unknown>
  community?: OrgCommunity | null
  featureFlags: OrgFlags
  externalSiteUrl: string | null
  showExternalEmbed: boolean
  rating: number
  reviewCount: number
  /** Weighted average of org + org-event written reviews (stars). */
  reviewAverage: number
  /** Past org-hosted events (ended, or started with no end time). */
  completedEventCount: number
  memberCount: number
  externalEmbedAllowed: boolean
  viewerRole: string | null
  isMember: boolean
  viewerScopeBanned?: boolean
}

type OrgEventRow = {
  id: string
  title: string
  startsAt: string
  location?: string | null
  category?: string | null
  ticketPurchaseUrl?: string | null
  hasProgram?: boolean
  conventionSlug?: string | null
  programSlotCount?: number
  rsvpCount?: number
  viewerRsvpStatus?: 'going' | 'maybe' | null
}

type OrgConventionRow = {
  id: string
  slug: string
  name: string
  description: string | null
  anchorEventId: string | null
  timezone: string
  startsAt: string
  endsAt: string
  slotCount: number
}

type MemberRow = {
  userId: string
  role: string
  username: string
  displayName: string | null
  joinedAt: string
  listedInOrgDirectory?: boolean
  volunteerTags?: string[] | null
}

type ActivityItem =
  | {
      type: 'forum_thread'
      at: string
      threadId: string
      title: string
    }
  | {
      type: 'chat_message'
      at: string
      messageId: string
      channelId: string
      channelName: string
      bodyPreview: string
      username?: string
    }

type GalleryRow = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

function staffCannotReview(role: string | null): boolean {
  if (!role) return false
  return ['STAFF', 'MODERATOR', 'ADMIN', 'OWNER'].includes(role)
}

export default function OrgHubClient() {
  const { slug: slugParam } = useParams()
  const slug = slugParam ?? ''
  const navigate = useNavigate()
  const { isAuthenticated, viewerUserId } = useAuth()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [events, setEvents] = useState<OrgEventRow[] | null>(null)
  const [conventions, setConventions] = useState<OrgConventionRow[] | null>(null)
  const [calendarLoadState, setCalendarLoadState] = useState<OrgCalendarLoadState>('loading')
  const [categories, setCategories] = useState<{ id: string; name: string; sortOrder?: number }[] | null>(null)
  const [threads, setThreads] = useState<
    { id: string; title: string; updatedAt: string; categoryId: string | null }[] | null
  >(null)
  const [threadDetail, setThreadDetail] = useState<{
    thread: { id: string; title: string; authorId: string; lockedAt?: string | null }
    posts: {
      id: string
      body: string
      username: string
      authorId: string
      createdAt: string
      parentId?: string | null
      thanksCount?: number
      helpfulCount?: number
      viewerHasThanks?: boolean
      viewerHasHelpful?: boolean
    }[]
  } | null>(null)
  const [channels, setChannels] = useState<
    | {
        id: string
        slug: string
        name: string
        kind: string
        categoryId?: string | null
        slowModeSeconds?: number | null
        embedUrl?: string | null
      }[]
    | null
  >(null)
  const [channelCategories, setChannelCategories] = useState<
    { id: string; name: string; sortOrder: number }[] | null
  >(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [chanMsgs, setChanMsgs] = useState<{ id: string; body: string; username: string; createdAt: string }[] | null>(
    null
  )
  const [msgDraft, setMsgDraft] = useState('')
  const [msgErr, setMsgErr] = useState<string | null>(null)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoadErr, setActivityLoadErr] = useState<string | null>(null)
  const [chatApiDisabled, setChatApiDisabled] = useState(false)
  const [channelsLoadErr, setChannelsLoadErr] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryRow[] | null>(null)
  const [galleryLocked, setGalleryLocked] = useState(false)
  const [subgroups, setSubgroups] = useState<
    { id: string; name: string; slug: string; memberCount?: number }[] | null
  >(null)
  const [forumCategoryFilter, setForumCategoryFilter] = useState<'all' | string>('all')
  const [showNewThread, setShowNewThread] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadBody, setNewThreadBody] = useState('')
  const [newThreadErr, setNewThreadErr] = useState<string | null>(null)
  const [newThreadCategoryId, setNewThreadCategoryId] = useState('')
  const [faqOpenIdx, setFaqOpenIdx] = useState<number | null>(0)
  const [orgReviews, setOrgReviews] = useState<OrgReviewRow[] | null>(null)

  const orgKey = encodeURIComponent(slug)

  const reloadOrg = useCallback(async () => {
    if (!slug) return
    setLoadErr(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, { credentials: 'include' })
      if (!r.ok) {
        setOrg(null)
        setLoadErr('Organization not found or not visible')
        return
      }
      const data = (await r.json()) as { organization: OrgDetail }
      setOrg(data.organization)
    } catch {
      setOrg(null)
      setLoadErr('Network error')
    }
  }, [slug, orgKey])

  const reloadChannelMessages = useCallback(async () => {
    if (!channelId) return
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${channelId}/messages`, {
        credentials: 'include',
      })
      if (!r.ok) return
      const d = (await r.json()) as {
        items: { id: string; body: string; username: string; createdAt: string }[]
      }
      setChanMsgs(d.items ?? [])
    } catch {
      /* keep existing messages on transient errors */
    }
  }, [orgKey, channelId])

  useEffect(() => {
    void reloadOrg()
  }, [reloadOrg])

  const flags = org?.featureFlags
  const visibleTabs = useMemo(() => {
    if (!org) return ORG_TABS
    const gateCommunityRead = isMembersJoinPreview(org)
    const raw = org.community?.communityModules
    const hasDocumentsModule =
      Array.isArray(raw) && raw.some((m) => m.type === 'documents' && m.enabled !== false)
    const faqList = org.community?.faq
    const hasFaq = Array.isArray(faqList) && faqList.length > 0
    return ORG_TABS.filter((t) => {
      if (gateCommunityRead && (t === 'Forums' || t === 'Chat' || t === 'Documents' || t === 'Subgroups')) {
        return false
      }
      if (t === 'Documents') return hasDocumentsModule
      if (t === 'FAQ') return hasFaq
      if (t === 'Calendar') return org.featureFlags.calendarEnabled
      if (t === 'Forums') return org.featureFlags.forumsEnabled
      if (t === 'Chat') return org.featureFlags.chatEnabled
      if (t === 'Subgroups') return org.featureFlags.subgroupsEnabled
      return true
    })
  }, [org])

  const [tab, setTab] = useTabFromUrl(ORG_TABS, ORG_TABS[0])
  const [searchParams, setSearchParams] = useSearchParams()
  const selectTab = useCallback(
    (nextTab: string) => {
      setTab(nextTab)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', nextTab)
          return p
        },
        { replace: false },
      )
    },
    [setTab, setSearchParams],
  )

  useEffect(() => {
    if (!visibleTabs.includes(tab as (typeof ORG_TABS)[number])) setTab(visibleTabs[0] ?? ORG_TABS[0])
  }, [visibleTabs, tab, setTab])

  useEffect(() => {
    if (!org) return
    const rawTab = searchParams.get('tab')
    if (rawTab === 'Admin' || rawTab?.toLowerCase() === 'admin') {
      navigate(`/organizer/orgs/${encodeURIComponent(org.slug)}?tab=settings`, { replace: true })
      return
    }
    if (searchParams.get('communityEdit') !== '1') return
    const isAdminRole = org.viewerRole === 'ADMIN' || org.viewerRole === 'OWNER'
    if (!isAdminRole) {
      const p = new URLSearchParams(searchParams)
      p.delete('communityEdit')
      setSearchParams(p, { replace: true })
      return
    }
    navigate(
      `/organizer/orgs/${encodeURIComponent(org.slug)}?tab=settings&settingsSection=content`,
      { replace: true },
    )
  }, [org, searchParams, navigate, setSearchParams])

  useEffect(() => {
    if (!slug || !flags?.calendarEnabled) {
      setCalendarLoadState('loading')
      return
    }
    if (tab !== 'Calendar' && tab !== 'Overview') return
    let c = false
    ;(async () => {
      setCalendarLoadState('loading')
      setEvents(null)
      setConventions(null)
      try {
        const [rEv, rConv] = await Promise.all([
          fetch(`/api/v1/organizations/${orgKey}/events`, { credentials: 'include' }),
          fetch(`/api/v1/organizations/${orgKey}/conventions`, { credentials: 'include' }),
        ])
        if (c) return
        let eventsState: OrgCalendarLoadState = 'ready'
        let conventionsState: OrgCalendarLoadState = 'ready'
        if (rEv.ok) {
          const d = (await rEv.json()) as { items: OrgEventRow[] }
          setEvents(d.items ?? [])
        } else {
          eventsState = await calendarApiFailureKind(rEv)
          setEvents([])
        }
        if (rConv.ok) {
          const d = (await rConv.json()) as { items: OrgConventionRow[] }
          setConventions(d.items ?? [])
        } else {
          conventionsState = await calendarApiFailureKind(rConv)
          setConventions([])
        }
        setCalendarLoadState(mergeCalendarLoadState(eventsState, conventionsState))
      } catch {
        if (!c) {
          setCalendarLoadState('error')
          setEvents([])
          setConventions([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [slug, tab, orgKey, flags?.calendarEnabled])

  useEffect(() => {
    if (!slug || tab !== 'Overview' || !org || isMembersJoinPreview(org)) return
    let cancelled = false
    ;(async () => {
      try {
        const [rm, ra] = await Promise.all([
          fetch(`/api/v1/organizations/${orgKey}/members`, { credentials: 'include' }),
          fetch(`/api/v1/organizations/${orgKey}/activity?limit=30`, { credentials: 'include' }),
        ])
        if (cancelled) return
        setActivityLoadErr(null)
        if (rm.ok) {
          const d = (await rm.json()) as { items: MemberRow[] }
          setMembers(d.items ?? [])
        } else setMembers([])
        if (ra.ok) {
          const d = (await ra.json()) as { items: ActivityItem[] }
          setActivity(d.items ?? [])
        } else if (ra.status === 404) {
          setActivity([])
        } else {
          setActivity([])
          setActivityLoadErr('Could not load recent forum and chat activity.')
        }
      } catch {
        if (!cancelled) {
          setMembers([])
          setActivity([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, tab, orgKey, org?.id])

  useEffect(() => {
    if (!slug || (tab !== 'About' && tab !== 'Overview') || !org) return
    let cancelled = false
    ;(async () => {
      try {
        const rr = await fetch(`/api/v1/organizations/${orgKey}/reviews`, { credentials: 'include' })
        if (cancelled) return
        if (rr.ok) {
          const d = (await rr.json()) as { items: OrgReviewRow[] }
          setOrgReviews(d.items ?? [])
        } else {
          setOrgReviews([])
        }
      } catch {
        if (!cancelled) setOrgReviews([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, tab, orgKey, org?.id])

  useEffect(() => {
    if (!slug || (tab !== 'About' && tab !== 'Overview') || !org) return
    let cancelled = false
    ;(async () => {
      try {
        const rg = await fetch(`/api/v1/organizations/${orgKey}/gallery`, { credentials: 'include' })
        if (cancelled) return
        if (rg.ok) {
          const d = (await rg.json()) as { items: GalleryRow[] }
          setGallery(d.items ?? [])
          setGalleryLocked(false)
        } else if (rg.status === 403) {
          setGallery(null)
          setGalleryLocked(true)
        } else {
          setGallery([])
          setGalleryLocked(false)
        }
      } catch {
        if (!cancelled) setGallery([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, tab, orgKey, org?.id])

  useEffect(() => {
    if (!slug || !flags?.forumsEnabled || (org && isMembersJoinPreview(org))) return
    if (tab !== 'Forums' && tab !== 'Overview') return
    let c = false
    ;(async () => {
      try {
        const rc = await fetch(`/api/v1/organizations/${orgKey}/forum/categories`, { credentials: 'include' })
        if (c) return
        if (rc.ok) {
          const d = (await rc.json()) as { items: { id: string; name: string }[] }
          setCategories(d.items ?? [])
        } else setCategories([])
      } catch {
        if (!c) setCategories([])
      }
    })()
    return () => {
      c = true
    }
  }, [slug, tab, orgKey, flags?.forumsEnabled])

  useEffect(() => {
    if (tab !== 'Forums') return
    const cat = searchParams.get('categoryId')
    if (cat) setForumCategoryFilter(cat)
  }, [tab, searchParams])

  useEffect(() => {
    if (!slug || tab !== 'Forums' || !flags?.forumsEnabled) return
    let c = false
    ;(async () => {
      try {
        const q =
          forumCategoryFilter === 'all'
            ? ''
            : `?categoryId=${encodeURIComponent(forumCategoryFilter)}`
        const rt = await fetch(`/api/v1/organizations/${orgKey}/forum/threads${q}`, { credentials: 'include' })
        if (c) return
        if (rt.ok) {
          const d = (await rt.json()) as {
            items: { id: string; title: string; updatedAt: string; categoryId: string | null }[]
          }
          setThreads(d.items ?? [])
        } else setThreads([])
      } catch {
        if (!c) setThreads([])
      }
    })()
    return () => {
      c = true
    }
  }, [slug, tab, orgKey, flags?.forumsEnabled, forumCategoryFilter])

  useEffect(() => {
    if (!slug || !flags?.chatEnabled || (org && isMembersJoinPreview(org))) return
    if (tab !== 'Chat' && tab !== 'Overview') return
    let c = false
    ;(async () => {
      try {
        setChannelsLoadErr(null)
        setChatApiDisabled(false)
        const r = await fetch(`/api/v1/organizations/${orgKey}/channels`, { credentials: 'include' })
        if (c) return
        if (!r.ok) {
          if (r.status === 404) {
            const body = (await r.json().catch(() => ({}))) as { error?: string }
            if (body.error === 'Chat disabled') {
              setChatApiDisabled(true)
            }
          } else {
            setChannelsLoadErr('Could not load chat channels.')
          }
          setChannels([])
          setChannelCategories([])
          return
        }
        const d = (await r.json()) as {
          categories?: { id: string; name: string; sortOrder: number }[]
          items: { id: string; slug: string; name: string; kind: string; categoryId?: string | null; embedUrl?: string | null }[]
        }
        if (!c) {
          setChannelCategories(d.categories ?? [])
          const list = d.items ?? []
          setChannels(list)
          if (tab === 'Chat' && list.length > 0) {
            setChannelId((prev) => {
              if (prev && list.some((ch) => ch.id === prev)) return prev
              const textFirst = list.find((ch) => ch.kind === 'TEXT' || ch.kind === 'ANNOUNCEMENTS')
              return textFirst?.id ?? list[0]!.id
            })
          }
        }
      } catch {
        if (!c) {
          setChannels([])
          setChannelCategories([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [slug, tab, orgKey, flags?.chatEnabled])

  useEffect(() => {
    setMsgErr(null)
  }, [channelId])

  useEffect(() => {
    if (!org?.id || !flags?.subgroupsEnabled || isMembersJoinPreview(org)) return
    if (tab !== 'Subgroups' && tab !== 'Overview') return
    let c = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/groups?organizationId=${encodeURIComponent(org.id)}`, {
          credentials: 'include',
        })
        if (!r.ok || c) return
        const d = (await r.json()) as {
          items: { id: string; name: string; slug: string; memberCount?: number }[]
        }
        if (!c) setSubgroups(d.items ?? [])
      } catch {
        if (!c) setSubgroups([])
      }
    })()
    return () => {
      c = true
    }
  }, [org?.id, tab, flags?.subgroupsEnabled])

  useEffect(() => {
    if (!slug || !channelId || tab !== 'Chat') return
    let c = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${channelId}/messages`, {
          credentials: 'include',
        })
        if (c) return
        if (!r.ok) {
          setChanMsgs([])
          return
        }
        const d = (await r.json()) as { items: { id: string; body: string; username: string; createdAt: string }[] }
        if (!c) setChanMsgs(d.items ?? [])
      } catch {
        if (!c) setChanMsgs([])
      }
    })()
    return () => {
      c = true
    }
  }, [slug, orgKey, channelId, tab])

  /** Realtime: server publishes org_channel_* on same scope; refetch messages when others post. */
  useEffect(() => {
    if (!org?.id || !channelId || tab !== 'Chat' || !flags?.chatEnabled) return
    const ch = channels?.find((x) => x.id === channelId)
    if (!ch || (ch.kind !== 'TEXT' && ch.kind !== 'ANNOUNCEMENTS')) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', scope: `org:${org.id}:channel:${channelId}` }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; eventType?: string }
        if (msg.type === 'error') return
        if (msg.type === 'event' && String(msg.eventType ?? '').startsWith('org_channel')) {
          void reloadChannelMessages()
        }
      } catch {
        /* ignore */
      }
    }
    return () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }, [org?.id, channelId, tab, flags?.chatEnabled, channels, reloadChannelMessages])

  const sortedForumCategories = useMemo(() => {
    if (!categories?.length) return [] as { id: string; name: string; sortOrder?: number }[]
    return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [categories])

  const forumCategoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of sortedForumCategories) m.set(c.id, c.name)
    return m
  }, [sortedForumCategories])

  const chatChannelSections = useMemo(() => {
    if (!channels) return null
    const sortedCats = [...(channelCategories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    const catIds = new Set(sortedCats.map((c) => c.id))
    const sections = sortedCats.map((cat) => ({
      cat,
      channels: channels.filter((ch) => ch.categoryId === cat.id),
    }))
    const uncategorized = channels.filter((ch) => !ch.categoryId || !catIds.has(ch.categoryId))
    return { sections, uncategorized }
  }, [channels, channelCategories])

  const personnelGroups = useMemo(() => {
    if (!members?.length) return null
    const byRole: Record<string, MemberRow[]> = {}
    for (const m of members) {
      const r = m.role
      if (!byRole[r]) byRole[r] = []
      byRole[r].push(m)
    }
    const order = ['OWNER', 'ADMIN', 'MODERATOR', 'STAFF', 'MEMBER']
    return { byRole, order, memberCount: members.filter((m) => m.role === 'MEMBER').length }
  }, [members])

  const {
    overviewCommunityModules,
    featuredPartnersModule,
    contactsModule,
    announcementsModules,
    volunteerModules,
    documentsModules,
  } = useMemo(() => {
    const raw = org?.community?.communityModules
    if (!Array.isArray(raw)) {
      return {
        overviewCommunityModules: undefined,
        featuredPartnersModule: null,
        contactsModule: null,
        announcementsModules: [] as Extract<CommunityPageModule, { type: 'announcements' }>[],
        volunteerModules: [] as Extract<CommunityPageModule, { type: 'volunteer' }>[],
        documentsModules: [] as Extract<CommunityPageModule, { type: 'documents' }>[],
      }
    }
    const featuredPartnersModule = raw.find(
      (m): m is Extract<CommunityPageModule, { type: 'featured_vendors' }> =>
        m.type === 'featured_vendors' && m.enabled !== false
    )
    const contactsModule = raw.find(
      (m): m is Extract<CommunityPageModule, { type: 'contacts' }> =>
        m.type === 'contacts' && m.enabled !== false
    )
    const announcementsModules = raw.filter(
      (m): m is Extract<CommunityPageModule, { type: 'announcements' }> =>
        m.type === 'announcements' && m.enabled !== false
    )
    const volunteerModules = raw.filter(
      (m): m is Extract<CommunityPageModule, { type: 'volunteer' }> =>
        m.type === 'volunteer' && m.enabled !== false
    )
    const documentsModules = raw.filter(
      (m): m is Extract<CommunityPageModule, { type: 'documents' }> =>
        m.type === 'documents' && m.enabled !== false
    )
    const overviewCommunityModules = sortOverviewCommunityModules(
      raw.filter(
        (m) =>
          m.type !== 'featured_vendors' &&
          m.type !== 'contacts' &&
          m.type !== 'announcements' &&
          m.type !== 'volunteer' &&
          m.type !== 'documents' &&
          !isDeprecatedOrgVenueEtiquetteModule(m)
      )
    )
    return {
      overviewCommunityModules,
      featuredPartnersModule: featuredPartnersModule ?? null,
      contactsModule: contactsModule ?? null,
      announcementsModules,
      volunteerModules,
      documentsModules,
    }
  }, [org?.community?.communityModules])

  const overviewAnchorEventId = useMemo(() => {
    if (!conventions?.length) return null
    const paf = conventions.find((c) => c.slug === 'primal-arts-fest-2026')
    if (paf?.anchorEventId) return paf.anchorEventId
    return conventions.find((c) => c.anchorEventId)?.anchorEventId ?? null
  }, [conventions])

  const overviewStripAnnouncements = useMemo(() => {
    const first = announcementsModules[0]
    if (!first?.items?.length) return null
    return { title: first.title?.trim() || 'Announcements', items: first.items.slice(0, 2) }
  }, [announcementsModules])

  /** Next org-hosted calendar rows: social munch vs convention anchor (visually separated on Overview). */
  const overviewUpcomingPair = useMemo(() => {
    if (!flags?.calendarEnabled) return { munch: null as OrgEventRow | null, convention: null as OrgEventRow | null }
    const list = events ?? []
    const now = Date.now()
    const anchorId = conventions?.find((c) => c.anchorEventId)?.anchorEventId
    const anchorEv = anchorId ? (list.find((e) => e.id === anchorId) ?? null) : null

    const soon = list
      .filter((e) => new Date(e.startsAt).getTime() >= now - 48 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

    const isMunchLike = (e: OrgEventRow) =>
      (e.category ?? '').toLowerCase() === 'munch' || /\bmunch\b/i.test(e.title)
    const isConventionLike = (e: OrgEventRow) =>
      Boolean(e.hasProgram || e.conventionSlug) || /\b(fest|festival|convention)\b/i.test(e.title)

    let munch = soon.find(isMunchLike) ?? null
    let convention = soon.find(isConventionLike) ?? null
    if (!munch && convention) {
      const convPick = convention
      munch = soon.find((e) => e.id !== convPick.id) ?? null
    }
    if (!convention && munch) {
      convention = soon.find((e) => e.id !== munch.id && isConventionLike(e)) ?? null
    }
    if (!convention) convention = anchorEv
    if (munch && convention && munch.id === convention.id) {
      convention = soon.find((e) => isConventionLike(e) && e.id !== munch.id) ?? anchorEv
    }
    if (munch && convention && munch.id === convention.id) convention = null
    return { munch, convention }
  }, [events, conventions, flags?.calendarEnabled])

  const spotlightSubgroup = useMemo(() => {
    const sid = org?.community?.spotlightGroupId
    if (!subgroups?.length) return null
    if (sid) return subgroups.find((g) => g.id === sid) ?? null
    return subgroups[0] ?? null
  }, [org?.community?.spotlightGroupId, subgroups])

  const orgForumModeratorUserIds = useMemo(
    () => orgModeratorUserIds(members ?? []),
    [members]
  )

  async function joinLeave(join: boolean) {
    if (join && !isAuthenticated) {
      navigate(buildLoginHref(`/orgs/${encodeURIComponent(slug)}`))
      return
    }
    setAdminMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/${join ? 'join' : 'leave'}`, {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setAdminMsg(j.error ?? 'Request failed')
        return
      }
      await reloadOrg()
      if (tab === 'Overview' || tab === 'About') {
        const rg = await fetch(`/api/v1/organizations/${orgKey}/gallery`, { credentials: 'include' })
        if (rg.ok) {
          const d = (await rg.json()) as { items: GalleryRow[] }
          setGallery(d.items ?? [])
          setGalleryLocked(false)
        }
      }
    } catch {
      setAdminMsg('Network error')
    }
  }

  async function openThread(threadId: string) {
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/forum/threads/${threadId}`, { credentials: 'include' })
      if (!r.ok) return
      const d = (await r.json()) as {
        thread: { id: string; title: string; authorId: string }
        posts: {
          id: string
          body: string
          username: string
          authorId: string
          createdAt: string
          parentId?: string | null
          thanksCount?: number
          helpfulCount?: number
          viewerHasThanks?: boolean
          viewerHasHelpful?: boolean
        }[]
      }
      setThreadDetail(d)
    } catch {
      /* ignore */
    }
  }

  async function postChannelMessage() {
    if (!channelId || !msgDraft.trim()) return
    const ch = channels?.find((c) => c.id === channelId)
    if (!ch || (ch.kind !== 'TEXT' && ch.kind !== 'ANNOUNCEMENTS')) return
    if (ch.kind === 'ANNOUNCEMENTS') {
      const mod =
        org?.viewerRole === 'MODERATOR' || org?.viewerRole === 'ADMIN' || org?.viewerRole === 'OWNER'
      if (!mod) {
        setMsgErr('Only moderators can post in announcement channels.')
        return
      }
    }
    setMsgErr(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${channelId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: msgDraft.trim() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsgErr(j.error ?? 'Could not send message')
        return
      }
      setMsgDraft('')
      const lr = await fetch(`/api/v1/organizations/${orgKey}/channels/${channelId}/messages`, {
        credentials: 'include',
      })
      if (lr.ok) {
        const d = (await lr.json()) as { items: { id: string; body: string; username: string; createdAt: string }[] }
        setChanMsgs(d.items ?? [])
      }
    } catch {
      setMsgErr('Network error')
    }
  }

  async function submitOrgReview() {
    setReviewMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, body: reviewBody.trim() || undefined }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setReviewMsg(j.error ?? 'Could not submit')
        return
      }
      setReviewMsg('Thanks for your feedback.')
      setReviewBody('')
      setShowReviewModal(false)
      await reloadOrg()
    } catch {
      setReviewMsg('Network error')
    }
  }

  if (!slug) {
    return <p className="text-dc-text-muted px-4 py-8">Missing organization slug.</p>
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-dc-text-muted">{loadErr}</p>
        <Link to="/orgs" className="text-dc-accent text-sm mt-4 inline-block hover:underline">
          Back to organizations
        </Link>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 dc-panel-enter" aria-busy="true" role="status">
        <div className="dc-skeleton-bone h-40 rounded-2xl" />
        <div className="mt-6 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dc-skeleton-bone h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-6 dc-skeleton-bone h-64 rounded-2xl" />
      </div>
    )
  }

  const canModerate =
    org.viewerRole === 'MODERATOR' || org.viewerRole === 'ADMIN' || org.viewerRole === 'OWNER'
  const canManageOrg = org.viewerRole === 'ADMIN' || org.viewerRole === 'OWNER'
  const canShowReviewButton = isAuthenticated && !staffCannotReview(org.viewerRole)
  const membersJoinPreview = isMembersJoinPreview(org)
  const bioFmt = org.bioFormat === 'html' ? 'html' : 'text'
  const organizerBase = `/organizer/orgs/${encodeURIComponent(org.slug)}`
  const nowMs = Date.now()
  const hasUpcomingEvents =
    (events ?? []).some((e) => new Date(e.startsAt).getTime() >= nowMs - 24 * 60 * 60 * 1000) ||
    (conventions ?? []).some((c) => new Date(c.endsAt).getTime() >= nowMs - 24 * 60 * 60 * 1000)

  const selectedChannel = channels?.find((c) => c.id === channelId)
  const isTextChatChannel =
    selectedChannel &&
    (selectedChannel.kind === 'TEXT' || selectedChannel.kind === 'ANNOUNCEMENTS')
  const isVoiceChannel =
    selectedChannel &&
    (selectedChannel.kind === 'VOICE' ||
      selectedChannel.kind === 'VIDEO' ||
      selectedChannel.kind === 'LIVE_STREAM')
  const isDiscordChannel = selectedChannel?.kind === 'DISCORD'
  const hasForumCategories = categories !== null && sortedForumCategories.length > 0
  const hasChatChannels = channels !== null && channels.length > 0
  const canPostInSelectedChannel =
    !org?.viewerScopeBanned &&
    selectedChannel &&
    (selectedChannel.kind === 'TEXT' ||
      (selectedChannel.kind === 'ANNOUNCEMENTS' && canModerate))
  const commsSetupHref = `${organizerBase}?tab=communications`

  async function submitNewThread(e: React.FormEvent) {
    e.preventDefault()
    setNewThreadErr(null)
    if (!newThreadTitle.trim() || !newThreadBody.trim()) {
      setNewThreadErr('Title and first post are required.')
      return
    }
    const cat = newThreadCategoryId || categories?.[0]?.id
    if (!cat) {
      setNewThreadErr('Create a forum category first (or ask a moderator).')
      return
    }
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/forum/threads`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newThreadTitle.trim(),
          body: newThreadBody.trim(),
          categoryId: cat,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; thread?: { id: string } }
      if (!r.ok) {
        setNewThreadErr(j.error ?? 'Could not create thread')
        return
      }
      setNewThreadTitle('')
      setNewThreadBody('')
      setShowNewThread(false)
      const rt = await fetch(
        `/api/v1/organizations/${orgKey}/forum/threads${
          forumCategoryFilter === 'all' ? '' : `?categoryId=${encodeURIComponent(forumCategoryFilter)}`
        }`,
        { credentials: 'include' }
      )
      if (rt.ok) {
        const d = (await rt.json()) as {
          items: { id: string; title: string; updatedAt: string; categoryId: string | null }[]
        }
        setThreads(d.items ?? [])
      }
      if (j.thread?.id) void openThread(j.thread.id)
    } catch {
      setNewThreadErr('Network error')
    }
  }

  async function setEventRsvp(eventId: string, mode: 'going' | 'maybe' | 'clear') {
    if (!isAuthenticated) return
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvp`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: mode === 'clear' ? 'not_going' : mode }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        rsvpCount?: number
        status?: 'going' | 'maybe' | null
      }
      if (!r.ok) {
        setAdminMsg(j.error ?? 'RSVP failed')
        return
      }
      setEvents((prev) =>
        prev
          ? prev.map((e) =>
              e.id === eventId
                ? {
                    ...e,
                    rsvpCount: typeof j.rsvpCount === 'number' ? j.rsvpCount : e.rsvpCount,
                    viewerRsvpStatus: j.status ?? null,
                  }
                : e
            )
          : prev
      )
    } catch {
      setAdminMsg('Network error')
    }
  }

  async function togglePostReaction(postId: string, kind: 'thanks' | 'helpful') {
    const tid = threadDetail?.thread.id
    if (!tid) return
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/forum/posts/${encodeURIComponent(postId)}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      if (!r.ok) return
      void openThread(tid)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="org-review-title"
          onClick={() => setShowReviewModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowReviewModal(false)}
        >
          <div
            className="bg-dc-elevated/95 border border-dc-border rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="org-review-title" className="text-lg font-semibold text-dc-text mb-2">
              Rate this organization
            </h2>
            <p className="text-xs text-dc-muted mb-3">
              One review per account. Organization staff cannot review. You must have attended at least one event hosted
              by this organization before submitting a review.
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="bg-dc-elevated-solid border border-dc-border rounded-lg text-sm text-dc-text px-2 py-1"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              rows={3}
              className="w-full bg-dc-elevated-solid border border-dc-border rounded-xl p-3 text-sm text-dc-text-muted mb-2"
              placeholder="Optional comment"
            />
            {reviewMsg && <p className="text-sm text-dc-muted mb-2">{reviewMsg}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="min-h-11 px-4 py-2 rounded-xl text-sm border border-dc-border text-dc-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitOrgReview()}
                className="min-h-11 px-4 py-2 rounded-xl text-sm bg-dc-accent text-dc-accent-foreground"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <ScopePageMeta
        title={org.displayName}
        description={org.bio?.replace(/<[^>]+>/g, '').slice(0, 300) ?? undefined}
        path={`/orgs/${encodeURIComponent(org.slug)}`}
        shareImageUrl={org.shareImageUrl}
        bannerUrl={org.bannerUrl}
        logoUrl={org.logoUrl}
      />
      <OrgCommunityShell
        displayName={org.displayName}
        slug={org.slug}
        bannerUrl={org.bannerUrl}
        logoUrl={org.logoUrl}
        memberCount={org.memberCount}
        completedEventCount={org.completedEventCount ?? 0}
        rating={org.rating}
        reviewCount={org.reviewCount}
        themeAccent={(org.theme?.accent as string) ?? null}
        isMember={org.isMember}
        canModerate={canModerate}
        tabs={visibleTabs}
        activeTab={tab}
        onTabChange={selectTab}
        onJoin={() => void joinLeave(true)}
        onLeave={() => void joinLeave(false)}
        beforeTabs={
          membersJoinPreview || canShowReviewButton ?
            <div className="mb-4 space-y-3">
              {membersJoinPreview ?
                <div
                  className="rounded-xl border border-dc-accent-border/35 bg-dc-accent/5 px-4 py-3 text-sm text-dc-text"
                  role="status"
                >
                  <span className="font-medium">Join to see full community.</span>{' '}
                  <button
                    type="button"
                    onClick={() => void joinLeave(true)}
                    className="font-semibold text-dc-accent hover:underline"
                  >
                    Join now
                  </button>
                </div>
              : null}
              {canShowReviewButton ?
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewMsg(null)
                      setShowReviewModal(true)
                    }}
                    className="min-h-11 px-4 py-2 rounded-xl text-sm border border-dc-accent-border/40 text-dc-accent hover:bg-dc-accent/10"
                  >
                    Submit review
                  </button>
                </div>
              : null}
            </div>
          : undefined
        }
        tabFooter={
          <>
            {!staffCannotReview(org.viewerRole) ?
              <p className="text-xs text-dc-muted mb-4" role="note">
                Staff tools appear when you&apos;re added as staff.
              </p>
            : null}
            {adminMsg ? <p className="text-sm text-dc-muted mb-4">{adminMsg}</p> : null}
          </>
        }
      >
      {tab === 'Overview' && (
        <div className="space-y-6">
          {!membersJoinPreview && overviewStripAnnouncements && (
            <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
              <OrgAnnouncementsBlock
                title={overviewStripAnnouncements.title}
                items={overviewStripAnnouncements.items}
                compact
                maxItems={2}
                layout="strip"
              />
            </div>
          )}

          <div className={`grid grid-cols-1 gap-6 items-start ${membersJoinPreview ? '' : 'lg:grid-cols-12'}`}>
            <div className={`flex flex-col gap-6 ${membersJoinPreview ? '' : 'lg:col-span-8'}`}>
              {org.community?.welcomeHtml ?
                <div className="max-lg:order-3 bg-dc-elevated/95 rounded-2xl border border-dc-border p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-dc-muted uppercase mb-2">Welcome</h2>
                  <div
                    className="c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent prose-headings:text-dc-text prose-strong:text-dc-text"
                    dangerouslySetInnerHTML={{ __html: org.community.welcomeHtml }}
                  />
                </div>
              : <div className="max-lg:order-3 bg-dc-elevated/95 rounded-2xl border border-dc-border p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-dc-muted uppercase mb-2">About this organization</h2>
                  {org.bio ?
                    bioFmt === 'html' ?
                      <div
                        className="c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent prose-headings:text-dc-text prose-strong:text-dc-text line-clamp-6"
                        dangerouslySetInnerHTML={{ __html: org.bio }}
                      />
                    : <p className="text-sm text-dc-text-muted whitespace-pre-wrap line-clamp-6">{org.bio}</p>
                  : <p className="text-sm text-dc-text-muted">
                      {membersJoinPreview ?
                        `${org.displayName} is a members-only community. Join to access forums, chat, and the full hub.`
                      : `${org.displayName} is building its public hub. Explore the Calendar for events, join forums or chat to participate, and read About for more detail.`}
                    </p>
                  }
                  <div className="mt-4 flex flex-wrap gap-2">
                    {visibleTabs.includes('About') ?
                      <button
                        type="button"
                        onClick={() => selectTab('About')}
                        className="text-sm font-semibold text-dc-accent hover:underline"
                      >
                        Read full About →
                      </button>
                    : null}
                    {flags?.calendarEnabled ?
                      <button
                        type="button"
                        onClick={() => selectTab('Calendar')}
                        className="text-sm font-semibold text-dc-accent hover:underline"
                      >
                        View calendar →
                      </button>
                    : null}
                  </div>
                </div>
              }

              {orgReviews === null ?
                <div className="max-lg:order-6 h-20 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
              : orgReviews.length > 0 ?
                <div className="max-lg:order-6 bg-dc-elevated/95 rounded-2xl border border-dc-border p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Reviews</h2>
                  <ul className="space-y-3">
                    {orgReviews.slice(0, 5).map((review) => (
                      <li key={review.id} className="rounded-xl border border-dc-border/80 bg-dc-surface/30 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium text-amber-300" aria-label={`${review.rating} out of 5 stars`}>
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(Math.max(0, 5 - review.rating))}
                          </span>
                          <span className="text-dc-muted">{review.rating}/5</span>
                          <span className="text-dc-muted">·</span>
                          <span className="text-dc-text-muted">@{review.username}</span>
                        </div>
                        {review.body ?
                          <p className="mt-2 text-sm text-dc-text-muted whitespace-pre-wrap">{review.body}</p>
                        : null}
                      </li>
                    ))}
                  </ul>
                </div>
              : null}

              {slug ?
                <div className="max-lg:order-8">
                <ScopeEmailSignupForm
                  scopeType="organization"
                  scopeKey={slug}
                  headline={
                    typeof org.community?.emailListHeadline === 'string' ? org.community.emailListHeadline : null
                  }
                  blurb={typeof org.community?.emailListBlurb === 'string' ? org.community.emailListBlurb : null}
                />
                </div>
              : null}

              {flags?.calendarEnabled && calendarLoadState === 'loading' && (
                <div className="max-lg:order-2 h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
              )}

              {flags?.calendarEnabled && calendarLoadState === 'error' && (
                <div className="max-lg:order-2 rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Upcoming events</h2>
                  <p className="mt-2 text-sm text-dc-text-muted">Could not load the calendar right now. Try again in a moment.</p>
                </div>
              )}

              {flags?.calendarEnabled && calendarLoadState === 'disabled' && (
                <div className="max-lg:order-2 rounded-xl border border-dashed border-dc-border-strong bg-dc-elevated/95 px-4 py-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Upcoming events</h2>
                  <p className="mt-2 text-sm text-dc-text-muted">Events &amp; conventions disabled in org settings.</p>
                  {canManageOrg ?
                    <Link
                      to={`/organizer/orgs/${encodeURIComponent(slug)}?tab=settings&settingsSection=features`}
                      className="mt-3 inline-block text-sm font-semibold text-dc-accent hover:underline"
                    >
                      Open feature settings →
                    </Link>
                  : null}
                </div>
              )}

              {flags?.calendarEnabled && calendarLoadState === 'ready' && (overviewUpcomingPair.munch || overviewUpcomingPair.convention) && (
                <div className="max-lg:order-2 bg-dc-elevated/95 rounded-xl border border-dc-border p-4">
                  <h2 className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-0.5">
                    Upcoming events
                  </h2>
                  <p className="text-[10px] text-dc-muted mb-3">
                    From this org&apos;s calendar. Open the Calendar tab for the full list.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {overviewUpcomingPair.munch && (
                      <Link
                        to={`/events/${encodeURIComponent(overviewUpcomingPair.munch.id)}`}
                        className="group rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-dc-elevated-solid/90 to-dc-elevated-solid p-4 shadow-sm hover:border-amber-400/55 transition-colors"
                      >
                        <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/95 mb-2">
                          Monthly munch
                        </span>
                        <p className="text-sm font-semibold text-dc-text group-hover:text-amber-50 line-clamp-2">
                          {overviewUpcomingPair.munch.title}
                        </p>
                        <p className="mt-1 text-[11px] text-dc-text-muted">
                          {new Date(overviewUpcomingPair.munch.startsAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </Link>
                    )}
                    {overviewUpcomingPair.convention && (
                      <Link
                        to={
                          overviewUpcomingPair.convention.conventionSlug ?
                            `/conventions/${encodeURIComponent(overviewUpcomingPair.convention.conventionSlug)}?tab=Schedule`
                          : `/events/${encodeURIComponent(overviewUpcomingPair.convention.id)}`
                        }
                        className="group rounded-xl border border-teal-500/40 bg-gradient-to-br from-teal-950/45 via-dc-elevated-solid/95 to-slate-950/50 p-4 shadow-sm hover:border-teal-400/55 transition-colors"
                      >
                        <span className="inline-flex rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100/95 mb-2">
                          Convention weekend
                        </span>
                        <p className="text-sm font-semibold text-dc-text group-hover:text-teal-50 line-clamp-2">
                          {overviewUpcomingPair.convention.title}
                        </p>
                        <p className="mt-1 text-[11px] text-dc-text-muted">
                          {new Date(overviewUpcomingPair.convention.startsAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                          {overviewUpcomingPair.convention.programSlotCount ?
                            ` · ${overviewUpcomingPair.convention.programSlotCount} program slot${overviewUpcomingPair.convention.programSlotCount === 1 ? '' : 's'}`
                          : ''}
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {flags && isVenueListing(flags) && slug ?
                <OrgHubVenueEvents orgSlug={slug} />
              : null}

              {flags?.calendarEnabled && calendarLoadState === 'ready' && !overviewUpcomingPair.munch && !overviewUpcomingPair.convention && (
                <div className="max-lg:order-2 rounded-xl border border-dashed border-dc-border-strong bg-dc-elevated/95 px-4 py-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Upcoming events</h2>
                  <p className="mt-2 text-sm text-dc-text-muted">No upcoming events yet.</p>
                  <p className="mt-1 text-xs text-dc-muted">
                    Check back soon for upcoming events from this organization.
                  </p>
                </div>
              )}

              {(flags?.forumsEnabled || flags?.chatEnabled) && !membersJoinPreview && (
                <div className="max-lg:order-4 bg-dc-elevated/95 rounded-xl border border-dc-border p-4">
                  <h2 className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-0.5">
                    Forums &amp; chat
                  </h2>
                  <p className="text-[10px] text-dc-muted mb-2.5">What&apos;s new. Open the tab for full threads.</p>
                  {activityLoadErr ?
                    <p className="mb-2.5 rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                      {activityLoadErr}
                    </p>
                  : null}
                  {activity === null ? (
                    <div className="h-12 animate-pulse bg-dc-elevated-muted rounded-lg" />
                  ) : activity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-dc-border-strong px-4 py-5">
                      <p className="text-sm font-medium text-dc-text">No forum or chat activity yet</p>
                      <p className="mt-1 text-xs text-dc-muted">
                        {flags?.forumsEnabled && !hasForumCategories && flags?.chatEnabled && !hasChatChannels ?
                          'Forums and chat are enabled, but organizers still need to add categories and channels before members can post.'
                        : flags?.forumsEnabled && !hasForumCategories ?
                          'Forums are enabled, but no categories exist yet. Organizers must add one before members can start threads.'
                        : flags?.chatEnabled && !hasChatChannels ?
                          'Chat is enabled, but no channels exist yet. Organizers must create a channel first.'
                        : flags?.forumsEnabled && flags?.chatEnabled ?
                          'Be the first to start a discussion or say hello in chat.'
                        : flags?.forumsEnabled ?
                          'No forum posts yet. Start a thread when categories are ready.'
                        : 'Open chat once channels are set up.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {flags?.forumsEnabled && org.isMember && hasForumCategories ?
                          <button
                            type="button"
                            onClick={() => selectTab('Forums')}
                            className="min-h-10 rounded-lg border border-dc-accent-border/40 px-3 py-1.5 text-xs font-semibold text-dc-accent hover:bg-dc-accent/10"
                          >
                            Start a discussion
                          </button>
                        : null}
                        {flags?.chatEnabled && hasChatChannels ?
                          <button
                            type="button"
                            onClick={() => selectTab('Chat')}
                            className="min-h-10 rounded-lg border border-dc-border px-3 py-1.5 text-xs font-semibold text-dc-text-muted hover:text-dc-text"
                          >
                            Open chat
                          </button>
                        : null}
                        {(canModerate || canManageOrg) &&
                        ((flags?.forumsEnabled && !hasForumCategories) || (flags?.chatEnabled && !hasChatChannels)) ?
                          <Link
                            to={commsSetupHref}
                            className="min-h-10 inline-flex items-center rounded-lg border border-dc-accent-border/40 px-3 py-1.5 text-xs font-semibold text-dc-accent hover:bg-dc-accent/10"
                          >
                            Set up forums &amp; chat
                          </Link>
                        : null}
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {activity.slice(0, ORG_OVERVIEW_ACTIVITY_PREVIEW).map((item, idx) => (
                        <li
                          key={`${item.type}-${item.type === 'forum_thread' ? item.threadId : item.messageId}-${idx}`}
                          className={
                            item.type === 'forum_thread' ?
                              'rounded-lg border border-teal-400/25 border-l-4 border-l-teal-400 bg-gradient-to-r from-teal-500/14 via-teal-500/5 to-transparent pl-2 pr-2 py-2 shadow-sm'
                            : 'rounded-lg border border-violet-400/25 border-l-4 border-l-violet-400 bg-gradient-to-r from-violet-500/14 via-violet-500/5 to-transparent pl-2 pr-2 py-2 shadow-sm'
                          }
                        >
                          {item.type === 'forum_thread' ? (
                            <button
                              type="button"
                              onClick={() => {
                                selectTab('Forums')
                                void openThread(item.threadId)
                              }}
                              className="text-left w-full"
                            >
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-teal-200/95">
                                Forum
                              </span>
                              <span className="mt-0.5 block text-xs font-medium text-teal-50 hover:text-dc-text hover:underline truncate">
                                {item.title}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                selectTab('Chat')
                                setChannelId(item.channelId)
                              }}
                              className="text-left w-full"
                            >
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-200/95">
                                Chat{' '}
                                <span className="font-normal normal-case text-violet-200/70">·</span>{' '}
                                <span className="font-medium normal-case text-violet-100/90">#{item.channelName}</span>
                              </span>
                              <span className="mt-0.5 block text-xs text-violet-50/90 line-clamp-2">{item.bodyPreview}</span>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!membersJoinPreview ?
                <div className="max-lg:order-5">
                <OrgCommunityModules
                  orgSlug={slug}
                  modules={overviewCommunityModules}
                  events={events ?? []}
                  isAuthenticated={isAuthenticated}
                  orgReportAction={
                    org ?
                      (() => {
                        const target = organizationTarget(org.id)
                        return (
                          <ReportAction
                            variant="button"
                            targetType={target.targetType}
                            targetId={target.targetId}
                            targetLabel="organization"
                            surface="org_hub"
                            className="inline-flex min-h-10 items-center px-4 rounded-xl bg-dc-accent text-dc-accent-foreground text-sm font-medium"
                            onSubmitted={() => setAdminMsg('Report submitted. Thank you.')}
                          />
                        )
                      })()
                    : undefined
                  }
                  platformEscalationReportAction={
                    org ?
                      (() => {
                        const target = organizationTarget(org.id, true)
                        return (
                          <ReportAction
                            variant="button"
                            targetType={target.targetType}
                            targetId={target.targetId}
                            targetLabel="organization (platform escalation)"
                            surface="org_hub"
                            className="inline-flex min-h-10 items-center px-4 rounded-xl border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted"
                            onSubmitted={() => setAdminMsg('Report submitted. Thank you.')}
                          />
                        )
                      })()
                    : undefined
                  }
                />
                </div>
              : null}
            </div>

            {!membersJoinPreview ?
            <aside className="lg:col-span-4 lg:sticky lg:top-6 space-y-4 self-start w-full max-w-md lg:max-w-none lg:justify-self-end">
              <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
                <h2 className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-3">Gallery</h2>
                {galleryLocked && !org.isMember ? (
                  <div className="rounded-lg border border-dashed border-dc-border-strong p-4 text-center">
                    <p className="text-xs text-dc-text-muted mb-2">Members only.</p>
                    <button
                      type="button"
                      onClick={() => void joinLeave(true)}
                      className="text-xs text-dc-accent hover:underline"
                    >
                      Join to view
                    </button>
                  </div>
                ) : gallery === null ? (
                  <div className="h-16 animate-pulse bg-dc-elevated-muted rounded-lg" />
                ) : gallery.length === 0 ?
                  <p className="text-xs text-dc-muted">No gallery images yet.</p>
                : (
                  <ul className="grid grid-cols-2 gap-2">
                    {gallery.slice(0, 6).map((g) => (
                      <li key={g.id} className="rounded-lg overflow-hidden border border-dc-border">
                        <img src={orgMediaDisplayUrl(g.imageUrl)} alt="" className="w-full h-20 object-cover" loading="lazy" />
                      </li>
                    ))}
                  </ul>
                )}
                {gallery !== null && gallery.length > 0 ?
                  <>
                    {gallery.length > 6 ?
                      <p className="text-[10px] text-dc-muted mt-2">Showing 6 of {gallery.length}</p>
                    : null}
                    {visibleTabs.includes('About') ?
                      <button
                        type="button"
                        onClick={() => selectTab('About')}
                        className="mt-2 text-xs text-dc-accent hover:underline font-medium"
                      >
                        Open full gallery →
                      </button>
                    : null}
                  </>
                : null}
              </div>

              <OrgAnchorAttendeesCard anchorEventId={overviewAnchorEventId} />

                {contactsModule && (
                  <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
                    <OrgContactsBlock
                      title={contactsModule.title?.trim() || 'Who to contact'}
                      rows={contactsModule.rows}
                      compact
                    />
                  </div>
                )}
                {personnelGroups && (
                  <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
                    <h2 className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-3">
                      Personnel
                    </h2>
                    <div className="space-y-3">
                      {personnelGroups.order.map((role) => {
                        const list = personnelGroups.byRole[role]
                        if (!list?.length || role === 'MEMBER') return null
                        return (
                          <div key={role}>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted mb-1.5">
                              {role.replace('_', ' ')}
                            </p>
                            <ul className="flex flex-col gap-1.5">
                              {list.map((m) => (
                                <li key={m.userId}>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <Link
                                      to={`/profile/${encodeURIComponent(m.username)}`}
                                      className="text-sm font-medium text-dc-accent hover:underline truncate max-w-full"
                                    >
                                      {m.displayName || m.username}
                                    </Link>
                                    {(m.volunteerTags?.length ?? 0) > 0 && (
                                      <span className="flex flex-wrap gap-1">
                                        {m.volunteerTags!.map((t) => (
                                          <span
                                            key={t}
                                            className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-dc-elevated-muted text-dc-text-muted"
                                          >
                                            {t}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                      {personnelGroups.memberCount > 0 && (
                        <p className="text-[11px] text-dc-muted pt-1 border-t border-dc-border-subtle">
                          + {personnelGroups.memberCount} member{personnelGroups.memberCount === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {volunteerModules.map((vm) => (
                  <div
                    key={vm.id}
                    className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]"
                  >
                    <OrgVolunteerBlock
                      title={vm.title?.trim() || 'Volunteer'}
                      bodyHtml={vm.bodyHtml}
                      signupUrl={vm.signupUrl}
                      compact
                    />
                  </div>
                ))}
                {featuredPartnersModule && (
                  <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]">
                    <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                      {featuredPartnersModule.title?.trim() || 'Featured partners'}
                    </h2>
                    <OrgFeaturedVendorsBlock
                      orgSlug={slug}
                      maxItems={featuredPartnersModule.maxItems ?? 8}
                      emptyMessage={featuredPartnersModule.emptyMessage}
                    />
                  </div>
                )}
            </aside>
            : null}
          </div>

          {!membersJoinPreview &&
          (org.community?.recapThreadId ||
            org.community?.lastEventRecapUrl ||
            (flags?.subgroupsEnabled && spotlightSubgroup)) && (
            <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 space-y-3">
              <h2 className="text-sm font-semibold text-dc-muted uppercase">More from this community</h2>
              {org.community?.recapThreadId && flags?.forumsEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    selectTab('Forums')
                    void openThread(org.community!.recapThreadId!)
                  }}
                  className="block text-sm text-dc-accent hover:underline"
                >
                  Event recap discussion (forum)
                </button>
              )}
              {org.community?.lastEventRecapUrl && (
                <a
                  href={org.community.lastEventRecapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-dc-accent hover:underline"
                >
                  External recap / photos
                </a>
              )}
              {flags?.subgroupsEnabled && spotlightSubgroup && (
                <Link
                  to={`/groups/${spotlightSubgroup.id}`}
                  className="inline-block text-sm text-dc-accent hover:underline"
                >
                  Subgroup spotlight: {spotlightSubgroup.name}
                </Link>
              )}
            </div>
          )}

        </div>
      )}

      {tab === 'Documents' && documentsModules.length > 0 && (
        <div className="max-w-3xl space-y-6">
          {documentsModules.map((m) => (
            <div
              key={m.id}
              className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]"
            >
              <OrgDocumentsBlock title={m.title?.trim() || 'Documents & forms'} items={m.items} />
            </div>
          ))}
        </div>
      )}

      {tab === 'FAQ' && org.community?.faq && org.community.faq.length > 0 && (
        <div className="max-w-3xl">
          <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]">
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">FAQ</h2>
            <ul className="space-y-2">
              {org.community.faq.map((item, i) => (
                <li key={i} className="border border-dc-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFaqOpenIdx((x) => (x === i ? null : i))}
                    className="w-full text-left px-4 py-3 text-sm text-dc-text flex justify-between gap-2"
                  >
                    {item.q}
                    <span className="text-dc-muted">{faqOpenIdx === i ? '−' : '+'}</span>
                  </button>
                  {faqOpenIdx === i && (
                    <p className="px-4 pb-3 text-sm text-dc-text-muted whitespace-pre-wrap">{item.a}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'About' && flags && (
        <OrgHubAboutTab
          org={org}
          flags={flags}
          bioFmt={bioFmt}
          gallery={gallery}
          galleryLocked={galleryLocked}
          galleryUrl={orgMediaDisplayUrl}
          personnelGroups={personnelGroups}
          hasUpcomingEvents={hasUpcomingEvents}
          canManageOrg={canManageOrg}
          organizerBase={organizerBase}
          onJoin={() => void joinLeave(true)}
          onOpenCalendar={() => selectTab('Calendar')}
        />
      )}

      {tab === 'Calendar' && (
        <OrgHubCalendarTab
          events={events}
          conventions={conventions}
          calendarLoadState={calendarLoadState}
          canManageOrg={canManageOrg}
          orgSlug={slug}
          isAuthenticated={isAuthenticated}
          onRsvp={(eventId, mode) => void setEventRsvp(eventId, mode)}
        />
      )}

      {tab === 'Forums' && (
        membersJoinPreview ?
          <MembersJoinCommunityGate onJoin={() => void joinLeave(true)} />
        : <div className="space-y-4">
          {categories !== null && !hasForumCategories ?
            <div className="rounded-xl border border-dashed border-amber-500/35 bg-amber-950/20 px-4 py-4 text-sm">
              <p className="font-medium text-dc-text">Forums are enabled but no categories exist yet</p>
              <p className="mt-1 text-dc-text-muted">
                {canModerate || canManageOrg ?
                  'Add at least one forum category in the organizer dashboard before members can start threads.'
                : 'Ask an organizer or moderator to add a forum category before you can post.'}
              </p>
              {canModerate || canManageOrg ?
                <Link
                  to={`${commsSetupHref}#forum-categories`}
                  className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-dc-accent px-4 text-sm font-semibold text-dc-text hover:brightness-110"
                >
                  Create forum category
                </Link>
              : null}
            </div>
          : null}

          {hasForumCategories ?
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Categories</p>
                <label className="sr-only" htmlFor="forum-category-select">
                  Filter threads by category
                </label>
                <select
                  id="forum-category-select"
                  value={forumCategoryFilter}
                  onChange={(e) => setForumCategoryFilter(e.target.value as 'all' | string)}
                  className="max-w-[160px] rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-xs text-dc-text lg:hidden"
                >
                  <option value="all">All</option>
                  {sortedForumCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden flex-wrap gap-1.5 lg:flex">
                <button
                  type="button"
                  onClick={() => setForumCategoryFilter('all')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    forumCategoryFilter === 'all'
                      ? 'border-dc-accent-border/50 bg-dc-accent/15 text-dc-text'
                      : 'border-dc-border bg-transparent text-dc-text-muted hover:border-dc-border-strong hover:bg-white/[0.04]'
                  }`}
                >
                  All
                </button>
                {sortedForumCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForumCategoryFilter(c.id)}
                    className={`max-w-[200px] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      forumCategoryFilter === c.id
                        ? 'border-dc-accent-border/50 bg-dc-accent/15 text-dc-text'
                        : 'border-dc-border bg-transparent text-dc-text-muted hover:border-dc-border-strong hover:bg-white/[0.04]'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {org.isMember && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewThread(true)
                    setNewThreadErr(null)
                    setNewThreadCategoryId(
                      forumCategoryFilter !== 'all' ? forumCategoryFilter : sortedForumCategories[0]?.id ?? ''
                    )
                  }}
                  className="min-h-10 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-text hover:brightness-110"
                >
                  New thread
                </button>
              )}
            </div>
            </div>
          : null}

          {showNewThread && org.isMember && !org.viewerScopeBanned && hasForumCategories && (
            <div className="rounded-xl border border-dc-accent/35 bg-dc-elevated/95 p-5 shadow-lg ring-1 ring-dc-accent/10">
              <h3 className="mb-3 text-sm font-semibold text-dc-text">New thread</h3>
              <form onSubmit={submitNewThread} className="max-w-2xl space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-dc-muted">Category</label>
                  <select
                    value={newThreadCategoryId}
                    onChange={(e) => setNewThreadCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                    required
                  >
                    <option value="">Select category…</option>
                    {sortedForumCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                />
                <textarea
                  value={newThreadBody}
                  onChange={(e) => setNewThreadBody(e.target.value)}
                  placeholder="First post (required)"
                  rows={5}
                  className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                />
                {newThreadErr && <p className="text-sm text-red-400">{newThreadErr}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="min-h-10 rounded-full bg-dc-accent px-4 text-sm text-dc-text">
                    Post
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewThread(false)
                      setNewThreadErr(null)
                    }}
                    className="min-h-10 rounded-full border border-dc-border px-4 text-sm text-dc-text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex min-h-[min(58vh,520px)] flex-col overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid/40 ring-1 ring-white/5 lg:flex-row">
            <aside className="flex max-h-[min(42vh,420px)] flex-col border-b border-dc-border lg:max-h-none lg:w-[min(100%,380px)] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-dc-border">
              <div className="flex shrink-0 items-center justify-between border-b border-dc-border bg-dc-elevated/95/90 px-3 py-2.5 backdrop-blur-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
                  {forumCategoryFilter === 'all'
                    ? 'All threads'
                    : (forumCategoryNameById.get(forumCategoryFilter) ?? 'Threads')}
                </span>
                <span className="tabular-nums text-[11px] text-dc-muted">
                  {threads === null ? '…' : `${threads.length}`}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
                {threads === null ? (
                  <div className="divide-y divide-white/5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex gap-3 px-3 py-3">
                        <div className="mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded-full bg-dc-elevated-muted" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3.5 w-[85%] max-w-[280px] animate-pulse rounded bg-dc-elevated-muted" />
                          <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.06]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : threads.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-dc-muted">
                    {hasForumCategories ? 'No threads in this view.' : 'No forum categories configured yet.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.06]">
                    {threads.map((th) => {
                      const active = threadDetail?.thread.id === th.id
                      const catLabel = th.categoryId ? forumCategoryNameById.get(th.categoryId) : null
                      const rel = formatForumRelativeTime(th.updatedAt)
                      return (
                        <li key={th.id}>
                          <button
                            type="button"
                            onClick={() => void openThread(th.id)}
                            className={`flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                              active ? 'border-l-2 border-l-dc-accent bg-dc-accent/[0.08]' : 'border-l-2 border-l-transparent'
                            }`}
                          >
                            <div
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-dc-text/95 ring-1 ring-black/20"
                              style={{ backgroundColor: `hsl(${usernameToHue(th.title)} 35% 38%)` }}
                              aria-hidden
                            >
                              {(th.title.slice(0, 1) || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`line-clamp-2 text-[15px] font-medium leading-snug ${
                                  active ? 'text-dc-text' : 'text-dc-text-muted'
                                }`}
                              >
                                {th.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-dc-muted">
                                {catLabel ? (
                                  <span className="max-w-[140px] truncate rounded-full bg-dc-elevated-muted px-2 py-0.5 font-medium text-dc-text-muted">
                                    {catLabel}
                                  </span>
                                ) : null}
                                {catLabel && rel ? <span aria-hidden>·</span> : null}
                                {rel ? <span>{rel}</span> : null}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <main className="flex min-h-[280px] min-w-0 flex-1 flex-col bg-dc-elevated/95 lg:min-h-0">
              {threadDetail ? (
                <>
                  <div className="shrink-0 border-b border-dc-border px-4 py-4 lg:px-6">
                    <div className="mb-2 lg:hidden">
                      <button
                        type="button"
                        onClick={() => setThreadDetail(null)}
                        className="text-xs font-medium text-dc-accent hover:underline"
                      >
                        ← Thread list
                      </button>
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 text-lg font-semibold leading-tight text-dc-text sm:text-xl">
                        {threadDetail.thread.title}
                      </h2>
                      {isAuthenticated && (
                        (() => {
                          const target = orgForumThreadTarget(threadDetail.thread.id)
                          return (
                            <ReportAction
                              variant="button"
                              targetType={target.targetType}
                              targetId={target.targetId}
                              targetLabel="thread"
                              surface="org_forum"
                              className="shrink-0 text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"
                            />
                          )
                        })()
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-dc-muted">
                      {threadDetail.posts.length} {threadDetail.posts.length === 1 ? 'post' : 'posts'} in this thread
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4 lg:px-6 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
                    <ForumPostList
                      posts={threadDetail.posts}
                      threadAuthorId={threadDetail.thread.authorId}
                      moderatorUserIds={orgForumModeratorUserIds}
                      viewerUserId={viewerUserId}
                      formatRelativeTime={formatForumRelativeTime}
                      usernameHue={usernameToHue}
                      renderFooter={(p) => (
                        <>
                          {org.isMember && (
                            <>
                              <button
                                type="button"
                                onClick={() => void togglePostReaction(p.id, 'thanks')}
                                className={`text-[11px] font-medium ${
                                  p.viewerHasThanks ? 'text-dc-accent' : 'text-dc-muted hover:text-dc-text'
                                }`}
                              >
                                Thanks{p.thanksCount ? ` · ${p.thanksCount}` : ''}
                              </button>
                              <button
                                type="button"
                                onClick={() => void togglePostReaction(p.id, 'helpful')}
                                className={`text-[11px] font-medium ${
                                  p.viewerHasHelpful
                                    ? 'text-dc-accent'
                                    : 'text-dc-muted hover:text-dc-text'
                                }`}
                              >
                                Helpful{p.helpfulCount ? ` · ${p.helpfulCount}` : ''}
                              </button>
                            </>
                          )}
                          {isAuthenticated && (
                            (() => {
                              const target = orgForumPostTarget(p.id)
                              return (
                                <ReportAction
                                  variant="button"
                                  targetType={target.targetType}
                                  targetId={target.targetId}
                                  targetLabel="forum post"
                                  surface="org_forum"
                                  className="text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"
                                />
                              )
                            })()
                          )}
                          {canModerate && (
                            <button
                              type="button"
                              onClick={() =>
                                void fetch(
                                  `/api/v1/organizations/${orgKey}/forum/posts/${encodeURIComponent(p.id)}/hide`,
                                  { method: 'POST', credentials: 'include' }
                                ).then(() => {
                                  if (threadDetail?.thread.id) void openThread(threadDetail.thread.id)
                                })
                              }
                              className="text-[11px] font-medium text-amber-200/90 hover:text-amber-100"
                            >
                              Hide
                            </button>
                          )}
                        </>
                      )}
                    />
                  </div>
                  {threadDetail.thread.lockedAt && !canModerate ? (
                    <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                      This thread is locked. New replies are disabled.
                    </p>
                  ) : null}
                  <ForumThreadReplyComposer
                    canReply={
                      Boolean(org?.isMember) &&
                      !org?.viewerScopeBanned &&
                      (!threadDetail.thread.lockedAt || canModerate)
                    }
                    postsUrl={`/api/v1/organizations/${orgKey}/forum/threads/${encodeURIComponent(threadDetail.thread.id)}/posts`}
                    onSuccess={() => void openThread(threadDetail.thread.id)}
                  />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  {hasForumCategories ?
                    <>
                      <p className="text-base font-medium text-dc-text-muted">Select a thread</p>
                      <p className="max-w-xs text-sm text-dc-muted">
                        Choose a thread from the list to read the conversation. On small screens, use the list above.
                      </p>
                    </>
                  : <>
                      <p className="text-base font-medium text-dc-text-muted">Forums not set up yet</p>
                      <p className="max-w-sm text-sm text-dc-muted">
                        {canModerate || canManageOrg ?
                          'Create a forum category in the organizer dashboard, then members can start threads here.'
                        : 'Organizers need to add forum categories before discussions can begin.'}
                      </p>
                      {canModerate || canManageOrg ?
                        <Link
                          to={`${commsSetupHref}#forum-categories`}
                          className="mt-2 text-sm font-semibold text-dc-accent hover:underline"
                        >
                          Go to forum setup →
                        </Link>
                      : null}
                    </>
                  }
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {tab === 'Chat' && (
        membersJoinPreview ?
          <MembersJoinCommunityGate onJoin={() => void joinLeave(true)} />
        : <div className="flex min-h-[min(70vh,640px)] max-h-[min(85vh,820px)] flex-col overflow-hidden rounded-xl border border-black/40 bg-[#1e1f22] shadow-2xl ring-1 ring-white/5 lg:flex-row">
          <aside className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-black/40 bg-[#1e1f22] lg:max-h-none lg:w-[232px] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-black/30 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Channels</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
              {channelsLoadErr ?
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-red-300">{channelsLoadErr}</p>
                </div>
              : chatApiDisabled ?
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-zinc-400">Chat is disabled for this organization.</p>
                </div>
              : channels === null ? (
                <div className="mx-1 my-1 h-24 animate-pulse rounded-md bg-dc-elevated-muted" />
              ) : channels.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-zinc-400">No channels yet</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {canModerate || canManageOrg ?
                      'Create a chat channel in the organizer dashboard.'
                    : 'Ask an organizer to add a channel.'}
                  </p>
                  {canModerate || canManageOrg ?
                    <Link
                      to={`${commsSetupHref}#chat-channels`}
                      className="mt-2 inline-block text-xs font-semibold text-dc-accent hover:underline"
                    >
                      Set up chat →
                    </Link>
                  : null}
                </div>
              ) : chatChannelSections ? (
                <div className="space-y-3">
                  {chatChannelSections.sections
                    .filter((s) => s.channels.length > 0)
                    .map(({ cat, channels: chs }) => (
                      <div key={cat.id}>
                        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          {cat.name}
                        </p>
                        <ul className="space-y-0.5">
                          {chs.map((ch) => {
                            const active = channelId === ch.id
                            const prefix = orgChatChannelPrefix(ch.kind)
                            return (
                              <li key={ch.id}>
                                <button
                                  type="button"
                                  onClick={() => setChannelId(ch.id)}
                                  className={`flex w-full items-center gap-0.5 rounded px-2 py-1.5 text-left text-[15px] leading-snug transition-colors ${
                                    active
                                      ? 'bg-[#3f4248] text-zinc-100'
                                      : 'text-zinc-400 hover:bg-[#34373c] hover:text-zinc-200'
                                  }`}
                                >
                                  {prefix}
                                  <span className="min-w-0 flex-1 truncate font-medium">{ch.name}</span>
                                  {ch.kind !== 'TEXT' && ch.kind !== 'ANNOUNCEMENTS' && ch.kind !== 'VOICE' && ch.kind !== 'DISCORD' && (
                                    <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
                                      {ch.kind}
                                    </span>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  {chatChannelSections.uncategorized.length > 0 && (
                    <div>
                      {(channelCategories?.length ?? 0) > 0 && (
                        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Uncategorized
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {chatChannelSections.uncategorized.map((ch) => {
                          const active = channelId === ch.id
                          const prefix = orgChatChannelPrefix(ch.kind)
                          return (
                            <li key={ch.id}>
                              <button
                                type="button"
                                onClick={() => setChannelId(ch.id)}
                                className={`flex w-full items-center gap-0.5 rounded px-2 py-1.5 text-left text-[15px] leading-snug transition-colors ${
                                  active
                                    ? 'bg-[#3f4248] text-zinc-100'
                                    : 'text-zinc-400 hover:bg-[#34373c] hover:text-zinc-200'
                                }`}
                              >
                                {prefix}
                                <span className="min-w-0 flex-1 truncate font-medium">{ch.name}</span>
                                {ch.kind !== 'TEXT' && ch.kind !== 'ANNOUNCEMENTS' && ch.kind !== 'VOICE' && ch.kind !== 'DISCORD' && (
                                  <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
                                    {ch.kind}
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#313338]">
            {selectedChannel ? (
              <>
                <header className="flex h-11 shrink-0 items-center gap-2 border-b border-black/25 px-4 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
                  {isVoiceChannel ? (
                    <span className="text-zinc-500" aria-hidden>
                      🔊
                    </span>
                  ) : isDiscordChannel ? (
                    <span
                      className="rounded bg-[#5865F2]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#949cf7]"
                      aria-hidden
                    >
                      DC
                    </span>
                  ) : (
                    <span className="select-none font-mono text-xl font-light leading-none text-zinc-500" aria-hidden>
                      #
                    </span>
                  )}
                  <h2 className="truncate text-base font-semibold tracking-tight text-dc-text">{selectedChannel.name}</h2>
                  {selectedChannel.kind === 'ANNOUNCEMENTS' && (
                    <span className="rounded bg-dc-elevated-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Announcements
                    </span>
                  )}
                  {isDiscordChannel ?
                    <span className="rounded bg-[#5865F2]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#949cf7]">
                      Discord
                    </span>
                  : null}
                </header>

                {isDiscordChannel ?
                  <OrgDiscordEmbedPanel channelName={selectedChannel.name} embedUrl={selectedChannel.embedUrl} />
                : !isTextChatChannel ?
                  isVoiceChannel && org.isMember && isAuthenticated ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
                      <OrgVoicePanel
                        orgKey={orgKey}
                        channelId={selectedChannel.id}
                        channelName={selectedChannel.name}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                      <p className="mb-1 font-mono text-lg text-zinc-400">#{selectedChannel.name}</p>
                      <p className="max-w-md text-sm text-zinc-500">
                        {isVoiceChannel
                          ? 'Join the organization and sign in to use voice.'
                          : 'This channel type is not supported in the chat panel.'}
                      </p>
                    </div>
                  )
                : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]">
                      {chanMsgs === null ? (
                        <div className="space-y-3 px-2 py-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex gap-3">
                              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-dc-elevated-muted" />
                              <div className="flex-1 space-y-2 pt-1">
                                <div className="h-3 w-28 animate-pulse rounded bg-dc-elevated-muted" />
                                <div className="h-3 w-full max-w-md animate-pulse rounded bg-white/[0.06]" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : chanMsgs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                          <p className="text-lg font-semibold text-zinc-300">Welcome to #{selectedChannel.name}</p>
                          <p className="mt-1 max-w-sm text-sm text-zinc-500">
                            This is the start of the channel. Send a message to say hello.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {chanMsgs.map((m) => {
                            const hue = usernameToHue(m.username)
                            const ts = formatChatTimestamp(m.createdAt)
                            return (
                              <li
                                key={m.id}
                                className="group relative flex gap-3 rounded-md px-2 py-1 hover:bg-black/[0.18]"
                              >
                                <div
                                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-dc-text/95 shadow-inner ring-1 ring-black/30"
                                  style={{ backgroundColor: `hsl(${hue} 42% 38%)` }}
                                  aria-hidden
                                >
                                  {(m.username.slice(0, 1) || '?').toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1 pb-0.5">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                    <span
                                      className="text-[15px] font-semibold"
                                      style={{ color: `hsl(${hue} 50% 72%)` }}
                                    >
                                      {m.username}
                                    </span>
                                    {ts ? (
                                      <time className="text-[11px] font-medium text-zinc-500" dateTime={m.createdAt}>
                                        {ts}
                                      </time>
                                    ) : null}
                                    {isAuthenticated && channelId && (
                                      (() => {
                                        const target = orgChannelMessageTarget(m.id)
                                        return (
                                          <ReportAction
                                            variant="button"
                                            targetType={target.targetType}
                                            targetId={target.targetId}
                                            targetLabel="chat message"
                                            surface="org_chat"
                                            className="ml-auto text-[10px] font-medium text-zinc-600 opacity-0 transition-opacity hover:text-dc-accent group-hover:opacity-100 min-h-0 px-0"
                                          />
                                        )
                                      })()
                                    )}
                                  </div>
                                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[1.45] text-zinc-200">
                                    {m.body}
                                  </p>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    {org.viewerScopeBanned ? (
                      <div className="shrink-0 border-t border-black/30 px-4 py-3">
                        <p className="text-sm text-amber-200/90">
                          You are banned from participating in this organization.
                        </p>
                      </div>
                    ) : org.isMember && canPostInSelectedChannel ? (
                      <div className="shrink-0 border-t border-black/30 bg-[#313338] px-4 pb-4 pt-3">
                        <div className="flex items-end gap-2 rounded-lg bg-[#383a40] px-3 py-2 ring-1 ring-black/25">
                          <input
                            value={msgDraft}
                            onChange={(e) => {
                              setMsgDraft(e.target.value)
                              if (msgErr) setMsgErr(null)
                            }}
                            placeholder={`Message #${selectedChannel.name}`}
                            className="min-h-[44px] flex-1 border-0 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                void postChannelMessage()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void postChannelMessage()}
                            className="mb-0.5 shrink-0 rounded-md bg-dc-accent px-3 py-2 text-sm font-semibold text-dc-text hover:brightness-110"
                          >
                            Send
                          </button>
                        </div>
                        {msgErr ?
                          <p className="mt-2 text-sm text-red-400">{msgErr}</p>
                        : null}
                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{ORG_GROUP_CHAT_DISCLAIMER}</p>
                      </div>
                    ) : org.isMember && selectedChannel.kind === 'ANNOUNCEMENTS' && !canModerate ? (
                      <div className="shrink-0 border-t border-black/30 px-4 py-3">
                        <p className="text-sm text-zinc-400">Only moderators can post in announcement channels.</p>
                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{ORG_GROUP_CHAT_DISCLAIMER}</p>
                      </div>
                    ) : !org.isMember ? (
                      <div className="shrink-0 border-t border-black/30 px-4 py-3">
                        <p className="text-sm text-zinc-500">
                          {isAuthenticated ?
                            'Join this organization to send messages in chat.'
                          : (
                            <>
                              <Link to={buildLoginHref(`/orgs/${encodeURIComponent(slug)}`)} className="font-semibold text-dc-accent hover:underline">
                                Sign in
                              </Link>{' '}
                              and join to send messages in chat.
                            </>
                          )}
                        </p>
                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{ORG_GROUP_CHAT_DISCLAIMER}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
                <p className="text-lg font-semibold text-zinc-300">Organization chat</p>
                {chatApiDisabled ?
                  <p className="max-w-sm text-sm text-zinc-500">Chat is disabled for this organization.</p>
                : channelsLoadErr ?
                  <p className="max-w-sm text-sm text-red-300">{channelsLoadErr}</p>
                : hasChatChannels ?
                  <p className="max-w-sm text-sm text-zinc-500">Pick a channel on the left to open the conversation.</p>
                : <>
                    <p className="max-w-sm text-sm text-zinc-500">
                      Chat is enabled, but no channels exist yet.
                      {canModerate || canManageOrg ?
                        ' Create your first channel in the organizer dashboard.'
                      : ' Ask an organizer to add a channel.'}
                    </p>
                    {canModerate || canManageOrg ?
                      <Link
                        to={`${commsSetupHref}#chat-channels`}
                        className="mt-2 text-sm font-semibold text-dc-accent hover:underline"
                      >
                        Create chat channel →
                      </Link>
                    : null}
                  </>
                }
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'Subgroups' && (
        <div className="space-y-6">
          <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6">
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Lightweight groups</h2>
            <p className="text-sm text-dc-text-muted mb-4">
              Sub-groups are casual spaces linked to this organization (separate from the org hub). Enable the module in
              Overview if you do not see this tab.
            </p>
            {subgroups === null ? (
              <div className="h-24 animate-pulse bg-dc-elevated-muted rounded-xl" />
            ) : subgroups.length === 0 ? (
              <p className="text-sm text-dc-muted">No sub-groups yet.</p>
            ) : (
              <ul className="space-y-2">
                {subgroups.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`/groups/${g.id}`}
                      className="block rounded-xl border border-dc-border px-4 py-3 hover:border-dc-accent-border/40 text-dc-accent"
                    >
                      <span className="font-medium text-dc-text">{g.name}</span>
                      <span className="text-xs text-dc-muted ml-2">/{g.slug}</span>
                      {typeof g.memberCount === 'number' && (
                        <span className="text-xs text-dc-muted ml-2">{g.memberCount} members</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      </OrgCommunityShell>
    </>
  )
}
