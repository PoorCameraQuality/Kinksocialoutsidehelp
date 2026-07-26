import type { ReactNode } from 'react'
import '@/styles/forum-thread.css'
import { cn } from '@/lib/cn'
import {
  computeForumPostDepthMap,
  forumPostBadgeFlags,
  type ForumPostRow,
} from '@/lib/forum/forumPostDisplay'
import ForumPostRoleBadges from '@/components/forum/ForumPostRoleBadges'
import MarkdownContent from '@/components/ui/MarkdownContent'

export type ForumPostListItem = ForumPostRow & {
  body: string
  username: string
  authorId: string
  createdAt: string
  thanksCount?: number
  helpfulCount?: number
  viewerHasThanks?: boolean
  viewerHasHelpful?: boolean
}

type Props = {
  posts: ForumPostListItem[]
  threadAuthorId: string
  moderatorUserIds: ReadonlySet<string>
  viewerUserId: string | null
  formatRelativeTime?: (iso: string) => string
  usernameHue?: (username: string) => number
  renderFooter?: (post: ForumPostListItem, isOp: boolean) => ReactNode
}

function defaultUsernameHue(username: string): number {
  let h = 0
  for (let i = 0; i < username.length; i++) h = (h + username.charCodeAt(i) * (i + 7)) % 360
  return h
}

export default function ForumPostList({
  posts,
  threadAuthorId,
  moderatorUserIds,
  viewerUserId,
  formatRelativeTime,
  usernameHue = defaultUsernameHue,
  renderFooter,
}: Props) {
  const depthMap = computeForumPostDepthMap(posts)

  return (
    <ol className="space-y-0">
      {posts.map((post, idx) => {
        const depth = depthMap.get(post.id) ?? (idx === 0 ? 0 : 1)
        const isOp = depth === 0
        const depthClass =
          depth === 0 ? 'dc-forum-post--op'
          : depth === 1 ? 'dc-forum-post--depth-1'
          : depth === 2 ? 'dc-forum-post--depth-2'
          : 'dc-forum-post--depth-3'
        const { showAuthor, showModerator } = forumPostBadgeFlags({
          threadAuthorId,
          postAuthorId: post.authorId,
          viewerUserId,
          moderatorUserIds,
        })
        const hue = usernameHue(post.username)
        const rel = formatRelativeTime?.(post.createdAt)

        return (
          <li
            key={post.id}
            className={cn('dc-forum-post', depthClass)}
            aria-level={depth + 1}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: `hsl(${hue} 48% 68%)` }}>
                {post.username}
              </span>
              <ForumPostRoleBadges showAuthor={showAuthor} showModerator={showModerator} />
              {rel ?
                <time className="text-[11px] text-dc-muted" dateTime={post.createdAt}>
                  {rel}
                </time>
              : null}
            </div>
            <MarkdownContent
              markdown={post.body}
              className={cn(
                'c2k-rich-html text-[15px] leading-relaxed',
                isOp ? 'text-zinc-100' : 'text-dc-text-muted',
              )}
            />
            {renderFooter ?
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dc-border-subtle pt-2">
                {renderFooter(post, isOp)}
              </div>
            : null}
          </li>
        )
      })}
    </ol>
  )
}
