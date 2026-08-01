import { useMemo, useState } from 'react'
import {
  CATALOG_CATEGORIES,
  catalogItemsForCategory,
  emptyPickupPlayAnswers,
  isMatchmakerSetupComplete,
  normalizePickupPlayAnswers,
  PICKUP_PLAY_CATALOG,
  PICKUP_PLAY_FEELINGS,
  PICKUP_PLAY_PAGES,
  PICKUP_PLAY_STI_RISK,
  pickupPlayAnswerSummary,
  quizPageComplete,
  type CatalogCategoryId,
  type PickupPlayAnswers,
  type QuizPage,
} from '@c2k/shared'

type Bucket = 'seeking' | 'offering' | 'maybe' | 'hardNos'

const BUCKET_META: { id: Bucket; label: string; hint: string }[] = [
  { id: 'seeking', label: 'Seeking', hint: 'I might like to receive or experience this.' },
  { id: 'offering', label: 'Offering', hint: 'I might like to give, lead, or provide this.' },
  { id: 'maybe', label: 'Maybe', hint: 'Curious or open with the right conversation.' },
  { id: 'hardNos', label: 'Hard no', hint: 'Do not suggest or include this.' },
]

const SECTIONS: { id: string; title: string; pageIds: string[] }[] = [
  { id: 'tonight', title: 'Tonight', pageIds: ['role', 'intent'] },
  { id: 'people', title: 'People', pageIds: ['iAm', 'playWith'] },
  { id: 'feel', title: 'Scene feel', pageIds: ['moods', 'likert_vibe'] },
  { id: 'menu', title: 'Activity menu', pageIds: ['catalog'] },
  { id: 'boundaries', title: 'Boundaries and communication', pageIds: ['marks', 'checkIns', 'escalate', 'signals'] },
  { id: 'care', title: 'Care, experience, and health', pageIds: ['aftercare', 'likert_safety', 'sti', 'experience'] },
  { id: 'review', title: 'Review and opt in', pageIds: ['note'] },
]

const MOOD_STARTERS = [
  'playful',
  'soft_gentle',
  'intense',
  'serious',
  'sensual',
  'nurturing',
  'low_key',
  'teasing',
  'primal',
  'celebratory',
  'focused',
  'collaborative',
].filter((id) => PICKUP_PLAY_FEELINGS.some((f) => f.id === id))

const LIKERT_LABELS = [
  'Strongly disagree',
  'Disagree',
  'Slightly disagree',
  'Neutral',
  'Slightly agree',
  'Agree',
  'Strongly agree',
]

function pageById(id: string): QuizPage | undefined {
  return PICKUP_PLAY_PAGES.find((p) => p.id === id)
}

function rewritePage(page: QuizPage): QuizPage {
  if (page.id === 'role') {
    return {
      ...page,
      title: 'How do you want to show up tonight?',
      subtitle: 'Scene-scoped for this event — you can still renegotiate with chemistry.',
      options:
        page.kind === 'choice'
          ? [
              { id: 'top', label: 'Top or leading', hint: 'More likely to give structure, lead, restrain, or deliver sensation.' },
              { id: 'bottom', label: 'Bottom or receiving', hint: 'More likely to receive, follow, surrender, or be held.' },
              { id: 'switch', label: 'Switch or flexible', hint: 'Open to negotiating either direction.' },
            ]
          : page.options,
    }
  }
  if (page.id === 'intent') {
    return {
      ...page,
      title: 'What kind of play is on the table tonight?',
      subtitle: 'Used as a strong compatibility boundary. You can still negotiate more narrowly with any individual.',
    }
  }
  if (page.id === 'iAm') {
    return {
      ...page,
      title: 'For matching at this event, how should Matchmaker understand you?',
      subtitle: 'Private and only used for compatibility filtering. It does not change your profile.',
    }
  }
  if (page.id === 'playWith') {
    return {
      ...page,
      title: 'Who would you like included in your deck?',
      subtitle: 'Choose all that apply. Selecting Anyone means gender does not filter your suggestions.',
    }
  }
  if (page.id === 'moods') {
    return {
      ...page,
      title: 'How do you want the scene to feel?',
      subtitle: 'Choose the emotional tone or headspace, not activities or equipment.',
    }
  }
  if (page.id === 'catalog') {
    return {
      ...page,
      title: 'What would you like to explore?',
      subtitle: 'Mark activities as Seeking, Offering, Maybe, or Hard no. Choose at least one Seeking or Offering.',
    }
  }
  if (page.id === 'marks') {
    return {
      ...page,
      title: 'What marks are okay tonight?',
      options:
        page.kind === 'choice'
          ? [
              { id: 'none', label: 'No marks', hint: 'Keep it bruise-light / mark-free.' },
              { id: 'today', label: 'Marks that fade today', hint: 'Coverable by tomorrow is ideal.' },
              { id: 'week', label: 'Marks that may last about a week', hint: 'Discuss placement.' },
              { id: 'discuss', label: 'Discuss case by case', hint: 'Depends on chemistry and clothing.' },
            ]
          : page.options,
    }
  }
  if (page.id === 'checkIns') {
    return {
      ...page,
      title: 'How do you prefer check-ins during play?',
      subtitle: '“Minimal” still means safety communication — just fewer verbal pauses.',
    }
  }
  if (page.id === 'escalate') {
    return { ...page, title: 'If the scene is going well, how should escalation work?' }
  }
  if (page.id === 'signals') {
    return { ...page, title: 'What safety signals are you prepared to use?' }
  }
  if (page.id === 'aftercare') {
    return {
      ...page,
      title: 'What aftercare might feel good?',
      subtitle: 'Optional. These are conversation starters, not promises or requirements.',
    }
  }
  if (page.id === 'likert_vibe') {
    return { ...page, title: 'A little more about tonight’s energy' }
  }
  if (page.id === 'likert_safety') {
    return { ...page, title: 'Care, visibility, and effort' }
  }
  if (page.id === 'sti') {
    return {
      ...page,
      title: 'Sexual-health conversation',
      subtitle:
        'These private answers help avoid incompatible expectations. They are not medical advice and are never shown on deck cards.',
    }
  }
  if (page.id === 'experience') {
    return {
      ...page,
      title: 'How familiar are you with pickup play?',
      subtitle: 'This helps with pace and expectation — not a ranking of worth or skill.',
      options:
        page.kind === 'choice'
          ? [
              { id: 'new', label: 'New to pickup play', hint: 'Prefer patient partners who negotiate clearly.' },
              { id: 'some', label: 'Some experience', hint: 'Comfortable with event norms.' },
              { id: 'experienced', label: 'Very experienced', hint: 'Happy to play with a range of experience levels.' },
            ]
          : page.options,
    }
  }
  if (page.id === 'note') {
    return {
      ...page,
      title: 'Anything a potential match should know?',
      subtitle:
        'Optional. This note stays in your private matching profile unless a future match view exposes it with clear consent.',
    }
  }
  return page
}

export default function MatchmakerQuizFlow({
  initial,
  eventTitle,
  onComplete,
  onSaveDraft,
  busy,
  startAtReview,
}: {
  initial?: PickupPlayAnswers | null
  eventTitle?: string
  onComplete: (answers: PickupPlayAnswers) => void | Promise<void>
  onSaveDraft?: (answers: PickupPlayAnswers) => void
  busy?: boolean
  startAtReview?: boolean
}) {
  const flatPages = useMemo(
    () =>
      SECTIONS.flatMap((s, sectionIx) =>
        s.pageIds.map((pid, pageIxInSection) => ({
          sectionIx,
          section: s,
          pageIxInSection,
          page: rewritePage(pageById(pid)!),
        })),
      ),
    [],
  )

  const [stepIx, setStepIx] = useState(() =>
    startAtReview ? Math.max(0, flatPages.findIndex((s) => s.page.id === 'note')) : 0,
  )
  const [answers, setAnswers] = useState<PickupPlayAnswers>(
    () => normalizePickupPlayAnswers(initial) ?? emptyPickupPlayAnswers(),
  )
  const [bucket, setBucket] = useState<Bucket>('seeking')
  const [category, setCategory] = useState<CatalogCategoryId | null>(null)
  const [query, setQuery] = useState('')
  const [moodSheet, setMoodSheet] = useState(false)
  const [optIn, setOptIn] = useState(true)
  const [activitySheet, setActivitySheet] = useState<string | null>(null)

  const step = flatPages[stepIx]!
  const page = step.page
  const canNext = quizPageComplete(page, answers)
  const isReview = page.id === 'note'
  const sectionProgress = ((step.sectionIx + (isReview ? 1 : 0.35)) / SECTIONS.length) * 100

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return PICKUP_PLAY_CATALOG.filter(
        (i) => i.label.toLowerCase().includes(q) || i.id.includes(q.replace(/\s+/g, '_')),
      ).slice(0, 80)
    }
    if (!category) return []
    return catalogItemsForCategory(category)
  }, [category, query])

  function toggleChip(field: 'moods' | 'aftercare' | 'stiRisk' | 'playWith' | 'iAm', id: string, max?: number) {
    setAnswers((prev) => {
      const cur = prev[field]
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, max ?? 40)
      return { ...prev, [field]: next }
    })
  }

  function setChoice(field: string, id: string) {
    setAnswers((prev) => ({ ...prev, [field]: id }) as PickupPlayAnswers)
  }

  function assignActivity(id: string, nextBucket: Bucket | null) {
    setAnswers((prev) => {
      const next = { ...prev }
      for (const b of BUCKET_META) next[b.id] = next[b.id].filter((x) => x !== id)
      if (nextBucket) next[nextBucket] = [...next[nextBucket], id]
      return next
    })
    setActivitySheet(null)
  }

  function itemBucket(id: string): Bucket | null {
    for (const b of BUCKET_META) {
      if (answers[b.id].includes(id)) return b.id
    }
    return null
  }

  const goBack = () => {
    if (page.kind === 'catalog' && (category || query)) {
      setCategory(null)
      setQuery('')
      return
    }
    setStepIx((i) => Math.max(0, i - 1))
  }

  const goNext = async () => {
    if (isReview) {
      if (!optIn || !isMatchmakerSetupComplete(answers)) return
      await onComplete(answers)
      return
    }
    if (!canNext) return
    if (stepIx >= flatPages.length - 1) return
    setStepIx((i) => i + 1)
  }

  return (
    <div className="pb-28">
      <div className="mb-4">
        <p className="text-[12px] font-medium text-dc-muted">
          Section {step.sectionIx + 1} of {SECTIONS.length} · {step.section.title}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-dc-elevated-muted">
          <div
            className="h-full rounded-full bg-dc-accent transition-[width]"
            style={{ width: `${Math.min(100, Math.round(isReview ? 100 : sectionProgress))}%` }}
          />
        </div>
      </div>

      {!isReview ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-[20px] font-semibold text-dc-text">{page.title}</h3>
            {page.subtitle ? <p className="mt-1 text-[14px] text-dc-muted">{page.subtitle}</p> : null}
          </div>

          {page.kind === 'choice' ? (
            <div className="space-y-2">
              {page.options.map((o) => {
                const selected = answers[page.field] === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChoice(page.field, o.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      selected
                        ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))]'
                        : 'border-dc-border bg-dc-elevated'
                    }`}
                  >
                    <p className="text-[15px] font-medium text-dc-text">{selected ? `✓ ${o.label}` : o.label}</p>
                    {o.hint ? <p className="mt-0.5 text-[13px] text-dc-muted">{o.hint}</p> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {page.kind === 'chips' && page.field === 'moods' ? (
            <div className="space-y-3">
              {answers.moods.length ? (
                <div>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-dc-muted">Selected</p>
                  <div className="flex flex-wrap gap-2">
                    {answers.moods.map((id) => {
                      const lab = PICKUP_PLAY_FEELINGS.find((f) => f.id === id)?.label ?? id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleChip('moods', id, page.max)}
                          className="min-h-11 rounded-full border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] px-3 text-sm text-dc-text"
                        >
                          ✓ {lab} ×
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {PICKUP_PLAY_FEELINGS.filter((f) => MOOD_STARTERS.includes(f.id)).map((o) => {
                  const selected = answers.moods.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleChip('moods', o.id, page.max)}
                      className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
                        selected
                          ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                          : 'border-dc-border text-dc-muted'
                      }`}
                    >
                      {selected ? `✓ ${o.label}` : o.label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setMoodSheet(true)}
                className="text-sm font-medium text-dc-accent"
              >
                Browse all scene feelings
              </button>
            </div>
          ) : null}

          {page.kind === 'chips' && page.field !== 'moods' ? (
            <div className="flex flex-wrap gap-2">
              {(page.field === 'stiRisk' ? PICKUP_PLAY_STI_RISK : page.options).map((o) => {
                const selected = answers[page.field].includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleChip(page.field, o.id, page.max)}
                    className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
                      selected
                        ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                        : 'border-dc-border text-dc-muted'
                    }`}
                  >
                    {selected ? `✓ ${o.label}` : o.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          {page.kind === 'likert' ? (
            <div className="space-y-5">
              {page.items.map((it) => (
                <div key={it.id} className="rounded-2xl border border-dc-border bg-dc-elevated px-3 py-3">
                  <p className="text-[14px] font-medium text-dc-text">{it.statement}</p>
                  <div className="mt-3 space-y-1">
                    {LIKERT_LABELS.map((lab, ix) => {
                      const value = ix + 1
                      const selected = answers.likert[it.id] === value
                      return (
                        <button
                          key={lab}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              likert: { ...prev.likert, [it.id]: value },
                            }))
                          }
                          className={`flex min-h-11 w-full items-center rounded-xl border px-3 text-left text-[14px] ${
                            selected
                              ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                              : 'border-transparent text-dc-muted hover:border-dc-border'
                          }`}
                        >
                          {selected ? `✓ ${lab}` : lab}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {page.kind === 'catalog' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3 text-[13px] text-dc-muted">
                <p>
                  Your menu: {answers.seeking.length} seeking · {answers.offering.length} offering ·{' '}
                  {answers.maybe.length} maybe · {answers.hardNos.length} hard nos
                </p>
              </div>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (e.target.value.trim()) setCategory(null)
                }}
                placeholder="Search activities"
                className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
              />

              {!category && !query.trim() ? (
                <ul className="space-y-1">
                  {CATALOG_CATEGORIES.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-dc-border bg-dc-elevated px-4 text-left"
                      >
                        <span>
                          <span className="block text-[15px] font-medium text-dc-text">{c.label}</span>
                          <span className="block text-[12px] text-dc-muted">{c.blurb}</span>
                        </span>
                        <span className="text-dc-muted">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {BUCKET_META.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBucket(b.id)}
                        className={`min-h-11 rounded-full border px-3 text-sm ${
                          bucket === b.id
                            ? 'border-[var(--dc-accent-border)] text-dc-text'
                            : 'border-dc-border text-dc-muted'
                        }`}
                        title={b.hint}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  {category && !query.trim() ? (
                    <button type="button" className="text-sm text-dc-accent" onClick={() => setCategory(null)}>
                      ‹ Categories
                    </button>
                  ) : null}
                  <ul className="space-y-2">
                    {filteredItems.map((item) => {
                      const cur = itemBucket(item.id)
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setActivitySheet(item.id)}
                            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-dc-border bg-dc-elevated px-3 text-left"
                          >
                            <span className="text-[14px] font-medium text-dc-text">{item.label}</span>
                            <span className="text-[12px] text-dc-muted">
                              {cur ? BUCKET_META.find((b) => b.id === cur)?.label : 'Add'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-[20px] font-semibold text-dc-text">Your private Matchmaker setup</h3>
            <p className="mt-1 text-[14px] text-dc-muted">
              Your detailed answers stay private. Suggested people see only safe, high-level reasons you may fit.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
            {pickupPlayAnswerSummary(answers).map((line) => (
              <p key={line} className="text-[13px] text-dc-text-muted">
                {line}
              </p>
            ))}
          </div>
          <div>
            <label className="block text-[13px] font-medium text-dc-text mb-1">{page.title}</label>
            <textarea
              value={answers.note ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, note: e.target.value }))}
              rows={3}
              placeholder={page.kind === 'note' ? page.placeholder : ''}
              className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-[15px] text-dc-text"
            />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[14px] text-dc-text">
              Use these answers for matching at {eventTitle?.trim() || 'this camp'}
            </span>
          </label>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-dc-border bg-dc-elevated/95 px-4 pt-3 safe-area-pb backdrop-blur-sm c2k-fixed-above-bottom-nav lg:z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onSaveDraft?.(answers)
              goBack()
            }}
            className="min-h-11 text-sm font-medium text-dc-muted"
          >
            {stepIx === 0 && !(page.kind === 'catalog' && (category || query)) ? 'Back' : 'Back'}
          </button>
          <div className="flex gap-2">
            {onSaveDraft ? (
              <button
                type="button"
                onClick={() => onSaveDraft(answers)}
                className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                Save for later
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || (isReview ? !optIn || !isMatchmakerSetupComplete(answers) : !canNext)}
              onClick={() => void goNext()}
              className="min-h-11 rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
            >
              {busy ? 'Saving…' : isReview ? 'Save and open my deck' : 'Continue'}
            </button>
          </div>
        </div>
      </div>

      {moodSheet ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-dc-surface" role="dialog" aria-modal="true">
          <header className="flex items-center justify-between border-b border-dc-border px-3 py-2">
            <button type="button" className="min-h-11 px-2 text-sm text-dc-muted" onClick={() => setMoodSheet(false)}>
              Close
            </button>
            <p className="text-sm font-semibold text-dc-text">All scene feelings</p>
            <span className="w-14" />
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {PICKUP_PLAY_FEELINGS.map((o) => {
                const selected = answers.moods.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleChip('moods', o.id, 16)}
                    className={`min-h-11 rounded-full border px-3 text-sm ${
                      selected
                        ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                        : 'border-dc-border text-dc-muted'
                    }`}
                  >
                    {selected ? `✓ ${o.label}` : o.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activitySheet ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setActivitySheet(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-dc-text">
              {PICKUP_PLAY_CATALOG.find((i) => i.id === activitySheet)?.label}
            </p>
            <p className="mt-1 text-[13px] text-dc-muted">How does this fit tonight?</p>
            <div className="mt-3 flex flex-col gap-2">
              {BUCKET_META.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => assignActivity(activitySheet, b.id)}
                  className="min-h-11 rounded-full border border-dc-border text-sm font-medium text-dc-text"
                >
                  {b.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => assignActivity(activitySheet, null)}
                className="min-h-11 text-sm text-dc-muted"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
