import { useMemo, useState } from 'react'
import {
  CATALOG_CATEGORIES,
  catalogItemsForCategory,
  emptyPickupPlayAnswers,
  normalizePickupPlayAnswers,
  PICKUP_PLAY_CATALOG,
  PICKUP_PLAY_PAGES,
  PICKUP_PLAY_STI_RISK,
  quizPageComplete,
  type CatalogCategoryId,
  type PickupPlayAnswers,
} from '@c2k/shared'

const LIKERT_COLORS = [
  '#7f1d1d',
  '#9a3412',
  '#a16207',
  '#854d0e',
  '#3f6212',
  '#166534',
  '#14532d',
]

type Bucket = 'seeking' | 'offering' | 'maybe' | 'hardNos'

const BUCKET_META: { id: Bucket; label: string; hint: string }[] = [
  { id: 'seeking', label: 'Seeking', hint: 'Receive / bottom — I want this done to / with me' },
  { id: 'offering', label: 'Offering', hint: 'Give / top — I’m happy to do this for a partner' },
  { id: 'maybe', label: 'Maybe', hint: 'Curious with the right partner / conditions' },
  { id: 'hardNos', label: 'Hard no', hint: 'Off the table — including taboo you refuse' },
]

type Props = {
  initial?: PickupPlayAnswers | null
  onComplete: (answers: PickupPlayAnswers) => void | Promise<void>
  busy?: boolean
}

export default function PickupPlayQuiz({ initial, onComplete, busy }: Props) {
  const [pageIx, setPageIx] = useState(0)
  const [answers, setAnswers] = useState<PickupPlayAnswers>(
    () => normalizePickupPlayAnswers(initial) ?? emptyPickupPlayAnswers(),
  )
  const [bucket, setBucket] = useState<Bucket>('seeking')
  const [category, setCategory] = useState<CatalogCategoryId>('bondage')
  const [query, setQuery] = useState('')

  const page = PICKUP_PLAY_PAGES[pageIx]!
  const progress = Math.round((pageIx / PICKUP_PLAY_PAGES.length) * 100)
  const canNext = quizPageComplete(page, answers)
  const isLast = pageIx >= PICKUP_PLAY_PAGES.length - 1

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? PICKUP_PLAY_CATALOG.filter(
          (i) => i.label.toLowerCase().includes(q) || i.id.includes(q.replace(/\s+/g, '_')),
        )
      : catalogItemsForCategory(category)
    return base
  }, [category, query])

  const legend = useMemo(
    () => (
      <div className="flex justify-between text-[11px] font-medium mb-2 px-0.5">
        <span className="text-red-400">strongly disagree</span>
        <span className="text-amber-300/90">neutral</span>
        <span className="text-emerald-400">strongly agree</span>
      </div>
    ),
    [],
  )

  function toggleCatalogItem(id: string) {
    setAnswers((prev) => {
      const next = { ...prev }
      const buckets: Bucket[] = ['seeking', 'offering', 'maybe', 'hardNos']
      // Remove from all buckets first (exclusive membership)
      for (const b of buckets) {
        next[b] = next[b].filter((x) => x !== id)
      }
      // If it wasn't in the active bucket, add it
      const wasInActive = prev[bucket].includes(id)
      if (!wasInActive) {
        next[bucket] = [...next[bucket], id]
      }
      return next
    })
  }

  function itemBucket(id: string): Bucket | null {
    for (const b of BUCKET_META) {
      if (answers[b.id].includes(id)) return b.id
    }
    return null
  }

  const goNext = async () => {
    if (!canNext) return
    if (isLast) {
      await onComplete(answers)
      return
    }
    setPageIx((i) => i + 1)
  }

  const counts = {
    seeking: answers.seeking.length,
    offering: answers.offering.length,
    maybe: answers.maybe.length,
    hardNos: answers.hardNos.length,
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold text-dc-text">Pickup play negotiation</p>
        <div className="mt-2 h-7 overflow-hidden rounded-md bg-zinc-900 border border-dc-border">
          <div
            className="flex h-full items-center px-2 text-[11px] font-semibold text-white transition-all"
            style={{
              width: `${Math.max(progress, 6)}%`,
              background: 'linear-gradient(90deg, var(--dc-accent-muted), var(--dc-accent))',
            }}
          >
            Quiz progress: {progress}%
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-dc-accent">{page.title}</h3>
        {page.subtitle ?
          <p className="mt-1 text-xs text-dc-muted leading-relaxed">{page.subtitle}</p>
        : null}
      </div>

      {page.kind === 'chips' ?
        <div className="flex flex-wrap gap-2 max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain pr-0.5">
          {page.options.map((opt) => {
            const selected = answers[page.field].includes(opt.id)
            const hint =
              page.field === 'stiRisk' ?
                PICKUP_PLAY_STI_RISK.find((s) => s.id === opt.id)?.hint
              : undefined
            return (
              <button
                key={opt.id}
                type="button"
                title={hint}
                onClick={() => {
                  setAnswers((prev) => {
                    const cur = new Set(prev[page.field])
                    if (cur.has(opt.id)) cur.delete(opt.id)
                    else {
                      if (page.max && cur.size >= page.max) return prev
                      cur.add(opt.id)
                    }
                    return { ...prev, [page.field]: [...cur] }
                  })
                }}
                className={`min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? 'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                    : 'border-dc-border bg-dc-elevated text-dc-text hover:border-dc-accent/50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      : null}

      {page.kind === 'choice' ?
        <div className="space-y-2">
          {page.options.map((opt) => {
            const selected = answers[page.field] === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [page.field]: opt.id as never }))}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-dc-accent bg-dc-accent/20'
                    : 'border-dc-border bg-dc-surface-muted hover:border-dc-accent/40'
                }`}
              >
                <p className="text-sm font-medium text-dc-text">{opt.label}</p>
                {opt.hint ? <p className="mt-0.5 text-xs text-dc-muted">{opt.hint}</p> : null}
              </button>
            )
          })}
        </div>
      : null}

      {page.kind === 'catalog' ?
        <div className="space-y-3">
          <p className="text-[11px] text-dc-muted">
            {counts.seeking} seeking · {counts.offering} offering · {counts.maybe} maybe · {counts.hardNos} hard
            nos · {PICKUP_PLAY_CATALOG.length} activities in the menu
          </p>

          <div className="flex flex-wrap gap-1.5">
            {BUCKET_META.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.hint}
                onClick={() => setBucket(b.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  bucket === b.id
                    ? b.id === 'hardNos'
                      ? 'bg-red-800 text-white'
                      : 'bg-dc-accent text-dc-accent-foreground'
                    : 'border border-dc-border text-dc-text'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-dc-muted">{BUCKET_META.find((b) => b.id === bucket)?.hint}</p>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the whole menu…"
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          />

          {!query ?
            <div className="flex flex-wrap gap-1.5">
              {CATALOG_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.blurb}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                    category === c.id
                      ? 'bg-dc-elevated-solid text-dc-accent border border-dc-accent/40'
                      : 'border border-dc-border text-dc-muted'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          : null}

          {!query ?
            <p className="text-[11px] text-dc-muted">
              {CATALOG_CATEGORIES.find((c) => c.id === category)?.blurb}
            </p>
          : null}

          <div className="flex flex-wrap gap-1.5 max-h-[22rem] overflow-y-auto overscroll-contain rounded-xl border border-dc-border/60 bg-black/20 p-2">
            {filteredItems.map((item) => {
              const inBucket = itemBucket(item.id)
              const active = inBucket === bucket
              const other = inBucket && inBucket !== bucket
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCatalogItem(item.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? bucket === 'hardNos'
                        ? 'border-red-500 bg-red-950 text-red-100'
                        : 'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                    : other
                      ? 'border-dc-border-strong bg-dc-elevated-muted text-dc-text-subtle'
                    : 'border-dc-border bg-dc-elevated text-dc-text hover:border-dc-accent/40'
                  }`}
                >
                  {item.label}
                  {other ?
                    <span className="ml-1 opacity-70">
                      ({BUCKET_META.find((b) => b.id === inBucket)?.label})
                    </span>
                  : null}
                </button>
              )
            })}
            {filteredItems.length === 0 ?
              <p className="text-xs text-dc-muted p-2">No matches — try another search.</p>
            : null}
          </div>
        </div>
      : null}

      {page.kind === 'likert' ?
        <div className="space-y-4">
          {legend}
          {page.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-dc-border bg-zinc-900/80 overflow-hidden">
              <p className="px-3 py-2.5 text-sm text-dc-text leading-snug">{item.statement}</p>
              <div className="grid grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const selected = answers.likert[item.id] === n
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} of 7`}
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          likert: { ...prev.likert, [item.id]: n },
                        }))
                      }
                      className="flex min-h-12 items-center justify-center border-t border-black/20"
                      style={{ backgroundColor: LIKERT_COLORS[n - 1] }}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border-2 ${
                          selected ? 'border-white bg-white' : 'border-white/90 bg-transparent'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      : null}

      {page.kind === 'note' ?
        <textarea
          value={answers.note ?? ''}
          onChange={(e) => setAnswers((prev) => ({ ...prev, note: e.target.value }))}
          rows={4}
          placeholder={page.placeholder}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
        />
      : null}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {pageIx > 0 ?
          <button
            type="button"
            className="min-h-11 rounded-full border border-dc-border px-5 text-sm text-dc-text"
            onClick={() => setPageIx((i) => i - 1)}
          >
            Back
          </button>
        : null}
        <button
          type="button"
          disabled={!canNext || busy}
          onClick={() => void goNext()}
          className="min-h-11 rounded-full bg-dc-accent px-8 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
        >
          {busy ? 'Saving…' : isLast ? 'Save & open deck' : 'Next ▶'}
        </button>
      </div>
      <p className="text-center text-[11px] text-dc-muted leading-relaxed">
        This is a matching shortcut, not a substitute for in-person negotiation. Consent, house rules, and safewords
        still win.
      </p>
    </div>
  )
}
