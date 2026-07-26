import { useCallback, useEffect, useState } from 'react'

import ForumThreadReplyComposer from '@/components/forum/ForumThreadReplyComposer'

import ReportAction from '@/components/moderation/ReportAction'

import EmptyState from '@/components/ui/EmptyState'

import LoadErrorBanner from '@/components/ui/LoadErrorBanner'

import {

  eventDiscussionPostTarget,

  eventDiscussionThreadTarget,

} from '@/lib/moderation/report-targets'

import { useAuth } from '@/contexts/AuthContext'



type ThreadRow = {

  id: string

  title: string

  username: string

  updatedAt: string

}



type PostRow = {

  id: string

  body: string

  username: string

  createdAt: string

}



export default function EventDiscussionPanel({ eventId }: { eventId: string }) {

  const { isAuthenticated } = useAuth()

  const [threads, setThreads] = useState<ThreadRow[]>([])

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const [posts, setPosts] = useState<PostRow[]>([])

  const [loading, setLoading] = useState(true)

  const [postsLoading, setPostsLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')

  const [newBody, setNewBody] = useState('')

  const [createBusy, setCreateBusy] = useState(false)



  const loadThreads = useCallback(async () => {

    setLoading(true)

    setError(null)

    try {

      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/discussions/threads`, {

        credentials: 'include',

      })

      if (!r.ok) {

        const j = (await r.json().catch(() => ({}))) as { error?: string }

        setError(j.error ?? `HTTP ${r.status}`)

        setThreads([])

        return

      }

      const data = (await r.json()) as { items: ThreadRow[] }

      const items = data.items ?? []

      setThreads(items)

      if (!selectedThreadId && items[0]) setSelectedThreadId(items[0].id)

    } catch {

      setError('Failed to load discussions')

      setThreads([])

    } finally {

      setLoading(false)

    }

  }, [eventId, selectedThreadId])



  const loadPosts = useCallback(async (threadId: string) => {

    setPostsLoading(true)

    try {

      const r = await fetch(

        `/api/v1/events/${encodeURIComponent(eventId)}/discussions/threads/${encodeURIComponent(threadId)}/posts`,

        { credentials: 'include' }

      )

      if (!r.ok) {

        setPosts([])

        return

      }

      const data = (await r.json()) as { items: PostRow[] }

      setPosts(data.items ?? [])

    } catch {

      setPosts([])

    } finally {

      setPostsLoading(false)

    }

  }, [eventId])



  useEffect(() => {

    void loadThreads()

  }, [loadThreads])



  useEffect(() => {

    if (selectedThreadId) void loadPosts(selectedThreadId)

  }, [selectedThreadId, loadPosts])



  const createThread = async () => {

    const title = newTitle.trim()

    const body = newBody.trim()

    if (!title || !body || createBusy) return

    setCreateBusy(true)

    try {

      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/discussions/threads`, {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ title, body }),

      })

      if (r.ok) {

        setNewTitle('')

        setNewBody('')

        await loadThreads()

      }

    } finally {

      setCreateBusy(false)

    }

  }



  if (loading) {

    return <p className="text-sm text-dc-muted">Loading discussion…</p>

  }



  if (error) {

    return (

      <LoadErrorBanner

        message={error === 'Not found' ? 'Discussion is not available for this event (log in or RSVP).' : error}

        onRetry={() => void loadThreads()}

      />

    )

  }



  const threadTarget = selectedThreadId ? eventDiscussionThreadTarget(selectedThreadId) : null



  return (

    <div className="space-y-6">

      {threads.length === 0 ?

        <EmptyState

          inline

          title="Start the event conversation."

          message="Ask a logistics question, coordinate plans, or help others know what to expect."

        />

      : (

        <div className="flex flex-col sm:flex-row gap-4">

          <ul className="sm:w-48 shrink-0 space-y-1">

            {threads.map((t) => (

              <li key={t.id}>

                <button

                  type="button"

                  onClick={() => setSelectedThreadId(t.id)}

                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${

                    selectedThreadId === t.id ? 'bg-dc-accent/15 text-dc-accent' : 'text-dc-text-muted hover:bg-dc-elevated-muted'

                  }`}

                >

                  {t.title}

                </button>

              </li>

            ))}

          </ul>

          <div className="flex-1 min-w-0">

            {selectedThreadId && isAuthenticated && threadTarget ?

              <div className="mb-2 flex justify-end">

                <ReportAction

                  variant="button"

                  targetType={threadTarget.targetType}

                  targetId={threadTarget.targetId}

                  targetLabel="discussion thread"

                  surface="event_discussion"

                  className="text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"

                />

              </div>

            : null}

            {postsLoading ?

              <p className="text-sm text-dc-muted">Loading posts…</p>

            : (

              <ul className="space-y-3">

                {posts.map((p) => {

                  const postTarget = eventDiscussionPostTarget(p.id)

                  return (

                    <li key={p.id} className="rounded-xl border border-dc-border p-4 bg-dc-elevated-solid">

                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">

                        <p className="text-xs text-dc-muted">@{p.username}</p>

                        {isAuthenticated ?

                          <ReportAction

                            variant="button"

                            targetType={postTarget.targetType}

                            targetId={postTarget.targetId}

                            targetLabel="discussion post"

                            surface="event_discussion"

                            className="text-[11px] font-medium text-dc-muted hover:text-dc-accent min-h-0 px-0"

                          />

                        : null}

                      </div>

                      <p className="text-sm text-dc-text-muted whitespace-pre-wrap">{p.body}</p>

                    </li>

                  )

                })}

              </ul>

            )}

            {selectedThreadId ?

              <ForumThreadReplyComposer

                className="!px-0"

                canReply

                postsUrl={`/api/v1/events/${encodeURIComponent(eventId)}/discussions/threads/${encodeURIComponent(selectedThreadId)}/posts`}

                onSuccess={() => void loadPosts(selectedThreadId)}

              />

            : null}

          </div>

        </div>

      )}



      <div className="rounded-xl border border-dc-border p-4 space-y-3">

        <h3 className="text-sm font-semibold text-dc-text">New thread</h3>

        <input

          type="text"

          value={newTitle}

          onChange={(e) => setNewTitle(e.target.value)}

          placeholder="Thread title"

          className="w-full px-3 py-2 rounded-xl border border-dc-border bg-dc-elevated-solid text-sm text-dc-text"

        />

        <textarea

          value={newBody}

          onChange={(e) => setNewBody(e.target.value)}

          placeholder="First post"

          rows={3}

          className="w-full px-3 py-2 rounded-xl border border-dc-border bg-dc-elevated-solid text-sm text-dc-text"

        />

        <button

          type="button"

          disabled={createBusy || !newTitle.trim() || !newBody.trim()}

          onClick={() => void createThread()}

          className="px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground disabled:opacity-50"

        >

          {createBusy ? 'Posting…' : 'Post thread'}

        </button>

      </div>

    </div>

  )

}

