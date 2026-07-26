import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GroupDiscoverListCard from '@/components/groups/GroupDiscoverListCard'
import GroupsPersonalLeftRail from '@/components/groups/GroupsPersonalLeftRail'
import GroupsSectionTabs from '@/components/groups/GroupsSectionTabs'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMyGroups, type MyGroupListItem } from '@/hooks/useApiMyGroups'
import type { GroupsSectionMode } from '@/lib/groups-section-mode'
import { isStubGroupsLibraryMode } from '@/lib/group-detail-guards'
import type { MockGroup } from '@/data/types'

const META: Record<
  Exclude<GroupsSectionMode, 'discover'>,
  { title: string; subtitle: string }
> = {
  my: {
    title: 'My Groups',
    subtitle: 'Groups you belong to, moderate, or organize.',
  },
  invitations: {
    title: 'Group Invitations',
    subtitle: 'Invites and join requests waiting for your response.',
  },
  posts: {
    title: 'My Group Posts',
    subtitle: 'Posts and discussions you created inside groups.',
  },
  saved: {
    title: 'Saved Groups',
    subtitle: 'Groups you bookmarked for later.',
  },
}

const STUB_COPY: Record<Exclude<GroupsSectionMode, 'discover' | 'my'>, { title: string; message: string }> = {
  invitations: {
    title: 'Group invitations — coming later',
    message:
      'Invites and join requests are not available in the app yet. Browse discover to find groups to join today.',
  },
  posts: {
    title: 'My group posts — coming later',
    message:
      'A personal list of your group forum threads and replies will appear here in a future update. Visit a group’s Forums tab to participate now.',
  },
  saved: {
    title: 'Saved groups — coming later',
    message:
      'Bookmarking groups for later is not available yet. Use My Groups for communities you have already joined.',
  },
}

type MyGroupsTab = 'joined' | 'moderating' | 'created' | 'archived'
type InvitationsTab = 'invites' | 'sent'
type PostsTab = 'published' | 'drafts' | 'replies'

function mapMyGroup(row: MyGroupListItem): MockGroup {
  const vis =
    row.visibility === 'private' ? 'private' : row.visibility === 'invite-only' ? 'invite-only' : 'public'
  return {
    id: row.id,
    name: row.name,
    members: row.memberCount ?? 0,
    slug: row.slug,
    visibility: vis,
    category: row.category ?? null,
    tags: row.tags ?? undefined,
    descriptionSnippet: row.descriptionSnippet ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    placeLabel: row.placeLabel ?? null,
    location: row.placeLabel ?? undefined,
    joinMode: vis === 'public' ? 'open' : 'apply',
  }
}

function roleBucket(role: string): Exclude<MyGroupsTab, 'archived'> {
  const r = role.toLowerCase()
  if (r === 'owner' || r === 'creator') return 'created'
  if (r === 'admin' || r === 'moderator' || r === 'mod') return 'moderating'
  return 'joined'
}

type Props = {
  mode: Exclude<GroupsSectionMode, 'discover'>
}

export default function GroupsPersonalLibraryPage({ mode }: Props) {
  const { isAuthenticated, isFallback } = useAuth()
  const showApi = isAuthenticated && !isFallback
  const myGroups = useApiMyGroups(showApi && mode === 'my')
  const [myTab, setMyTab] = useState<MyGroupsTab>('joined')
  const [invitationsTab, setInvitationsTab] = useState<InvitationsTab>('invites')
  const [postsTab, setPostsTab] = useState<PostsTab>('published')
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)

  const meta = META[mode]

  if (showApi && isStubGroupsLibraryMode(mode)) {
    const stub = STUB_COPY[mode as keyof typeof STUB_COPY]
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">{stub.title}</h1>
        </header>
        <EmptyState
          inline
          title={stub.title}
          message={stub.message}
          ctaLabel="Discover groups"
          ctaHref="/groups"
          secondaryCtaLabel="My groups"
          secondaryCtaHref="/groups?tab=my"
        />
      </div>
    )
  }

  const myCounts = useMemo(() => {
    const c = { joined: 0, moderating: 0, created: 0, archived: 0 }
    for (const g of myGroups.items) {
      c[roleBucket(g.myRole)] += 1
    }
    return c
  }, [myGroups.items])

  const filteredMy = useMemo(() => {
    if (mode !== 'my' || myTab === 'archived') return []
    return myGroups.items
      .filter((g) => roleBucket(g.myRole) === myTab)
      .map(mapMyGroup)
  }, [mode, myGroups.items, myTab])

  const myGroupRows = useMemo(() => {
    if (mode !== 'my' || myGroups.status !== 'ready') return []
    return myGroups.items.map(mapMyGroup)
  }, [mode, myGroups.items, myGroups.status])

  const myTabs = useMemo(
    () =>
      [
        { id: 'joined', label: 'Joined', count: myCounts.joined },
        { id: 'moderating', label: 'Moderating', count: myCounts.moderating },
        { id: 'created', label: 'Created', count: myCounts.created },
        { id: 'archived', label: 'Archived', count: myCounts.archived },
      ] as const,
    [myCounts],
  )

  const invitationsTabs = useMemo(
    () =>
      [
        { id: 'invites', label: 'Invites' },
        { id: 'sent', label: 'Requests sent' },
      ] as const,
    [],
  )

  const postsTabs = useMemo(
    () =>
      [
        { id: 'published', label: 'Published' },
        { id: 'drafts', label: 'Drafts' },
        { id: 'replies', label: 'Replies' },
      ] as const,
    [],
  )

  const emptyPanel = () => {
    switch (mode) {
      case 'my':
        return (
          <div className="px-6 py-12 text-center" role="status">
            <p className="text-lg font-semibold text-dc-text">You have not joined any groups yet</p>
            <p className="mt-2 text-sm text-dc-text-muted">
              Find communities around your interests, location, or events you attend.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/groups"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Discover groups
              </Link>
              <Link
                to="/groups/onboarding"
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
              >
                Create a group
              </Link>
            </div>
          </div>
        )
      case 'invitations':
        return (
          <EmptyState
            inline
            title="No group invitations yet"
            message="When someone invites you to a group, it will appear here."
            ctaLabel="Discover groups"
            ctaHref="/groups"
          />
        )
      case 'posts':
        return (
          <EmptyState
            inline
            title="You have not posted in any groups yet"
            message="Join a group and start participating in the conversation."
            ctaLabel="Discover groups"
            ctaHref="/groups"
          />
        )
      case 'saved':
        return (
          <EmptyState
            inline
            title="No saved groups yet"
            message="Save groups while browsing so you can return to them later."
            ctaLabel="Discover groups"
            ctaHref="/groups"
          />
        )
    }
  }

  const renderMyBody = () => {
    if (myGroups.status === 'loading') {
      return (
        <div className="space-y-4">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      )
    }
    if (myGroups.error) {
      return <LoadErrorBanner message={myGroups.error} onRetry={() => void myGroups.reload()} />
    }
    if (myTab === 'archived') {
      return (
        <p className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-4 py-8 text-center text-sm text-dc-text-muted">
          No archived groups yet.
        </p>
      )
    }
    if (myGroupRows.length === 0) return emptyPanel()
    if (filteredMy.length === 0) {
      return <p className="text-sm text-dc-text-muted">No groups in this tab.</p>
    }
    return (
      <ul className="space-y-4">
        {filteredMy.map((g) => (
          <li key={g.id}>
            <GroupDiscoverListCard group={g} />
          </li>
        ))}
      </ul>
    )
  }

  const renderInvitationsBody = () => {
    if (invitationsTab === 'sent') {
      return (
        <p className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-4 py-8 text-center text-sm text-dc-text-muted">
          No join requests sent yet.
        </p>
      )
    }
    return emptyPanel()
  }

  const renderPostsBody = () => emptyPanel()

  const renderSavedBody = () => emptyPanel()

  const body = () => {
    switch (mode) {
      case 'my':
        return (
          <>
            <GroupsSectionTabs tabs={myTabs} active={myTab} onChange={(id) => setMyTab(id as MyGroupsTab)} />
            {renderMyBody()}
          </>
        )
      case 'invitations':
        return (
          <>
            <GroupsSectionTabs
              tabs={invitationsTabs}
              active={invitationsTab}
              onChange={(id) => setInvitationsTab(id as InvitationsTab)}
            />
            {renderInvitationsBody()}
          </>
        )
      case 'posts':
        return (
          <>
            <GroupsSectionTabs tabs={postsTabs} active={postsTab} onChange={(id) => setPostsTab(id as PostsTab)} />
            {renderPostsBody()}
          </>
        )
      case 'saved':
        return renderSavedBody()
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setNavDrawerOpen((o) => !o)}
          className="inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-accent"
        >
          Groups menu
        </button>
      </div>
      {navDrawerOpen ?
        <div className="mb-6 lg:hidden">
          <GroupsPersonalLeftRail />
        </div>
      : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <GroupsPersonalLeftRail />
        </div>
        <main className="min-w-0">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">{meta.title}</h1>
            <p className="mt-2 text-sm text-dc-text-muted">{meta.subtitle}</p>
          </header>
          {body()}
          {mode === 'my' && myGroupRows.length > 0 ?
            <p className="mt-8 text-xs text-dc-muted">
              <Link to="/groups" className="text-dc-accent hover:underline">
                Discover more groups
              </Link>
            </p>
          : null}
        </main>
      </div>
    </div>
  )
}
