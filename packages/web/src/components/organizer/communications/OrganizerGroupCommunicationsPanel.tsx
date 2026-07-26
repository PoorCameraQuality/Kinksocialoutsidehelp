import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ForumCategory } from '@/components/organizer/admin/OrgForumModerationPanel'
import {
  CommsStatusRow,
  GroupCommsAlphaSection,
  GroupCommsBottomCta,
  GroupCommsPageHeader,
  GroupMemberFacingSpacesCard,
  ModerationReminderCard,
  SuggestedSetupCard,
} from '@/components/organizer/communications/comms-ui'
import ForumCategoriesManager from '@/components/organizer/communications/ForumCategoriesManager'
import { canManageGroupCommunications } from '@/lib/organizer/org-comms-utils'

type Props = {
  groupId: string
  viewerRole: string | null
}

const GROUP_MODERATION_ROLES = new Set(['owner', 'admin', 'moderator'])

function canAccessGroupModeration(groupRole: string | null): boolean {
  if (!groupRole) return false
  return GROUP_MODERATION_ROLES.has(groupRole.toLowerCase())
}

export default function OrganizerGroupCommunicationsPanel({ groupId, viewerRole }: Props) {
  const canManage = canManageGroupCommunications(viewerRole)
  const canModerate = canAccessGroupModeration(viewerRole)
  const groupBase = `/organizer/groups/${encodeURIComponent(groupId)}`
  const publicGroupHref = `/groups/${encodeURIComponent(groupId)}`
  const forumsHref = `${publicGroupHref}?tab=Forums`
  const moderationHref = `${groupBase}?tab=moderation`
  const forumSectionId = 'forum-categories'

  const [forumCategories, setForumCategories] = useState<ForumCategory[] | null>(null)

  const reloadForums = useCallback(async () => {
    const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/forum/categories`, {
      credentials: 'include',
    })
    if (r.ok) {
      const d = (await r.json()) as { items: ForumCategory[] }
      setForumCategories(d.items ?? [])
    } else {
      setForumCategories([])
    }
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/forum/categories`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (r.ok) {
          const d = (await r.json()) as { items: ForumCategory[] }
          setForumCategories(d.items ?? [])
        } else {
          setForumCategories([])
        }
      } catch {
        if (!cancelled) setForumCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  const forumCategoryCount = forumCategories?.length ?? 0
  const needsForumSetup = forumCategories !== null && forumCategoryCount === 0

  const statusCards = useMemo(
    () => [
      {
        label: 'Forums',
        value: 'Enabled',
        sub: 'Member discussions on group page',
        enabled: true as const,
        href: `${groupBase}?tab=communications#${forumSectionId}`,
        linkLabel: 'Manage categories →',
      },
      {
        label: 'Forum categories',
        value: String(forumCategoryCount),
        sub: forumCategoryCount > 0 ? 'Organize threads' : 'Create your first category',
        href: `${groupBase}?tab=communications#${forumSectionId}`,
        linkLabel: 'Add category →',
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
    ],
    [canModerate, forumCategoryCount, groupBase, moderationHref],
  )

  return (
    <div className="space-y-5">
      <GroupCommsPageHeader forumsHref={forumsHref} publicGroupHref={publicGroupHref} />

      <CommsStatusRow cards={statusCards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <GroupMemberFacingSpacesCard
            forumsHref={forumsHref}
            publicGroupHref={publicGroupHref}
            forumCategoryCount={forumCategoryCount}
          />
          <SuggestedSetupCard />
          {canModerate ?
            <ModerationReminderCard moderationHref={moderationHref} />
          : null}
        </aside>

        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          {needsForumSetup ?
            <div className="rounded-2xl border border-dc-accent/25 bg-dc-accent/5 px-5 py-4 text-sm leading-relaxed text-dc-text">
              <p className="font-medium">Set up your forum</p>
              <p className="mt-2 text-dc-text-muted">
                Forums are live on the group page, but members cannot start threads until you add at least one category.
              </p>
              {canManage ?
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`#${forumSectionId}`}
                    className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                  >
                    Create forum category
                  </a>
                  <a
                    href={publicGroupHref}
                    className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
                  >
                    Open group page
                  </a>
                </div>
              : null}
            </div>
          : null}

          <ForumCategoriesManager
            groupId={groupId}
            categories={forumCategories}
            canManage={canManage}
            publicForumsHref={forumsHref}
            onReload={reloadForums}
            sectionId={forumSectionId}
          />

          <GroupCommsAlphaSection publicGroupHref={publicGroupHref} />

          <GroupCommsBottomCta publicGroupHref={publicGroupHref} />
        </div>
      </div>
    </div>
  )
}
