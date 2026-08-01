import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  normalizePickupPlayAnswers,
  pickupPlayAnswerSummary,
  type PickupPlayAnswers,
} from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import PickupPlayQuiz from '@/components/matchmaker/PickupPlayQuiz'

type DeckItem = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchScore: number
}

export default function EventMatchmakerPanel({ eventId }: { eventId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [phase, setPhase] = useState<'quiz' | 'deck'>('quiz')
  const [savedAnswers, setSavedAnswers] = useState<PickupPlayAnswers | null>(null)
  const [deck, setDeck] = useState<DeckItem[]>([])
  const [deckIx, setDeckIx] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker`, {
        credentials: 'include',
      })
      const d = (await r.json()) as { settings?: { enabled?: boolean } }
      setEnabled(Boolean(d.settings?.enabled))
    } catch {
      setMsg('Could not load matchmaker')
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveAnswers(answers: PickupPlayAnswers) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker/me`, {
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
      setPhase('deck')
      await loadDeck()
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  const loadDeck = useCallback(async () => {
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker/deck`, {
        credentials: 'include',
      })
      const d = (await r.json()) as { items?: DeckItem[]; error?: string }
      if (!r.ok) {
        setMsg(d.error ?? 'Deck unavailable')
        return
      }
      setDeck(d.items ?? [])
      setDeckIx(0)
    } catch {
      setMsg('Network error')
    }
  }, [eventId])

  async function swipe(liked: boolean) {
    const cur = deck[deckIx]
    if (!cur) return
    const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker/swipe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: cur.userId, liked }),
    })
    const j = (await r.json().catch(() => ({}))) as { matched?: boolean; error?: string }
    if (!r.ok) {
      setMsg(j.error ?? 'Swipe failed')
      return
    }
    if (j.matched) setMsg(`It's a match with @${cur.username} — open Messages to say hi.`)
    setDeckIx((i) => i + 1)
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-muted">
        Event matchmaker is not enabled. Hosts can turn on the pickup-play quiz under Event matchmaker settings.
      </div>
    )
  }

  const current = deck[deckIx]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Pickup play matchmaker</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Moods, sexual vs non-sexual intent, flavors, STI prefs, and complementary lead/follow — then swipe a ranked
          deck.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPhase('quiz')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            phase === 'quiz' ? 'bg-dc-accent text-dc-accent-foreground' : 'border border-dc-border text-dc-text'
          }`}
        >
          Quiz
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase('deck')
            void loadDeck()
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            phase === 'deck' ? 'bg-dc-accent text-dc-accent-foreground' : 'border border-dc-border text-dc-text'
          }`}
        >
          Deck
        </button>
      </div>

      {msg ? <p className="text-sm text-dc-muted" role="status">{msg}</p> : null}

      {phase === 'quiz' ?
        <PickupPlayQuiz
          initial={savedAnswers ? normalizePickupPlayAnswers(savedAnswers) : null}
          onComplete={saveAnswers}
          busy={busy}
        />
      : null}

      {phase === 'deck' ?
        <div className="space-y-4">
          {savedAnswers ?
            <div className="rounded-xl border border-dc-border px-3 py-2 text-xs text-dc-muted">
              {pickupPlayAnswerSummary(savedAnswers).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          : null}
          {current ?
            <div className="rounded-2xl border border-dc-border p-6 flex flex-col items-center gap-4">
              {current.avatarUrl ?
                <img
                  src={current.avatarUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover border border-dc-border"
                />
              : <PlaceholderAvatar size="lg" className="!rounded-full" />}
              <div className="text-center">
                <p className="text-dc-text font-medium">{current.displayName || current.username}</p>
                <Link
                  to={`/profile/${encodeURIComponent(current.username)}`}
                  className="text-xs text-dc-accent hover:underline"
                >
                  @{current.username}
                </Link>
                <p className="text-xs text-dc-accent mt-2">
                  Pickup fit: {(current.matchScore * 100).toFixed(0)}%
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => void swipe(false)}
                  className="rounded-full w-14 h-14 border border-dc-border-strong text-xl"
                  aria-label="Pass"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => void swipe(true)}
                  className="rounded-full w-14 h-14 bg-dc-accent text-dc-accent-foreground text-xl"
                  aria-label="Interested"
                >
                  ♥
                </button>
              </div>
            </div>
          : <p className="text-sm text-dc-muted">
              {savedAnswers ? 'No one left in the deck yet.' : 'Finish the quiz, then load the deck.'}
            </p>}
        </div>
      : null}
    </div>
  )
}
