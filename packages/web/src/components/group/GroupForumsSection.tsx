import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import ForumPostList from '@/components/forum/ForumPostList'
import ReportAction from '@/components/moderation/ReportAction'

import { useAuth } from '@/contexts/AuthContext'
import { groupForumPostTarget, groupForumThreadTarget } from '@/lib/moderation/report-targets'

import { groupModeratorUserIds } from '@/lib/forum/forumPostDisplay'

import type { MockGroupMember } from '@/data/types'



type Category = { id: string; name: string; sortOrder: number }

type ThreadRow = {

  id: string

  title: string

  categoryId: string | null

  authorId: string

  createdAt: string

  updatedAt: string

  username: string

}

type PostRow = {

  id: string

  body: string

  username: string

  authorId: string

  createdAt: string

  parentId?: string | null

}



type Props = {
  groupId: string
  members?: MockGroupMember[]
  groupOwnerId?: string | null
  isMember?: boolean
  /** Open this thread when landing from a feed activity deep link. */
  initialThreadId?: string | null
}



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



export default function GroupForumsSection({
  groupId,
  members = [],
  groupOwnerId = null,
  isMember = false,
  initialThreadId = null,
}: Props) {

  const key = encodeURIComponent(groupId)

  const { viewerUserId, isAuthenticated } = useAuth()

  const moderatorUserIds = useMemo(

    () => groupModeratorUserIds(members, groupOwnerId),

    [members, groupOwnerId]

  )

  const [categories, setCategories] = useState<Category[] | null>(null)

  const [threads, setThreads] = useState<ThreadRow[] | null>(null)

  const [threadId, setThreadId] = useState<string | null>(null)

  const [threadDetail, setThreadDetail] = useState<{

    thread: { id: string; title: string; authorId: string; lockedAt?: string | null }

    posts: PostRow[]

  } | null>(null)

  const [err, setErr] = useState<string | null>(null)

  const [threadErr, setThreadErr] = useState<string | null>(null)

  const [threadReloadKey, setThreadReloadKey] = useState(0)

  const [newTitle, setNewTitle] = useState('')

  const [newBody, setNewBody] = useState('')

  const [composerOpen, setComposerOpen] = useState(false)

  const [replyBody, setReplyBody] = useState('')

  const THREAD_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  useEffect(() => {
    const raw = initialThreadId?.trim()
    if (!raw || !THREAD_UUID_RE.test(raw)) return
    setThreadId(raw)
  }, [initialThreadId])

  useEffect(() => {
    if (!threadDetail || !threadId) return
    const el = document.getElementById(`forum-thread-${threadId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [threadDetail, threadId])

  const loadCategories = useCallback(async () => {

    setErr(null)

    try {

      const r = await fetch(`/api/v1/groups/${key}/forum/categories`, { credentials: 'include' })

      if (!r.ok) {

        setErr('Could not load forums')

        return

      }

      const d = (await r.json()) as { items: Category[] }

      setCategories(d.items)

    } catch {

      setErr('Network error')

    }

  }, [key])



  const loadThreads = useCallback(async () => {

    setErr(null)

    try {

      const r = await fetch(`/api/v1/groups/${key}/forum/threads`, { credentials: 'include' })

      if (!r.ok) {

        setErr('Could not load threads')

        return

      }

      const d = (await r.json()) as { items: ThreadRow[] }

      setThreads(d.items)

    } catch {

      setErr('Network error')

    }

  }, [key])



  const reload = useCallback(async () => {

    await Promise.all([loadCategories(), loadThreads()])

  }, [loadCategories, loadThreads])



  useEffect(() => {

    void reload()

  }, [reload])



  useEffect(() => {

    if (!threadId) {

      setThreadDetail(null)

      setThreadErr(null)

      return

    }

    let cancelled = false

    setThreadErr(null)

    ;(async () => {

      try {

        const r = await fetch(`/api/v1/groups/${key}/forum/threads/${encodeURIComponent(threadId)}`, {

          credentials: 'include',

        })

        if (cancelled) return

        if (!r.ok) {

          setThreadDetail(null)

          setThreadErr('This discussion is not available.')

          return

        }

        const d = (await r.json()) as {

          thread: { id: string; title: string; authorId: string; lockedAt?: string | null }

          posts: PostRow[]

        }

        setThreadDetail(d)

      } catch {

        if (!cancelled) {

          setThreadDetail(null)

          setThreadErr('Network error loading thread.')

        }

      }

    })()

    return () => {

      cancelled = true

    }

  }, [key, threadId, threadReloadKey])



  async function createThread() {

    if (!newTitle.trim() || !newBody.trim()) return

    setErr(null)

    try {

      const r = await fetch(`/api/v1/groups/${key}/forum/threads`, {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),

      })

      if (!r.ok) {

        const data = (await r.json().catch(() => ({}))) as { error?: string }

        setErr(typeof data.error === 'string' ? data.error : 'Could not create thread.')

        return

      }

      setNewTitle('')

      setNewBody('')

      setComposerOpen(false)

      void loadThreads()

    } catch {

      setErr('Network error creating thread.')

    }

  }



  async function reply() {

    if (!threadId || !replyBody.trim()) return

    setThreadErr(null)

    try {

      const r = await fetch(`/api/v1/groups/${key}/forum/threads/${encodeURIComponent(threadId)}/posts`, {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ body: replyBody.trim() }),

      })

      if (!r.ok) {

        const data = (await r.json().catch(() => ({}))) as { error?: string }

        setThreadErr(typeof data.error === 'string' ? data.error : 'Could not post reply.')

        return

      }

      setReplyBody('')

      setThreadReloadKey((k) => k + 1)

    } catch {

      setThreadErr('Network error posting reply.')

    }

  }



  return (

    <div className="space-y-6">

      <div>
        <h2 className="text-lg font-semibold text-dc-text">Group discussions</h2>
        <p className="mt-1 text-sm text-dc-text-muted">
          {isMember ?
            'Ask the group, share resources, or start a topic for members.'
          : 'Read what members are discussing. Join to post and reply.'}
        </p>
      </div>

      {err ?

        <div

          className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"

          role="alert"

        >

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">

            <p className="flex-1">{err}</p>

            <button

              type="button"

              onClick={() => void reload()}

              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"

            >

              Retry

            </button>

            <button

              type="button"

              onClick={() => setErr(null)}

              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"

            >

              Dismiss

            </button>

          </div>

        </div>

      : null}

      {isMember ?
        threads === null ? null
        : (threads ?? []).length === 0 && !composerOpen ?
          <div className="c2k-empty-glow c2k-empty-state-compact rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-center">
            <h3 className="text-lg font-semibold text-dc-text">Start the first real discussion.</h3>
            <p className="mt-2 text-sm text-dc-text-muted">
              Ask a question, share a resource, or introduce a topic for members of this group.
            </p>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-4 min-h-11 rounded-xl bg-dc-accent px-5 py-2 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Start a discussion
            </button>
            <Link
              to={`/groups/${key}?tab=Events`}
              className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-dc-accent hover:underline"
            >
              Browse group events
            </Link>
          </div>
        : <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 pb-6 md:pb-4">
            {(threads ?? []).length === 0 ?
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-dc-text">Start a thread</h3>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="min-h-11 rounded-lg px-3 text-sm text-dc-muted hover:text-dc-text"
                >
                  Cancel
                </button>
              </div>
            : <h3 className="text-lg font-semibold text-dc-text mb-3">Start a thread</h3>}

            <input

              className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text mb-2"

              placeholder="Title"

              value={newTitle}

              onChange={(e) => setNewTitle(e.target.value)}

            />

            <textarea

              className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text min-h-[88px]"

              placeholder="First post…"

              value={newBody}

              onChange={(e) => setNewBody(e.target.value)}

            />

            <button

              type="button"

              onClick={() => void createThread()}

              className="mt-2 min-h-11 rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-black"

            >

              Post thread

            </button>

          </div>
      : <p className="text-sm text-dc-muted">Join this group to ask questions and reply in discussions.</p>}



      <div className="grid gap-6 lg:grid-cols-2">

        <div>

          <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Threads</h3>

          <ul className="space-y-2">

            {(threads ?? []).map((t) => (

              <li key={t.id}>

                <button

                  type="button"

                  onClick={() => setThreadId(t.id)}

                  className={`text-left text-sm ${threadId === t.id ? 'text-dc-accent' : 'text-dc-text hover:underline'}`}

                >

                  {t.title}

                </button>

                <span className="text-xs text-dc-muted ml-2">{t.username}</span>

              </li>

            ))}

          </ul>

          {threads && threads.length === 0 && <p className="text-dc-muted text-sm">No threads yet.</p>}

        </div>

        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 min-h-[200px]">

          {threadErr ?

            <div

              className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"

              role="alert"

            >

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                <p className="flex-1">{threadErr}</p>

                <button

                  type="button"

                  onClick={() => setThreadReloadKey((k) => k + 1)}

                  className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"

                >

                  Retry

                </button>

                <button

                  type="button"

                  onClick={() => {

                    setThreadErr(null)

                    setThreadId(null)

                  }}

                  className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"

                >

                  Dismiss

                </button>

              </div>

            </div>

          : threadDetail ?

            <div id={threadId ? `forum-thread-${threadId}` : undefined}>

              <div className="mb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setThreadId(null)}
                  className="text-xs font-medium text-dc-accent hover:underline"
                >
                  ← Thread list
                </button>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-dc-text">{threadDetail.thread.title}</h4>
                {isAuthenticated ?
                  (() => {
                    const target = groupForumThreadTarget(threadDetail.thread.id)
                    return (
                      <ReportAction
                        variant="button"
                        targetType={target.targetType}
                        targetId={target.targetId}
                        targetLabel="thread"
                        surface="group_forum"
                        className="text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"
                      />
                    )
                  })()
                : null}
              </div>

              <ForumPostList

                posts={threadDetail.posts}

                threadAuthorId={threadDetail.thread.authorId}

                moderatorUserIds={moderatorUserIds}

                viewerUserId={viewerUserId}

                formatRelativeTime={formatForumRelativeTime}

                renderFooter={(p) =>
                  isAuthenticated ?
                    (() => {
                      const target = groupForumPostTarget(p.id)
                      return (
                        <ReportAction
                          variant="button"
                          targetType={target.targetType}
                          targetId={target.targetId}
                          targetLabel="forum post"
                          surface="group_forum"
                          className="text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"
                        />
                      )
                    })()
                  : null
                }

              />

              {threadDetail.thread.lockedAt &&
              !moderatorUserIds.has(viewerUserId ?? '') ? (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                  This thread is locked. New replies are disabled.
                </p>
              ) : isMember ? (
                <>
                  <textarea
                    className="mt-3 w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
                    placeholder="Reply…"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void reply()}
                    className="mt-2 rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:bg-dc-elevated-muted"
                  >
                    Reply
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-dc-muted">Join this group to reply.</p>
              )}

            </div>

          :   <p className="text-dc-muted text-sm">Select a thread or create one.</p>}

        </div>

      </div>

      {(categories ?? []).length > 0 ?
        <p className="text-xs text-dc-muted">
          Categories: {(categories ?? []).map((c) => c.name).join(', ')}
        </p>
      : null}

      <Link to="/groups" className="text-sm text-dc-accent hover:underline">

        Back to groups

      </Link>

    </div>

  )

}


