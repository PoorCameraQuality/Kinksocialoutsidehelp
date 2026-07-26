export type SavedFilter = 'all' | 'events' | 'articles' | 'media' | 'posts'

export const SAVED_FILTERS: { id: SavedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'events', label: 'Events' },
  { id: 'articles', label: 'Articles' },
  { id: 'media', label: 'Media' },
  { id: 'posts', label: 'Posts' },
]

export const SAVED_FILTER_EMPTY_CTA: Record<Exclude<SavedFilter, 'all'>, { label: string; href: string }> = {
  events: { label: 'Browse events', href: '/events' },
  articles: { label: 'Explore education', href: '/education' },
  media: { label: 'Browse media', href: '/media' },
  posts: { label: 'Go to home feed', href: '/home' },
}
