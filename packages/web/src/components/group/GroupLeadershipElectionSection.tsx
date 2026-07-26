import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ElectionState = {
  open: boolean
  ownerId: string
  tallies: { candidateUserId: string; username: string; votes: number }[]
  myVote: { candidateUserId: string; username: string } | null
  members: { userId: string; username: string }[]
}

export default function GroupLeadershipElectionSection({
  groupId,
  isMember,
  onFinalized,
}: {
  groupId: string
  isMember: boolean
  onFinalized?: () => void
}) {
  const [election, setElection] = useState<ElectionState | null>(null)
  const [isMod, setIsMod] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voteBusy, setVoteBusy] = useState(false)
  const [finalizeBusy, setFinalizeBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [winnerPick, setWinnerPick] = useState('')
  const [finalizeNote, setFinalizeNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [er, mr] = await Promise.all([
        fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/leadership-election`, { credentials: 'include' }),
        fetch('/api/v1/moderation/me', { credentials: 'include' }),
      ])
      if (mr.ok) {
        const md = (await mr.json()) as { moderator?: boolean }
        setIsMod(Boolean(md.moderator))
      } else {
        setIsMod(false)
      }
      if (er.status === 401) {
        setElection(null)
        setError('Sign in to view the leadership election.')
        return
      }
      if (er.status === 403) {
        setElection(null)
        setError('Only group members can view or vote in this election.')
        return
      }
      if (!er.ok) {
        setElection(null)
        setError('Could not load election state.')
        return
      }
      const data = (await er.json()) as ElectionState
      setElection(data)
      if (data.myVote) setPick(data.myVote.candidateUserId)
      else if (data.members.length > 0) setPick(data.members[0].userId)
      if (data.members.length > 0) setWinnerPick(data.members[0].userId)
    } catch {
      setError('Network error.')
      setElection(null)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!finalizeNote) return
    const timer = window.setTimeout(() => setFinalizeNote(''), 5000)
    return () => window.clearTimeout(timer)
  }, [finalizeNote])

  const submitVote = async () => {
    if (!pick || !election?.open) return
    setVoteBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/leadership-election/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateUserId: pick }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error ?? 'Vote failed.')
        return
      }
      await load()
    } catch {
      setError('Network error.')
    } finally {
      setVoteBusy(false)
    }
  }

  const finalize = async () => {
    if (!winnerPick) return
    setFinalizeBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/leadership-election/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerUserId: winnerPick }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error ?? 'Finalize failed.')
        return
      }
      setFinalizeNote('New owner saved. The election is closed.')
      onFinalized?.()
      await load()
    } catch {
      setError('Network error.')
    } finally {
      setFinalizeBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
        Loading leadership election…
      </div>
    )
  }

  if (error && !election) {
    return (
      <div
        className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200"
        role="alert"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (election && !election.open) {
    if (finalizeNote) {
      return (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          {finalizeNote}
        </div>
      )
    }
    return null
  }

  if (!election) {
    return null
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-4 sm:px-6">
      <h2 className="text-base font-semibold text-amber-100">Leadership election</h2>
      <p className="text-sm text-amber-100/80 mt-1 max-w-3xl">
        The prior owner has been absent for an extended period. Members vote for a new steward. Platform moderators must
        finalize the winner so ownership transfers and the group can operate normally again.
      </p>

      {!isMember ? (
        <p className="text-sm text-amber-100/70 mt-3">Join this group to participate.</p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-amber-200/80">Current tallies</h3>
            {election.tallies.length === 0 ? (
              <p className="text-sm text-amber-100/70">No votes yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {election.tallies
                  .slice()
                  .sort((a, b) => b.votes - a.votes)
                  .map((t) => (
                    <li key={t.candidateUserId} className="flex justify-between gap-2 text-amber-50">
                      <Link to={`/profile/${encodeURIComponent(t.username)}`} className="hover:underline">
                        {t.username}
                      </Link>
                      <span className="text-amber-200/90">{t.votes} vote{t.votes === 1 ? '' : 's'}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 items-start">
            <label className="text-sm text-amber-100/90 w-full sm:w-auto">
              Your vote
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="mt-1 block w-full sm:w-64 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              >
                {election.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.username}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={voteBusy || !pick}
              onClick={() => void submitVote()}
              className="mt-0 sm:mt-6 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-dc-text text-sm font-medium disabled:opacity-50"
            >
              {voteBusy ? 'Saving…' : election.myVote ? 'Update vote' : 'Cast vote'}
            </button>
          </div>
        </>
      )}

      {isMod ? (
        <div className="mt-6 pt-4 border-t border-amber-500/30">
          <h3 className="text-xs font-semibold uppercase text-amber-200/80">Moderator: finalize</h3>
          <p className="text-xs text-amber-100/70 mt-1 mb-3">
            Confirm the winning member. The previous owner becomes an admin; votes are cleared. This cannot be undone
            from the UI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <select
              value={winnerPick}
              onChange={(e) => setWinnerPick(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            >
              {election.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.username}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={finalizeBusy || !winnerPick}
              onClick={() => void finalize()}
              className="px-4 py-2 rounded-xl bg-rose-900/90 hover:bg-rose-800 text-dc-text text-sm font-medium disabled:opacity-50"
            >
              {finalizeBusy ? 'Applying…' : 'Apply new owner'}
            </button>
          </div>
        </div>
      ) : null}

      {error ?
        <div
          className="mt-3 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}
      {finalizeNote ?
        <p className="mt-3 text-sm rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-emerald-100" role="status">
          {finalizeNote}
        </p>
      : null}
    </div>
  )
}
