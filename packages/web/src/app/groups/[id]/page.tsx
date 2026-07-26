import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import ChannelPostsSection from '@/components/group/ChannelPostsSection'
import EmptyState from '@/components/ui/EmptyState'
import GroupEventCalendar from '@/components/GroupEventCalendar'
import GroupEventsSection from '@/components/group/GroupEventsSection'
import GroupCommunityHubIntro from '@/components/group/GroupCommunityHubIntro'
import GroupCommunityShell, {
  API_GROUP_TABS,
  groupCommunityTabs,
  MOCK_GROUP_TABS,
} from '@/components/group/GroupCommunityShell'
import ScopeEmailSignupForm from '@/components/email/ScopeEmailSignupForm'
import GroupMembersSection from '@/components/group/GroupMembersSection'
import GroupPhotoAlbumPreview from '@/components/GroupPhotoAlbumPreview'
import GroupPhotosSection from '@/components/group/GroupPhotosSection'
import GroupResourcesSection from '@/components/group/GroupResourcesSection'
import GroupForumsSection from '@/components/group/GroupForumsSection'
import GroupFeedbackSection from '@/components/group/GroupFeedbackSection'
import GroupLeadershipElectionSection from '@/components/group/GroupLeadershipElectionSection'
import GroupJoinRulesModal from '@/components/group/GroupJoinRulesModal'
import GroupMembershipSettingsPanel from '@/components/group/GroupMembershipSettingsPanel'
import GroupMembershipPrivacyPrompt, {
  type GroupJoinPrivacyChoices,
} from '@/components/group/GroupMembershipPrivacyPrompt'
import ScopePageMeta from '@/components/seo/ScopePageMeta'
import { useAppToast } from '@/components/ui/AppToast'
import { defaultFeedActivityPrivacy, type FeedActivityPrivacy } from '@c2k/shared'
import { GroupDetailProvider } from '@/contexts/GroupDetailContext'
import { useGroupDetail } from '@/hooks/useGroupDetail'
import { useTabFromUrl } from '@/hooks/useTabFromUrl'
import {
  addMockGroupMember,
  removeMockGroupMember,
  addMockGroupPhoto,
  addMockResource,
  removeMockResource,
  withdrawMockGroupPhoto,
  MOCK_VIEWER_USERNAME,
} from '@/data/mock-data'
import { useViewerUsername } from '@/contexts/AuthContext'

export default function GroupDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupIdOrSlug = (params.id as string) ?? undefined
  const viewerUsername = useViewerUsername()

  const {
    group,
    channels,
    members: groupMembers,
    events: groupEvents,
    eventsLoading,
    photos: groupPhotos,
    pendingPhotos,
    myPendingPhotos,
    resources: groupResources,
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
    refreshPhotos,
    refreshChannels,
    refreshResources,
    refreshMembers,
  } = useGroupDetail(groupIdOrSlug)

  const GROUP_TABS = useMemo(() => groupCommunityTabs(apiBacked), [apiBacked])
  const [activeTab, setActiveTabState] = useTabFromUrl(
    GROUP_TABS,
    GROUP_TABS[0] ?? (apiBacked ? API_GROUP_TABS[0] : MOCK_GROUP_TABS[0])
  )

  useEffect(() => {
    if (!(GROUP_TABS as readonly string[]).includes(activeTab)) {
      setActiveTabState(GROUP_TABS[0] ?? 'Events')
    }
  }, [GROUP_TABS, activeTab, setActiveTabState])

  const selectTab = useCallback(
    (nextTab: string) => {
      setActiveTabState(nextTab)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', nextTab)
          return p
        },
        { replace: false },
      )
    },
    [setActiveTabState, setSearchParams],
  )

  useEffect(() => {
    if (!group || !canModerate) return
    const raw = searchParams.get('tab')
    if (raw === 'Settings' || raw?.toLowerCase() === 'settings') {
      navigate(`/organizer/groups/${encodeURIComponent(group.id)}`, { replace: true })
    }
  }, [group, canModerate, searchParams, navigate])

  const forumThreadParam = searchParams.get('thread')
  const THREAD_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  useEffect(() => {
    if (!forumThreadParam || !apiBacked) return
    const tid = forumThreadParam.trim()
    if (!THREAD_UUID_RE.test(tid)) return
    if (activeTab !== 'Forums') {
      setActiveTabState('Forums')
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'Forums')
          return p
        },
        { replace: true },
      )
    }
  }, [forumThreadParam, apiBacked, activeTab, setActiveTabState, setSearchParams])

  /** UI state: channels tab, photo upload, resources form. */
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [uploadPhotoOpen, setUploadPhotoOpen] = useState(false)
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingPostTitle, setEditingPostTitle] = useState('')
  const [editingPostContent, setEditingPostContent] = useState('')
  const [addResourceOpen, setAddResourceOpen] = useState(false)
  const [newResourceName, setNewResourceName] = useState('')
  const [newResourceLink, setNewResourceLink] = useState('')
  const [newResourceType, setNewResourceType] = useState('Link')
  const [joinRulesOpen, setJoinRulesOpen] = useState(false)
  const [joinPrivacyOpen, setJoinPrivacyOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [feedActivityPrivacy, setFeedActivityPrivacy] = useState<FeedActivityPrivacy>(defaultFeedActivityPrivacy)
  const toast = useAppToast()

  useEffect(() => {
    if (!apiBacked) return
    void fetch('/api/settings/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { privacy?: { feedActivityPrivacy?: FeedActivityPrivacy } } | null) => {
        if (data?.privacy?.feedActivityPrivacy) {
          setFeedActivityPrivacy(data.privacy.feedActivityPrivacy)
        }
      })
      .catch(() => {})
  }, [apiBacked])

  const joinPrivacyDefaults = useMemo(
    () => ({
      memberListVisibility:
        feedActivityPrivacy.defaultGroupMemberListVisibility === 'hidden' ? ('hidden' as const) : ('visible' as const),
      showGroupOnProfile: feedActivityPrivacy.defaultShowGroupsOnProfile,
      announceGroupJoinInFeed: feedActivityPrivacy.defaultAnnounceGroupJoins,
    }),
    [feedActivityPrivacy],
  )

  const upcomingEventCount = useMemo(() => {
    const now = Date.now()
    return groupEvents.filter((e) => {
      const t = e.startsAt ? new Date(e.startsAt).getTime() : Number.NaN
      return !Number.isNaN(t) && t >= now
    }).length
  }, [groupEvents])

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].id)
    }
  }, [channels, selectedChannel])

  if (detailLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" role="status">
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-dc-elevated-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-8 max-w-sm animate-pulse rounded-lg bg-dc-elevated-muted" />
              <div className="h-4 max-w-md animate-pulse rounded bg-dc-elevated-muted" />
              <div className="h-4 max-w-xs animate-pulse rounded bg-dc-elevated-muted" />
              <div className="flex gap-2 pt-2">
                <div className="h-11 w-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
                <div className="h-11 w-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
          ))}
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-dc-elevated-muted" />
      </div>
    )
  }

  if (detailError) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <EmptyState
          title="Could not load group"
          message="The server did not return group details. Check your connection and try again."
          actionLabel="Retry"
          onAction={refreshDetail}
          secondaryCtaLabel="Back to groups"
          secondaryCtaHref="/groups"
        />
      </div>
    )
  }

  if (mockPreviewBlocked) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <EmptyState
          title="This is a demo group preview"
          message="Sample groups with fictional channels and photos are only available in signed-out demo mode. Discover real communities from the directory."
          ctaLabel="Discover groups"
          ctaHref="/groups"
        />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <EmptyState
          message={
            detailNotFound ?
              'This group does not exist or was removed.'
            : 'Group not found.'
          }
          ctaLabel="Back to groups"
          ctaHref="/groups"
        />
      </div>
    )
  }

  const contextValue = {
    group,
    viewerRole,
    canManage,
    canModerate,
    isMember,
    refreshPhotos,
    refreshChannels,
    refreshResources,
    refreshMembers,
  }

  const startJoinFlow = () => {
    if (apiBacked && feedActivityPrivacy.defaultGroupMemberListVisibility === 'ask') {
      setJoinPrivacyOpen(true)
      return
    }
    void performJoin()
  }

  const performJoin = async (choices?: GroupJoinPrivacyChoices) => {
    if (apiBacked) {
      setJoining(true)
      try {
        const body =
          choices ?
            {
              memberListVisibility: choices.memberListVisibility,
              showGroupOnProfile: choices.showGroupOnProfile,
              announceGroupJoinInFeed: choices.announceGroupJoinInFeed,
              rememberAsDefault: choices.rememberAsDefault,
            }
          : {
              memberListVisibility:
                feedActivityPrivacy.defaultGroupMemberListVisibility === 'hidden' ? 'hidden' : 'visible',
              showGroupOnProfile: feedActivityPrivacy.defaultShowGroupsOnProfile,
              announceGroupJoinInFeed: feedActivityPrivacy.defaultAnnounceGroupJoins,
            }
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(group.id)}/join`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (r.ok) {
          const data = (await r.json()) as { confirmation?: string }
          if (data.confirmation) toast.push(data.confirmation)
          refreshMembers()
          refreshDetail()
        }
      } finally {
        setJoining(false)
        setJoinRulesOpen(false)
        setJoinPrivacyOpen(false)
      }
    } else if (viewerUsername && addMockGroupMember({ groupId: group.id, username: viewerUsername })) {
      refreshMembers()
    }
  }

  const hubIntro =
    group ?
      <GroupCommunityHubIntro
        group={group}
        isMember={isMember}
        apiBacked={apiBacked}
        upcomingEventCount={upcomingEventCount}
        canModerate={canModerate}
        onGoToTab={selectTab}
      />
    : null

  return (
    <GroupDetailProvider value={contextValue}>
      <ScopePageMeta
        title={group.name}
        description={`${group.name}. Community group on Kink Social`}
        path={`/groups/${encodeURIComponent(group.id)}`}
        shareImageUrl={group.shareImageUrl}
        bannerUrl={group.coverImageUrl}
        logoUrl={group.logoUrl}
      />
      <GroupCommunityShell
        name={group.name}
        groupId={group.id}
        memberCount={group.members}
        coverImageUrl={group.coverImageUrl}
        logoUrl={group.logoUrl}
        parentOrganization={parentOrganization}
        placeLabel={group.placeLabel}
        category={group.category}
        visibility={group.visibility}
        description={group.description ?? group.descriptionSnippet ?? null}
        tags={group.tags}
        viewerRole={viewerRole}
        isMember={isMember}
        canModerate={canModerate}
        showOrganizerConsole={apiBacked}
        tabs={GROUP_TABS}
        activeTab={activeTab}
        onTabChange={selectTab}
        onJoin={() => {
          if (apiBacked && group.rules && group.rules.length > 0) {
            setJoinRulesOpen(true)
            return
          }
          startJoinFlow()
        }}
        onLeave={() => {
          void (async () => {
            if (apiBacked) {
              const r = await fetch(`/api/v1/groups/${encodeURIComponent(group.id)}/leave`, {
                method: 'POST',
                credentials: 'include',
              })
              if (r.ok) refreshMembers()
            } else if (viewerUsername && removeMockGroupMember(group.id, viewerUsername)) {
              refreshMembers()
            }
          })()
        }}
        beforeTabs={
          <>
            {hubIntro}
            {apiBacked && leadershipVoteOpen ?
              <GroupLeadershipElectionSection
                groupId={group.id}
                isMember={isMember}
                onFinalized={() => refreshMembers()}
              />
            : null}
          </>
        }
      >
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {!apiBacked && activeTab === 'Channels' && (
            <aside className="lg:w-56 flex-shrink-0 hidden lg:block">
              <div className="sticky top-24 space-y-1">
                <h3 className="text-xs font-semibold text-dc-muted uppercase mb-2">Channels</h3>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                      selectedChannel === channel.id ?
                        'text-dc-accent bg-dc-accent/10'
                      : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                    }`}
                  >
                    # {channel.name}
                    {channel.isVettedOnly && <span className="text-dc-muted text-xs">🔒</span>}
                  </button>
                ))}
              </div>
            </aside>
          )}

          <main className="flex-1 min-w-0">
            {activeTab === 'Forums' && apiBacked && (
              <GroupForumsSection
                groupId={group.id}
                members={groupMembers}
                groupOwnerId={groupOwnerId}
                isMember={isMember}
                initialThreadId={forumThreadParam}
              />
            )}

            {activeTab === 'Feedback' && apiBacked && (
              <GroupFeedbackSection groupId={group.id} isMember={isMember} />
            )}

            {!apiBacked && activeTab === 'Channels' && (
              <div className="space-y-6">
                {channels.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto lg:hidden" role="tablist" aria-label="Channels">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        role="tab"
                        aria-selected={selectedChannel === channel.id}
                        onClick={() => setSelectedChannel(channel.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm min-h-11 ${
                          selectedChannel === channel.id ?
                            'bg-dc-accent/20 text-dc-accent'
                          : 'bg-dc-elevated-muted text-dc-text-muted'
                        }`}
                      >
                        <span># {channel.name}</span>
                        {channel.isVettedOnly && <span className="text-dc-muted text-xs" aria-hidden>🔒</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedChannel ?
                  <ChannelPostsSection
                    channelId={selectedChannel}
                    canModerate={false}
                    editingPostId={editingPostId}
                    editingPostTitle={editingPostTitle}
                    editingPostContent={editingPostContent}
                    setEditingPostId={setEditingPostId}
                    setEditingPostTitle={setEditingPostTitle}
                    setEditingPostContent={setEditingPostContent}
                    onRefresh={refreshChannels}
                  />
                : <p className="text-dc-muted">Select a channel.</p>}
              </div>
            )}

            {activeTab === 'Events' && (
              <GroupEventsSection
                events={groupEvents}
                loading={apiBacked && eventsLoading}
                groupId={apiBacked ? group.id : undefined}
                groupName={group.name}
                canModerate={canModerate}
                apiBacked={apiBacked}
              />
            )}

            {activeTab === 'Members' && (
              <>
                <GroupMembersSection
                  members={groupMembers}
                  staffHiddenMemberCount={staffHiddenMemberCount}
                  showStaffHiddenNote={canModerate}
                />
                {apiBacked && isMember ?
                  <GroupMembershipSettingsPanel
                    groupId={group.id}
                    groupName={group.name}
                    viewerMembership={viewerMembership ?? null}
                    onUpdated={() => refreshDetail()}
                    onLeave={() => {
                      void (async () => {
                        const r = await fetch(`/api/v1/groups/${encodeURIComponent(group.id)}/leave`, {
                          method: 'POST',
                          credentials: 'include',
                        })
                        if (r.ok) {
                          refreshMembers()
                          refreshDetail()
                        }
                      })()
                    }}
                  />
                : null}
              </>
            )}

            {!apiBacked && activeTab === 'Resources' && (
              <GroupResourcesSection
                resources={groupResources}
                addResourceOpen={addResourceOpen}
                setAddResourceOpen={setAddResourceOpen}
                newResourceName={newResourceName}
                setNewResourceName={setNewResourceName}
                newResourceLink={newResourceLink}
                setNewResourceLink={setNewResourceLink}
                newResourceType={newResourceType}
                setNewResourceType={setNewResourceType}
                onAddResource={() => {
                  addMockResource({ groupId: group.id, name: newResourceName, link: newResourceLink || '#', type: newResourceType })
                  setNewResourceName('')
                  setNewResourceLink('')
                  setNewResourceType('Link')
                  setAddResourceOpen(false)
                  refreshResources()
                }}
                onRemoveResource={(id) => {
                  removeMockResource(id)
                  refreshResources()
                }}
              />
            )}

            {!apiBacked && activeTab === 'Photos' && (
              <GroupPhotosSection
                photos={groupPhotos}
                pendingPhotos={pendingPhotos}
                myPendingPhotos={myPendingPhotos}
                uploadPhotoOpen={uploadPhotoOpen}
                setUploadPhotoOpen={setUploadPhotoOpen}
                uploadTags={uploadTags}
                setUploadTags={setUploadTags}
                denyPhotoId={null}
                setDenyPhotoId={() => {}}
                denyReason=""
                setDenyReason={() => {}}
                onPhotoUpload={(result) => {
                  addMockGroupPhoto({
                    groupId: group.id,
                    url: result.objectUrl,
                    caption: result.caption,
                    authorUsername: viewerUsername || MOCK_VIEWER_USERNAME,
                    tags: uploadTags.length > 0 ? uploadTags : undefined,
                  })
                  refreshPhotos()
                }}
                onApprovePhoto={() => {}}
                onDenyPhoto={() => {}}
                onWithdrawPhoto={(id) => {
                  withdrawMockGroupPhoto(id, viewerUsername || MOCK_VIEWER_USERNAME)
                  refreshPhotos()
                }}
                onRemovePhoto={() => {}}
              />
            )}
          </main>

          {(GROUP_TABS as readonly string[]).includes(activeTab) && (
            <aside className="lg:w-64 flex-shrink-0 hidden xl:block">
              <div className="sticky top-24 space-y-4">
                {(activeTab === 'Events' || activeTab === 'Members') && (
                  <GroupEventCalendar events={groupEvents} compact groupId={group.id} />
                )}
                {!apiBacked && (MOCK_GROUP_TABS as readonly string[]).includes(activeTab) && (
                  <GroupPhotoAlbumPreview photos={groupPhotos} groupId={group.id} />
                )}
                <ScopeEmailSignupForm scopeType="group" scopeKey={group.id} />
              </div>
            </aside>
          )}
        </div>
      </GroupCommunityShell>
      {joinRulesOpen && group.rules && group.rules.length > 0 ?
        <GroupJoinRulesModal
          groupName={group.name}
          rules={group.rules}
          joining={joining}
          onClose={() => {
            if (!joining) setJoinRulesOpen(false)
          }}
          onConfirm={() => {
            setJoinRulesOpen(false)
            startJoinFlow()
          }}
        />
      : null}
      {joinPrivacyOpen ?
        <GroupMembershipPrivacyPrompt
          open={joinPrivacyOpen}
          groupName={group.name}
          defaults={joinPrivacyDefaults}
          joining={joining}
          onCancel={() => {
            if (!joining) setJoinPrivacyOpen(false)
          }}
          onConfirm={(choices) => {
            void performJoin(choices)
          }}
        />
      : null}
    </GroupDetailProvider>
  )
}
