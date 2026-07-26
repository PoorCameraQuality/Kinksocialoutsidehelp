import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ReviewRow = {
  id: string
  sentiment: 'POSITIVE' | 'NEGATIVE'
  body: string | null
  cultureRating?: number | null
  newMemberFriendlinessRating?: number | null
  moderationQualityRating?: number | null
  safetyResponsivenessRating?: number | null
  eventUsefulnessRating?: number | null
  communicationClarityRating?: number | null
  createdAt: string
  authorId: string
  username: string
}

type DimensionSummary = {
  key: string
  label: string
  average: number | null
  responseCount: number
}

type ReviewSummary = {
  hasEnoughFeedback: boolean
  dimensions: DimensionSummary[]
}

const DIMENSION_FIELDS = [
  { key: 'cultureRating', label: 'Culture' },
  { key: 'newMemberFriendlinessRating', label: 'New-member friendliness' },
  { key: 'moderationQualityRating', label: 'Moderation quality' },
  { key: 'safetyResponsivenessRating', label: 'Safety responsiveness' },
  { key: 'eventUsefulnessRating', label: 'Event usefulness' },
  { key: 'communicationClarityRating', label: 'Communication clarity' },
] as const

type DimensionKey = (typeof DIMENSION_FIELDS)[number]['key']

const emptyDimensions = (): Record<DimensionKey, number | ''> => ({
  cultureRating: '',
  newMemberFriendlinessRating: '',
  moderationQualityRating: '',
  safetyResponsivenessRating: '',
  eventUsefulnessRating: '',
  communicationClarityRating: '',
})

export default function GroupFeedbackSection({
  groupId,
  isMember,
}: {
  groupId: string
  isMember: boolean
}) {
  const [items, setItems] = useState<ReviewRow[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentiment, setSentiment] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE')
  const [body, setBody] = useState('')
  const [dimensions, setDimensions] = useState(emptyDimensions())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/reviews`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setItems([])
        setSummary(null)
        setLoadError('Could not load group feedback.')
        return
      }
      const data = (await r.json()) as { items: ReviewRow[]; summary?: ReviewSummary }
      setItems(data.items ?? [])
      setSummary(data.summary ?? null)
    } catch {
      setItems([])
      setSummary(null)
      setLoadError('Network error loading feedback.')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!isMember) return
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        sentiment,
        body: body.trim() || undefined,
      }
      for (const field of DIMENSION_FIELDS) {
        const value = dimensions[field.key]
        if (value !== '' && value >= 1 && value <= 5) {
          payload[field.key] = value
        }
      }
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (r.status === 409) {
        setError('You already submitted feedback for this group.')
        return
      }
      if (!r.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save feedback.')
        return
      }
      setBody('')
      setDimensions(emptyDimensions())
      await load()
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Member feedback</h2>
        <p className="text-sm text-dc-muted mt-1 max-w-2xl">
          Only members can leave structured feedback about group culture. This stays within the group and does not
          change public Community Trust.
        </p>
      </div>

      {summary ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 sm:p-6">
          <h3 className="text-sm font-medium text-dc-text mb-3">Dimension summaries</h3>
          {summary.hasEnoughFeedback ?
            <ul className="grid gap-2 sm:grid-cols-2">
              {summary.dimensions.map((dim) => (
                <li key={dim.key} className="text-sm text-dc-text-muted">
                  <span className="text-dc-text">{dim.label}</span>
                  {dim.average != null ?
                    <span className="ml-2 tabular-nums">{dim.average.toFixed(1)} / 5</span>
                  : <span className="ml-2 text-dc-muted">Limited feedback</span>}
                </li>
              ))}
            </ul>
          : <p className="text-sm text-dc-muted">Limited feedback. More member responses are needed before averages appear.</p>}
        </div>
      : null}

      {isMember ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 sm:p-6">
          <h3 className="text-sm font-medium text-dc-text mb-3">Your feedback</h3>
          <div className="flex flex-wrap gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">
              <input
                type="radio"
                name="gf-sentiment"
                checked={sentiment === 'POSITIVE'}
                onChange={() => setSentiment('POSITIVE')}
                className="accent-dc-accent"
              />
              Positive
            </label>
            <label className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">
              <input
                type="radio"
                name="gf-sentiment"
                checked={sentiment === 'NEGATIVE'}
                onChange={() => setSentiment('NEGATIVE')}
                className="accent-dc-accent"
              />
              Negative
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            {DIMENSION_FIELDS.map((field) => (
              <label key={field.key} className="text-xs text-dc-text-muted">
                {field.label}
                <select
                  value={dimensions[field.key]}
                  onChange={(e) => {
                    const raw = e.target.value
                    setDimensions((prev) => ({
                      ...prev,
                      [field.key]: raw === '' ? '' : Number(raw),
                    }))
                  }}
                  className="mt-1 block w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-2 text-sm text-dc-text"
                >
                  <option value="">Optional</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 4000))}
            rows={3}
            placeholder="Optional context (visible to members who browse this list)…"
            className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted mb-3"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="px-4 py-2 min-h-11 rounded-xl bg-dc-accent hover:bg-dc-accent-hover text-dc-accent-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Submit feedback'}
          </button>
          {error ?
            <div
              className="mt-2 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1">{error}</p>
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
        </div>
      :   <p className="text-sm text-dc-muted rounded-xl border border-dc-border bg-dc-elevated-solid/50 px-4 py-3">
          Join this group to leave feedback.
        </p>
      }

      <div>
        <h3 className="text-sm font-medium text-dc-text-muted mb-3">Recent feedback</h3>
        {loading ?
          <p className="text-sm text-dc-muted" aria-busy="true">
            Loading…
          </p>
        : loadError ?
          <div
            className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">{loadError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setLoadError(null)}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        : items.length === 0 ?
          <p className="text-sm text-dc-muted">No feedback yet.</p>
        :   <ul className="space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-dc-border bg-dc-elevated-solid/60 px-4 py-3 flex flex-col gap-1"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/profile/${encodeURIComponent(row.username)}`} className="font-medium text-dc-text hover:underline">
                    {row.username}
                  </Link>
                  <span
                    className={
                      row.sentiment === 'POSITIVE' ? 'text-emerald-400 text-xs uppercase' : 'text-rose-300 text-xs uppercase'
                    }
                  >
                    {row.sentiment === 'POSITIVE' ? 'Positive' : 'Negative'}
                  </span>
                  <span className="text-xs text-dc-muted">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                {row.body ? <p className="text-sm text-dc-text-muted whitespace-pre-wrap">{row.body}</p> : null}
              </li>
            ))}
          </ul>
        }
      </div>
    </div>
  )
}
