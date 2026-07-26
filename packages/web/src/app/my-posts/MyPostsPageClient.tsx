import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import PersonalUtilityPageShell from '@/components/layout/PersonalUtilityPageShell'
import MyPostListCard from '@/components/my-posts/MyPostListCard'
import MyPostsEmptyPanel from '@/components/my-posts/MyPostsEmptyPanel'
import MyPostsRightRail from '@/components/my-posts/MyPostsRightRail'
import MyPostsTabs from '@/components/my-posts/MyPostsTabs'
import { excerptFromBody, type MyPostsTab } from '@/components/my-posts/my-posts-ui'
import SavedBackLink from '@/components/saved/SavedBackLink'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import { useApiEvents } from '@/hooks/useApiEvents'
import { useApiMyFeedPosts } from '@/hooks/useApiMyFeedPosts'
import { useAuth } from '@/contexts/AuthContext'
import { shortTime } from '@/lib/format-time'

type EducationArticle = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  publicationStatus: string
  publishedAt: string | null
  updatedAt: string
  saveCount?: number
}

function parseTab(raw: string | null): MyPostsTab {
  if (raw === 'drafts' || raw === 'articles' || raw === 'events') return raw
  return 'published'
}

function formatEventWhen(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyPostsPageClient() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (t: MyPostsTab) => {
    setSearchParams(t === 'published' ? {} : { tab: t }, { replace: true })
  }

  const [listSearch, setListSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [articles, setArticles] = useState<EducationArticle[]>([])
  const [articlesStatus, setArticlesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [articlesError, setArticlesError] = useState<string | null>(null)

  const feedPosts = useApiMyFeedPosts(isAuthenticated)
  const hostedEvents = useApiEvents({ hostId: 'me', enabled: isAuthenticated })

  const loadArticles = useCallback(async () => {
    if (!isAuthenticated) {
      setArticles([])
      setArticlesStatus('idle')
      return
    }
    setArticlesStatus('loading')
    setArticlesError(null)
    try {
      const r = await fetch('/api/v1/me/education-articles', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setArticlesError(j.error ?? `HTTP ${r.status}`)
        setArticles([])
        setArticlesStatus('error')
        return
      }
      const data = (await r.json()) as { items?: EducationArticle[] }
      setArticles(data.items ?? [])
      setArticlesStatus('ready')
    } catch {
      setArticlesError('Could not load articles')
      setArticles([])
      setArticlesStatus('error')
    }
  }, [isAuthenticated])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  const publishedArticles = useMemo(
    () => articles.filter((a) => a.publicationStatus === 'PUBLISHED'),
    [articles],
  )
  const draftArticles = useMemo(
    () => articles.filter((a) => a.publicationStatus === 'DRAFT'),
    [articles],
  )
  const events = hostedEvents.status === 'ready' ? hostedEvents.items : []

  const counts = useMemo(
    () => ({
      published: feedPosts.items.length + publishedArticles.length + events.length,
      drafts: draftArticles.length,
      articles: articles.length,
      events: events.length,
    }),
    [feedPosts.items.length, publishedArticles.length, draftArticles.length, articles.length, events.length],
  )

  const loading =
    feedPosts.status === 'loading' ||
    articlesStatus === 'loading' ||
    hostedEvents.status === 'loading'

  const anyError = feedPosts.error ?? articlesError ?? (hostedEvents.status === 'error' ? 'Events unavailable' : null)

  const q = listSearch.trim().toLowerCase()

  const matches = (title: string, excerpt?: string | null) => {
    if (!q) return true
    return title.toLowerCase().includes(q) || (excerpt?.toLowerCase().includes(q) ?? false)
  }

  const postCards = useMemo(() => {
    let list = feedPosts.items
    if (tab === 'drafts') return []
    if (tab === 'articles' || tab === 'events') return []
    list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return list.filter((p) => matches(p.title ?? '', excerptFromBody(p.body, p.bodyFormat)))
  }, [feedPosts.items, tab, q])

  const articleCards = useMemo(() => {
    let list = tab === 'drafts' ? draftArticles : tab === 'published' ? publishedArticles : articles
    if (tab === 'events') return []
    list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return list.filter((a) => matches(a.title, a.excerpt))
  }, [articles, publishedArticles, draftArticles, tab, q])

  const eventCards = useMemo(() => {
    if (tab === 'drafts' || tab === 'articles') return []
    let list = [...events].sort((a, b) => {
      const ta = new Date(a.startsAt ?? 0).getTime()
      const tb = new Date(b.startsAt ?? 0).getTime()
      return tb - ta
    })
    return list.filter((e) => matches(e.title, e.description ?? null))
  }, [events, tab, q])

  const totalVisible = postCards.length + articleCards.length + eventCards.length
  const isEmpty = !loading && counts.published === 0 && counts.drafts === 0

  const reloadAll = () => {
    void feedPosts.reload()
    void loadArticles()
    hostedEvents.reload()
  }

  const listContent = () => {
    if (loading) {
      return (
        <div className="dc-skeleton-stagger space-y-4">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      )
    }
    if (isEmpty && !anyError) return <MyPostsEmptyPanel />
    if (totalVisible === 0) {
      return (
        <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-6 py-10 text-center">
          <p className="text-sm text-dc-text-muted">No items match this filter.</p>
        </div>
      )
    }

    const showGroups = tab === 'published'

    return (
      <div className="space-y-8">
        {showGroups && postCards.length > 0 ?
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dc-muted">Posts</h2>
            <ul className="space-y-4">
              {postCards.map((p) => (
                <MyPostListCard
                  key={p.id}
                  badge="Post"
                  title={p.title?.trim() || excerptFromBody(p.body, p.bodyFormat, 60) || 'Post'}
                  excerpt={excerptFromBody(p.body, p.bodyFormat)}
                  metaLine={`${shortTime(p.createdAt)} · Published`}
                  engagementLine={p.likeCount > 0 ? `${p.likeCount} reactions` : undefined}
                  viewHref={`/share/post/${encodeURIComponent(p.id)}`}
                />
              ))}
            </ul>
          </section>
        : tab !== 'events' && tab !== 'articles' && postCards.length > 0 ?
          <ul className="space-y-4">
            {postCards.map((p) => (
              <MyPostListCard
                key={p.id}
                badge="Post"
                title={p.title?.trim() || excerptFromBody(p.body, p.bodyFormat, 60) || 'Post'}
                excerpt={excerptFromBody(p.body, p.bodyFormat)}
                metaLine={`${shortTime(p.createdAt)} · Published`}
                engagementLine={p.likeCount > 0 ? `${p.likeCount} reactions` : undefined}
                viewHref={`/share/post/${encodeURIComponent(p.id)}`}
              />
            ))}
          </ul>
        : null}

        {showGroups && articleCards.length > 0 ?
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dc-muted">Articles</h2>
            <ul className="space-y-4">
              {articleCards.map((a) => (
                <MyPostListCard
                  key={a.id}
                  badge="Article"
                  title={a.title}
                  excerpt={a.excerpt ?? ''}
                  metaLine={`${shortTime(a.updatedAt)} · ${a.publicationStatus === 'DRAFT' ? 'Draft' : 'Published'}`}
                  engagementLine={a.saveCount != null && a.saveCount > 0 ? `${a.saveCount} saves` : undefined}
                  imageUrl={a.heroImageUrl}
                  statusLabel={a.publicationStatus === 'DRAFT' ? 'Draft' : 'Published'}
                  viewHref={`/education/${encodeURIComponent(a.slug)}`}
                  editHref={`/education/write/${encodeURIComponent(a.id)}`}
                />
              ))}
            </ul>
          </section>
        : tab !== 'events' && articleCards.length > 0 ?
          <ul className="space-y-4">
            {articleCards.map((a) => (
              <MyPostListCard
                key={a.id}
                badge="Article"
                title={a.title}
                excerpt={a.excerpt ?? ''}
                metaLine={`${shortTime(a.updatedAt)} · ${a.publicationStatus === 'DRAFT' ? 'Draft' : 'Published'}`}
                imageUrl={a.heroImageUrl}
                statusLabel={a.publicationStatus === 'DRAFT' ? 'Draft' : 'Published'}
                viewHref={`/education/${encodeURIComponent(a.slug)}`}
                editHref={`/education/write/${encodeURIComponent(a.id)}`}
              />
            ))}
          </ul>
        : null}

        {showGroups && eventCards.length > 0 ?
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dc-muted">Events</h2>
            <ul className="space-y-4">
              {eventCards.map((e) => (
                <MyPostListCard
                  key={e.id}
                  badge="Event"
                  title={e.title}
                  excerpt={e.description?.slice(0, 140) ?? ''}
                  metaLine={[formatEventWhen(e.startsAt), e.location].filter(Boolean).join(' · ')}
                  engagementLine={e.rsvpCount > 0 ? `${e.rsvpCount} going` : undefined}
                  imageUrl={e.imageUrl}
                  statusLabel="Published"
                  viewHref={`/events/${encodeURIComponent(e.id)}`}
                  editHref={`/events/${encodeURIComponent(e.id)}`}
                />
              ))}
            </ul>
          </section>
        : tab !== 'articles' && eventCards.length > 0 ?
          <ul className="space-y-4">
            {eventCards.map((e) => (
              <MyPostListCard
                key={e.id}
                badge="Event"
                title={e.title}
                excerpt={e.description?.slice(0, 140) ?? ''}
                metaLine={[formatEventWhen(e.startsAt), e.location].filter(Boolean).join(' · ')}
                imageUrl={e.imageUrl}
                viewHref={`/events/${encodeURIComponent(e.id)}`}
                editHref={`/events/${encodeURIComponent(e.id)}`}
              />
            ))}
          </ul>
        : null}
      </div>
    )
  }

  return (
    <PersonalUtilityPageShell
      showMobileNavToggle
      mobileNavOpen={mobileNavOpen}
      onMobileNavToggle={() => setMobileNavOpen((o) => !o)}
    >
      <div className="mx-auto w-full max-w-[52rem]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <SavedBackLink />

            <header className="mt-4 mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">My Posts</h1>
              <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
                Posts, articles, polls, and updates you created.
              </p>
            </header>

            <MyPostsTabs active={tab} counts={counts} onChange={setTab} />

            {!loading && !isEmpty ?
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="my-posts-search">
                  Search your posts
                </label>
                <input
                  id="my-posts-search"
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search your posts…"
                  className="min-h-11 flex-1 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"
                />
                <span className="text-xs text-dc-muted sm:shrink-0">Sort: Newest</span>
              </div>
            : null}

            {anyError ?
              <LoadErrorBanner className="mb-4" message={anyError} onRetry={reloadAll} />
            : null}

            <TabContentTransition tabKey={tab}>{listContent()}</TabContentTransition>

            <p className="mt-8 text-xs leading-relaxed text-dc-muted">
              Visibility for posts and profile content is controlled in{' '}
              <Link to="/settings/privacy" className="text-dc-accent hover:underline">
                privacy settings
              </Link>
              .
            </p>

            <div className="mt-8 lg:hidden">
              <MyPostsRightRail />
            </div>
          </div>

          <div className="hidden lg:block">
            <MyPostsRightRail />
          </div>
        </div>
      </div>
    </PersonalUtilityPageShell>
  )
}
