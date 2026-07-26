import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LocalPostCard from '@/components/cards/LocalPostCard'
import FeedPostDiscussion from '@/components/feed/FeedPostDiscussion'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { apiPostToHomeFeedPost, type ApiFeedPost } from '@/lib/feed-mapper'
import type { HomeFeedPost } from '@/lib/feed-types'

export default function SharePostPage() {
  const { id } = useParams()
  const { status, isAuthenticated } = useAuth()
  const [post, setPost] = useState<HomeFeedPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'ready' || !id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/v1/feed/posts/${encodeURIComponent(id)}`, { credentials: 'include' })
        if (cancelled) return
        if (r.status === 503) {
          setError('Feed requires the API in database mode.')
          return
        }
        if (!r.ok) {
          setError('Post not found or unavailable.')
          return
        }
        const data = (await r.json()) as { post?: ApiFeedPost & { quotedPost?: ApiFeedPost } }
        if (data.post) setPost(apiPostToHomeFeedPost(data.post))
      } catch {
        if (!cancelled) setError('Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, id])

  if (status === 'loading' || loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-dc-muted">
        Loading…
      </div>
    )
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-dc-muted">
        <Link to="/home" className="text-dc-accent hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link to="/home?tab=Local" className="text-sm text-dc-accent hover:underline">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-dc-text">Shared post</h1>
      {!isAuthenticated ?
        <p className="mt-2 text-sm text-dc-text-muted">
          Anyone can read this post.{' '}
          <Link to={buildLoginHref(`/share/post/${id}#discuss`)} className="font-medium text-dc-accent hover:underline">
            Sign in
          </Link>{' '}
          to react or comment.
        </p>
      : null}
      {error ?
        <p className="mt-4 text-sm text-amber-200">{error}</p>
      : null}
      {post && !error ?
        <>
          <div className="feed-stream mt-6">
            <LocalPostCard post={post} layout="feed" />
          </div>
          <FeedPostDiscussion postId={post.id} initialCount={post.comments} />
        </>
      : null}
    </div>
  )
}
