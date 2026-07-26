export type MyPostsTab = 'published' | 'drafts' | 'articles' | 'events'

export const MY_POSTS_TABS: { id: MyPostsTab; label: string }[] = [
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'articles', label: 'Articles' },
  { id: 'events', label: 'Events' },
]

export type ContentBadge = 'Post' | 'Article' | 'Event'

const BADGE_CLASS: Record<ContentBadge, string> = {
  Post: 'bg-sky-500/15 text-sky-300',
  Article: 'bg-emerald-500/15 text-emerald-300',
  Event: 'bg-violet-500/15 text-violet-300',
}

export function contentBadgeClass(badge: ContentBadge): string {
  return BADGE_CLASS[badge]
}

export function excerptFromBody(body: string, bodyFormat: string, max = 140): string {
  const raw =
    bodyFormat === 'html' ?
      body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : body.replace(/\s+/g, ' ').trim()
  if (raw.length <= max) return raw
  return `${raw.slice(0, max).trim()}…`
}
