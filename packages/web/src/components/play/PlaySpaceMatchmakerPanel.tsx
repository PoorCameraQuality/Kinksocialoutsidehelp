import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  isMatchmakerSetupComplete,
  matchmakerFitBandLabel,
  normalizePickupPlayAnswers,
  pickupPlayAnswerSummary,
  pickupPlayHumanOverview,
  type MatchmakerFitBand,
  type PickupPlayAnswers,
} from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import MatchmakerQuizFlow from '@/components/play/matchmaker/MatchmakerQuizFlow'
import { startMatchmakerConversation } from '@/lib/matchmaker-conversation'

type DeckItem = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchScore: number
  fitBand?: MatchmakerFitBand
  reasons?: string[]
  sceneFeel?: string[]
}

type UiPhase = 'loading' | 'disabled' | 'intro' | 'setup' | 'ready' | 'deck' | 'matched' | 'exhausted'

export default function PlaySpaceMatchmakerPanel({
  slug,
  isOwner = false,
  eventTitle,
}: {
  slug: string
  isOwner?: boolean
  eventTitle?: string
}) {
  const key = encodeURIComponent(slug)
  const camp = eventTitle?.trim() || 'this camp'
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(true)
  const [phase, setPhase] = useState<UiPhase>('loading')
  const [savedAnswers, setSavedAnswers] = useState<PickupPlayAnswers | null>(null)
  const [deck, setDeck] = useState<DeckItem[]>([])
  const [deckIx, setDeckIx] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [matchUser, setMatchUser] = useState<DeckItem | null>(null)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [reviewAll, setReviewAll] = useState(false)

  const loadSettings = useCallback(async () => {
    const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker`, { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { settings?: { enabled?: boolean } }
    setEnabled(d.settings?.enabled !== false)
  }, [key])

  const loadMe = useCallback(async () => {
    const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker/me`, { credentials: 'include' })
    if (!r.ok) return null
    const d = (await r.json()) as { answers?: unknown }
    return normalizePickupPlayAnswers(d.answers)
  }, [key])

  const loadDeck = useCallback(async () => {
    setMsg(null)
    const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker/deck`, { credentials: 'include' })
    const d = (await r.json().catch(() => ({}))) as {
      items?: DeckItem[]
      exhausted?: boolean
      error?: string
    }
    if (!r.ok) {
      setMsg(d.error ?? 'Deck unavailable')
      return
    }
    setDeck(d.items ?? [])
    setDeckIx(0)
  }, [key])

  useEffect(() => {
    void (async () => {
      await loadSettings()
      const answers = await loadMe()
      if (answers && isMatchmakerSetupComplete(answers)) {
        setSavedAnswers(answers)
        setPhase('ready')
      } else if (answers) {
        setSavedAnswers(answers)
        setPhase('setup')
        setEditMode(true)
      } else {
        setPhase('intro')
      }
    })()
  }, [loadSettings, loadMe])

  useEffect(() => {
    if (!enabled && phase !== 'loading') setPhase('disabled')
  }, [enabled, phase])

  async function saveAnswers(answers: PickupPlayAnswers) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsg(j.error ?? 'Save failed')
        return
      }
      setSavedAnswers(answers)
      setEditMode(false)
      setPhase('ready')
      await loadDeck()
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft(answers: PickupPlayAnswers) {
    setBusy(true)
    try {
      await fetch(`/api/v1/play-spaces/${key}/matchmaker/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      setSavedAnswers(answers)
      setMsg('Saved for later')
    } finally {
      setBusy(false)
    }
  }

  async function swipe(liked: boolean) {
    const cur = deck[deckIx]
    if (!cur || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker/swipe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: cur.userId, liked }),
      })
      const j = (await r.json().catch(() => ({}))) as { matched?: boolean; error?: string }
      if (!r.ok) {
        setMsg(j.error ?? 'Could not save that choice')
        return
      }
      if (j.matched) {
        setMatchUser(cur)
        setPhase('matched')
      }
      const nextIx = deckIx + 1
      setDeckIx(nextIx)
      if (!j.matched && nextIx >= deck.length) setPhase('exhausted')
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled() {
    if (!isOwner) return
    setBusy(true)
    try {
      const r = await fetch(`/api/v1/play-spaces/${key}/matchmaker/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (r.ok) {
        setEnabled(!enabled)
        setPhase(!enabled ? 'intro' : 'disabled')
      }
    } finally {
      setBusy(false)
      setOwnerOpen(false)
    }
  }

  async function messageMatch() {
    if (!matchUser) return
    setBusy(true)
    const result = await startMatchmakerConversation({
      participantUsername: matchUser.username,
      eventTitle: camp,
    })
    setBusy(false)
    if (!result.ok) {
      setMsg(result.error)
      return
    }
    navigate(`/messaging?c=${encodeURIComponent(result.conversationId)}`)
  }

  if (phase === 'loading') {
    return <p className="px-4 text-sm text-dc-muted sm:px-6">Loading Matchmaker…</p>
  }

  if (phase === 'disabled') {
    return (
      <div className="space-y-4 px-4 sm:px-6">
        <Header camp={camp} />
        <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-6 text-center">
          <p className="text-[16px] font-semibold text-dc-text">Matchmaker is not available for this Play Space</p>
          <p className="mt-1 text-[14px] text-dc-muted">
            The host has not enabled private pickup-play matching here.
          </p>
          {isOwner ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleEnabled()}
              className="mt-4 min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
            >
              Enable Matchmaker
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const overview = savedAnswers ? pickupPlayHumanOverview(savedAnswers) : null
  const current = deck[deckIx]

  return (
    <div className="min-w-0 px-4 pb-6 sm:px-6">
      {isOwner ? (
        <div className="mb-4 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">Owner settings</p>
          <p className="mt-1 text-[13px] text-dc-muted">
            Matchmaker is {enabled ? 'enabled' : 'disabled'} for this Play Space.
          </p>
          <button
            type="button"
            onClick={() => setOwnerOpen(true)}
            className="mt-2 text-[13px] font-medium text-dc-accent"
          >
            Manage Matchmaker
          </button>
        </div>
      ) : null}

      {phase === 'intro' ? (
        <div className="space-y-5">
          <Header camp={camp} />
          <p className="text-[15px] leading-relaxed text-dc-text-muted">
            Answer a focused negotiation checklist, then review people whose preferences may fit yours.
          </p>
          <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
            <p className="text-[14px] font-medium text-dc-text">Your answers stay private</p>
            <p className="mt-1 text-[13px] text-dc-muted">
              Other members do not see your full checklist, hard nos, health answers, or private notes.
            </p>
          </div>
          <p className="text-[13px] text-dc-muted">
            A match means mutual interest, not consent or a confirmed scene.
          </p>
          <p className="text-[13px] text-dc-muted">About 5–8 minutes. You can update answers later.</p>
          <button
            type="button"
            onClick={() => {
              setEditMode(true)
              setPhase('setup')
            }}
            className="min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground sm:w-auto sm:px-6"
          >
            Set up Matchmaker
          </button>
        </div>
      ) : null}

      {phase === 'setup' || editMode ? (
        <div className="space-y-3">
          {!editMode || phase === 'setup' ? <Header camp={camp} /> : null}
          {msg ? (
            <p className="text-sm text-dc-muted" role="status">
              {msg}
            </p>
          ) : null}
          <MatchmakerQuizFlow
            initial={savedAnswers}
            eventTitle={camp}
            busy={busy}
            onComplete={(a) => void saveAnswers(a)}
            onSaveDraft={(a) => void saveDraft(a)}
          />
        </div>
      ) : null}

      {phase === 'ready' && !editMode ? (
        <div className="space-y-4">
          <Header camp={camp} />
          <section className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">Matchmaker is on</p>
            <p className="mt-1 text-[14px] text-dc-muted">
              Your answers are being used for suggestions at {camp}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadDeck().then(() => setPhase('deck'))
                }}
                className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
              >
                Open my deck
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(true)
                  setPhase('setup')
                }}
                className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                Edit my answers
              </button>
            </div>
          </section>

          {overview ? (
            <section className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">
                Tonight’s setup
              </p>
              <SummaryRow label="Showing up as" value={overview.showingUp} />
              <SummaryRow label="Looking for" value={overview.lookingFor} />
              <SummaryRow label="Scene feel" value={overview.sceneFeel} />
              <SummaryRow label="Menu" value={overview.menu} />
              <button
                type="button"
                onClick={() => setReviewAll((v) => !v)}
                className="text-[13px] font-medium text-dc-accent"
              >
                {reviewAll ? 'Hide full review' : 'Review all answers'}
              </button>
              {reviewAll && savedAnswers ? (
                <div className="space-y-1 border-t border-dc-border pt-3">
                  {pickupPlayAnswerSummary(savedAnswers).map((line) => (
                    <p key={line} className="text-[13px] text-dc-muted">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <p className="text-[12px] text-dc-muted">
            Changes re-rank your deck. They do not update My ISO.
          </p>
        </div>
      ) : null}

      {phase === 'deck' && !editMode ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[22px] font-semibold text-dc-text">Matchmaker deck</h2>
              <p className="text-[14px] text-dc-muted">Suggested from your private answers</p>
            </div>
            <p className="text-[13px] text-dc-muted">
              {current ? `${deckIx + 1} of ${deck.length} remaining` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditMode(true)
                setPhase('setup')
              }}
              className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
            >
              Edit answers
            </button>
            <button
              type="button"
              onClick={() => setPhase('ready')}
              className="min-h-11 text-sm font-medium text-dc-muted"
            >
              Back to overview
            </button>
          </div>

          {msg ? (
            <p className="text-sm text-red-300" role="alert">
              {msg}
            </p>
          ) : null}

          {current ? (
            <DeckCard item={current} busy={busy} onPass={() => void swipe(false)} onInterested={() => void swipe(true)} />
          ) : (
            <EmptyDeck
              title={
                deck.length === 0
                  ? 'No one else is in the deck yet'
                  : 'You’ve reviewed everyone currently available'
              }
              body={
                deck.length === 0
                  ? `You are ready. Suggestions will appear as other ${camp} members opt in.`
                  : 'New suggestions may appear as members join or update their preferences.'
              }
              onCheck={() => void loadDeck()}
              onEdit={() => {
                setEditMode(true)
                setPhase('setup')
              }}
            />
          )}
        </div>
      ) : null}

      {phase === 'exhausted' && !editMode ? (
        <EmptyDeck
          title="You’ve reviewed everyone currently available"
          body="New suggestions may appear as members join or update their preferences."
          onCheck={() => {
            void loadDeck().then(() => setPhase('deck'))
          }}
          onEdit={() => {
            setEditMode(true)
            setPhase('setup')
          }}
        />
      ) : null}

      {phase === 'matched' && matchUser ? (
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--dc-accent-border)] bg-dc-elevated px-5 py-8 text-center">
          <p className="text-[22px] font-semibold text-dc-text">It’s a match with {matchUser.displayName || matchUser.username}</p>
          <p className="text-[14px] text-dc-muted">
            You both chose Interested. This is an opening to talk, not consent or a confirmed scene.
          </p>
          {msg ? <p className="text-sm text-red-300">{msg}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void messageMatch()}
            className="min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
          >
            {busy ? 'Opening…' : `Message ${matchUser.displayName || matchUser.username}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setMatchUser(null)
              if (deckIx >= deck.length) setPhase('exhausted')
              else setPhase('deck')
            }}
            className="min-h-11 w-full text-sm font-medium text-dc-muted"
          >
            Keep browsing
          </button>
          <Link
            to={`/profile/${encodeURIComponent(matchUser.username)}`}
            className="inline-block text-sm font-medium text-dc-accent"
          >
            View profile ›
          </Link>
        </div>
      ) : null}

      {ownerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOwnerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-dc-text">Matchmaker settings</p>
            <label className="mt-4 flex items-start gap-3 text-[14px] text-dc-text">
              <input type="checkbox" checked={enabled} onChange={() => void toggleEnabled()} />
              <span>Allow Matchmaker in this Play Space</span>
            </label>
            <p className="mt-2 text-[13px] text-dc-muted">
              When enabled, joined members can complete private preferences and browse opted-in members. Turning this
              off hides the deck and prevents new choices. Existing conversations are not removed.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 w-full text-sm font-medium text-dc-muted"
              onClick={() => setOwnerOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Header({ camp }: { camp: string }) {
  return (
    <header className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">{camp}</p>
      <h2 className="text-[22px] font-semibold text-dc-text sm:text-[24px]">Matchmaker</h2>
      <p className="text-[15px] text-dc-text-muted">Private preferences for pickup play at this camp</p>
    </header>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-dc-muted">{label}</p>
      <p className="text-[14px] font-medium text-dc-text">{value}</p>
    </div>
  )
}

function DeckCard({
  item,
  busy,
  onPass,
  onInterested,
}: {
  item: DeckItem
  busy?: boolean
  onPass: () => void
  onInterested: () => void
}) {
  const band = item.fitBand ?? (item.matchScore >= 0.72 ? 'strong' : item.matchScore >= 0.55 ? 'promising' : 'some')
  const pct = Math.round(item.matchScore * 100)
  return (
    <article className="rounded-2xl border border-dc-border bg-dc-elevated px-5 py-6">
      <div className="flex flex-col items-center text-center">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover border border-dc-border" />
        ) : (
          <PlaceholderAvatar size="lg" className="!rounded-full" />
        )}
        <h3 className="mt-3 text-[18px] font-semibold text-dc-text">{item.displayName || item.username}</h3>
        <Link to={`/profile/${encodeURIComponent(item.username)}`} className="text-[13px] text-dc-muted">
          @{item.username}
        </Link>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[14px] font-semibold text-dc-text">{matchmakerFitBandLabel(band)}</p>
        <p className="text-[13px] text-dc-muted">{pct}% compatibility</p>
      </div>

      {item.reasons?.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Why you may fit</p>
          <ul className="mt-1 space-y-1">
            {item.reasons.map((r) => (
              <li key={r} className="text-[14px] text-dc-text">
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-dc-muted">Suggested from your private preferences.</p>
      )}

      {item.sceneFeel?.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Scene feel</p>
          <p className="mt-0.5 text-[14px] text-dc-text-muted">{item.sceneFeel.join(' · ')}</p>
        </div>
      ) : null}

      <p className="mt-4 text-center text-[12px] text-dc-muted">These are suggestions, not consent.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onPass}
          className="min-h-11 rounded-full border border-dc-border text-sm font-semibold text-dc-text disabled:opacity-50"
        >
          Pass
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onInterested}
          className="min-h-11 rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
        >
          Interested
        </button>
      </div>
      <Link
        to={`/profile/${encodeURIComponent(item.username)}`}
        className="mt-3 flex min-h-11 items-center justify-center text-sm font-medium text-dc-accent"
      >
        View profile ›
      </Link>
    </article>
  )
}

function EmptyDeck({
  title,
  body,
  onCheck,
  onEdit,
}: {
  title: string
  body: string
  onCheck: () => void
  onEdit: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-dc-border px-4 py-8 text-center">
      <p className="text-[16px] font-semibold text-dc-text">{title}</p>
      <p className="mt-1 text-[14px] text-dc-muted">{body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCheck}
          className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
        >
          Review my answers
        </button>
      </div>
    </div>
  )
}
