import { useCallback, useEffect, useState } from 'react'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'

type DeckItem = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchScore: number
}

export default function EventMatchmakerPanel({ eventId }: { eventId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [answersJson, setAnswersJson] = useState('{\n  "interests": ["rope", "impact"],\n  "energy": 3\n}')
  const [deck, setDeck] = useState<DeckItem[]>([])
  const [deckIx, setDeckIx] = useState(0)

  const load = useCallback(async () => {
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker`, { credentials: 'include' })
      const d = (await r.json()) as { settings?: { enabled?: boolean } }
      setEnabled(Boolean(d.settings?.enabled))
    } catch {
      setMsg('Could not load matchmaker')
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

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

  async function saveAnswers() {
    setMsg(null)
    let answers: Record<string, unknown>
    try {
      answers = JSON.parse(answersJson) as Record<string, unknown>
    } catch {
      setMsg('Invalid JSON for answers')
      return
    }
    const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker/me`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setMsg(j.error ?? 'Save failed')
      return
    }
    setMsg('Profile saved. Load deck to browse.')
  }

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
    if (j.matched) setMsg("It's a match. You can message in the app when messaging is ready.")
    setDeckIx((i) => i + 1)
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-muted">
        Event matchmaker is not enabled for this event. If you host or manage this event, open the organizer tools on
        the event page and turn on matchmaker under Event matchmaker settings.
      </div>
    )
  }

  const current = deck[deckIx]

  return (
    <div className="space-y-6">
      <p className="text-xs text-dc-muted">
        Opt-in only. Be respectful. Misuse can be reported. Checkout and off-platform contact are outside the scope of
        this demo.
      </p>
      <div className="rounded-xl border border-dc-border p-4 space-y-2">
        <h3 className="text-sm font-semibold text-dc-muted uppercase">Your ISO profile (JSON)</h3>
        <textarea
          value={answersJson}
          onChange={(e) => setAnswersJson(e.target.value)}
          rows={8}
          className="w-full font-mono text-xs bg-black/30 border border-dc-border rounded-lg p-3 text-dc-text-muted"
        />
        <button
          type="button"
          onClick={() => void saveAnswers()}
          className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-black"
        >
          Save profile
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void loadDeck()}
          className="rounded-lg border border-dc-border px-4 py-2 text-sm text-dc-text"
        >
          Load deck
        </button>
      </div>
      {msg && <p className="text-sm text-dc-muted">{msg}</p>}
      {current && (
        <div className="rounded-2xl border border-dc-border p-6 flex flex-col items-center gap-4">
          <PlaceholderAvatar size="lg" className="!rounded-full" />
          <div className="text-center">
            <p className="text-dc-text font-medium">{current.displayName || current.username}</p>
            <p className="text-xs text-dc-muted">@{current.username}</p>
            <p className="text-xs text-dc-accent mt-2">Match score: {(current.matchScore * 100).toFixed(0)}%</p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => void swipe(false)}
              className="rounded-full w-14 h-14 border border-dc-border-strong text-xl text-dc-text"
              aria-label="Pass"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => void swipe(true)}
              className="rounded-full w-14 h-14 bg-dc-accent text-black text-xl"
              aria-label="Like"
            >
              ♥
            </button>
          </div>
        </div>
      )}
      {!current && deck.length === 0 && <p className="text-sm text-dc-muted">No one in deck yet. Save profile and load deck.</p>}
      {!current && deck.length > 0 && deckIx >= deck.length && (
        <p className="text-sm text-dc-muted">End of deck.</p>
      )}
    </div>
  )
}
