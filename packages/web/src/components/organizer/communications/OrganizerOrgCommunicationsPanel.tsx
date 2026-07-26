import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ForumCategory } from '@/components/organizer/admin/OrgForumModerationPanel'
import type { ChannelCategory, OrgChannel } from '@/components/organizer/admin/OrgChatModerationPanel'
import ChatChannelsManager from '@/components/organizer/communications/ChatChannelsManager'
import {
  CommsBottomCta,
  CommsPageHeader,
  CommsStatusRow,
  MemberFacingSpacesCard,
  ModerationReminderCard,
  SuggestedSetupCard,
} from '@/components/organizer/communications/comms-ui'
import ForumCategoriesManager from '@/components/organizer/communications/ForumCategoriesManager'
import { canManageOrgCommunications, computeCommsStats } from '@/lib/organizer/org-comms-utils'
import { canAccessOrganizerModeration } from '@/lib/organizer/types'

type Props = {
  orgSlug: string
  forumsEnabled: boolean
  chatEnabled: boolean
  showSettings: boolean
  viewerRole: string | null
}

export default function OrganizerOrgCommunicationsPanel({
  orgSlug,
  forumsEnabled,
  chatEnabled,
  showSettings,
  viewerRole,
}: Props) {
  const canManage = canManageOrgCommunications(viewerRole)
  const canModerate = canAccessOrganizerModeration(viewerRole)
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const publicHubHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Overview`
  const forumsHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Forums`
  const chatHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Chat`
  const settingsFeaturesHref = `${orgBase}?tab=settings&settingsSection=features`
  const moderationHref = `${orgBase}?tab=moderation`
  const forumSectionId = 'forum-categories'

  const [forumCategories, setForumCategories] = useState<ForumCategory[] | null>(null)
  const [channelCategories, setChannelCategories] = useState<ChannelCategory[] | null>(null)
  const [channels, setChannels] = useState<OrgChannel[] | null>(null)

  const reloadForums = useCallback(async () => {
    if (!forumsEnabled) {
      setForumCategories([])
      return
    }
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/forum/categories`, {
      credentials: 'include',
    })
    if (r.ok) {
      const d = (await r.json()) as { items: ForumCategory[] }
      setForumCategories(d.items ?? [])
    } else {
      setForumCategories([])
    }
  }, [orgSlug, forumsEnabled])

  const reloadChat = useCallback(async () => {
    if (!chatEnabled) {
      setChannelCategories([])
      setChannels([])
      return
    }
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/channels`, {
      credentials: 'include',
    })
    if (r.ok) {
      const d = (await r.json()) as { categories?: ChannelCategory[]; items: OrgChannel[] }
      setChannelCategories(d.categories ?? [])
      setChannels(d.items ?? [])
    } else {
      setChannelCategories([])
      setChannels([])
    }
  }, [orgSlug, chatEnabled])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const tasks: Promise<void>[] = []
        if (forumsEnabled) {
          tasks.push(
            (async () => {
              const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/forum/categories`, {
                credentials: 'include',
              })
              if (cancelled) return
              if (r.ok) {
                const d = (await r.json()) as { items: ForumCategory[] }
                setForumCategories(d.items ?? [])
              } else setForumCategories([])
            })(),
          )
        } else {
          setForumCategories([])
        }
        if (chatEnabled) {
          tasks.push(
            (async () => {
              const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/channels`, {
                credentials: 'include',
              })
              if (cancelled) return
              if (r.ok) {
                const d = (await r.json()) as { categories?: ChannelCategory[]; items: OrgChannel[] }
                setChannelCategories(d.categories ?? [])
                setChannels(d.items ?? [])
              } else {
                setChannelCategories([])
                setChannels([])
              }
            })(),
          )
        } else {
          setChannelCategories([])
          setChannels([])
        }
        await Promise.all(tasks)
      } catch {
        if (!cancelled) {
          if (forumsEnabled) setForumCategories([])
          if (chatEnabled) {
            setChannelCategories([])
            setChannels([])
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug, forumsEnabled, chatEnabled])

  const stats = useMemo(
    () => computeCommsStats(forumCategories, channelCategories, channels),
    [forumCategories, channelCategories, channels],
  )

  const needsForumSetup = forumsEnabled && forumCategories !== null && forumCategories.length === 0
  const needsChatSetup = chatEnabled && channels !== null && channels.length === 0
  const isBrandNew = needsForumSetup || needsChatSetup

  const statusCards = [
    {
      label: 'Forums',
      value: forumsEnabled ? 'Enabled' : 'Disabled',
      sub: forumsEnabled ? 'Member discussions on hub' : 'Turn on in settings',
      enabled: forumsEnabled,
      href: !forumsEnabled && showSettings ? settingsFeaturesHref : `${orgBase}?tab=communications#${forumSectionId}`,
      linkLabel: forumsEnabled ? 'Manage categories →' : showSettings ? 'Enable forums →' : undefined,
    },
    {
      label: 'Forum categories',
      value: forumsEnabled ? String(stats.forumCategoryCount) : '-',
      sub: 'Organize threads',
      href: forumsEnabled ? `${orgBase}?tab=communications#${forumSectionId}` : undefined,
      linkLabel: forumsEnabled ? 'Add category →' : undefined,
    },
    {
      label: 'Chat',
      value: chatEnabled ? 'Enabled' : 'Disabled',
      sub: chatEnabled ? 'Real-time coordination' : 'Turn on in settings',
      enabled: chatEnabled,
      href: !chatEnabled && showSettings ? settingsFeaturesHref : `${orgBase}?tab=communications#chat-channels`,
      linkLabel: chatEnabled ? 'Manage channels →' : showSettings ? 'Enable chat →' : undefined,
    },
    {
      label: 'Chat channels',
      value: chatEnabled ? String(stats.channelCount) : '-',
      sub: stats.channelCategoryCount > 0 ? `${stats.channelCategoryCount} categories` : 'Create your first channel',
      href: chatEnabled ? `${orgBase}?tab=communications#chat-channels` : undefined,
      linkLabel: chatEnabled ? 'New channel →' : undefined,
    },
    ...(canModerate ?
      [
        {
          label: 'Moderation',
          value: 'Available',
          sub: 'Review queues and reports',
          href: moderationHref,
          linkLabel: 'Open moderation →',
        },
      ]
    : []),
  ]

  return (
    <div className="space-y-5">
      <CommsPageHeader
        forumsEnabled={forumsEnabled}
        chatEnabled={chatEnabled}
        forumsHref={forumsHref}
        chatHref={chatHref}
        publicHubHref={publicHubHref}
        showSettings={showSettings}
        settingsFeaturesHref={settingsFeaturesHref}
      />

      <CommsStatusRow cards={statusCards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <MemberFacingSpacesCard
            forumsEnabled={forumsEnabled}
            chatEnabled={chatEnabled}
            forumsHref={forumsHref}
            chatHref={chatHref}
            publicHubHref={publicHubHref}
            forumCategoryCount={stats.forumCategoryCount}
            channelCount={stats.channelCount}
          />
          <SuggestedSetupCard />
          {canModerate ?
            <ModerationReminderCard moderationHref={moderationHref} />
          : null}
        </aside>

        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          {isBrandNew ?
            <div className="rounded-2xl border border-dc-accent/25 bg-dc-accent/5 px-5 py-4 text-sm leading-relaxed text-dc-text">
              <p className="font-medium">Set up your communication spaces</p>
              <p className="mt-2 text-dc-text-muted">
                {needsForumSetup && needsChatSetup ?
                  'Forums and chat are enabled. Add at least one forum category and one chat channel so members know where to post and coordinate.'
                : needsForumSetup ?
                  'Forums are enabled but no categories exist yet. Members cannot start threads until you add one.'
                : 'Chat is enabled but no channels exist yet. Members cannot send messages until you create a channel.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canManage ?
                  <>
                    {needsForumSetup ?
                      <a
                        href={`#${forumSectionId}`}
                        className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                      >
                        Create forum category
                      </a>
                    : null}
                    {needsChatSetup ?
                      <a
                        href="#chat-channels"
                        className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
                      >
                        Create chat channel
                      </a>
                    : null}
                  </>
                : null}
                <a
                  href={publicHubHref}
                  className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
                >
                  Open member hub
                </a>
              </div>
            </div>
          : null}

          {forumsEnabled ?
            <ForumCategoriesManager
              orgSlug={orgSlug}
              categories={forumCategories}
              canManage={canManage}
              publicForumsHref={forumsHref}
              onReload={reloadForums}
              sectionId={forumSectionId}
            />
          : (
            <DisabledFeatureBlock
              feature="Forums"
              showSettings={showSettings}
              settingsHref={settingsFeaturesHref}
            />
          )}

          {chatEnabled ?
            <ChatChannelsManager
              orgSlug={orgSlug}
              channelCategories={channelCategories}
              channels={channels}
              canManage={canManage}
              publicChatHref={chatHref}
              onReload={reloadChat}
            />
          : (
            <DisabledFeatureBlock feature="Chat" showSettings={showSettings} settingsHref={settingsFeaturesHref} />
          )}

          <CommsBottomCta publicHubHref={publicHubHref} />
        </div>
      </div>
    </div>
  )
}

function DisabledFeatureBlock({
  feature,
  showSettings,
  settingsHref,
}: {
  feature: string
  showSettings: boolean
  settingsHref: string
}) {
  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 text-sm text-dc-text-muted">
      <p>
        {feature} is disabled for members.
        {showSettings ?
          <>
            {' '}
            <a href={settingsHref} className="font-medium text-dc-accent hover:underline">
              Enable in Settings → Features
            </a>
          </>
        : (
          ' Ask an organization admin to enable it.'
        )}
      </p>
    </div>
  )
}
