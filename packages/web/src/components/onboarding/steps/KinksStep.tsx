import { PROFILE_KINK_MAX } from '@c2k/shared'
import { useEffect, useMemo, useState } from 'react'
import { WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const TagIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M3 11l8.5-8.5a2 2 0 012.8 0L21 9.2a2 2 0 010 2.8L12.5 20.5a2 2 0 01-2.8 0L3 14V11z" />
  </svg>
)

type KinkTag = { id: string; displayName: string; slug: string }

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function KinksStep({ selectedIds, onChange }: Props) {
  const [q, setQ] = useState('')
  const [tags, setTags] = useState<KinkTag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const url = q.trim()
          ? `/api/kink-tags?q=${encodeURIComponent(q.trim())}&limit=60`
          : '/api/kink-tags?limit=80'
        const r = await fetch(url, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const j = (await r.json()) as { items?: Array<{ id: string; displayName: string; slug: string }> }
        if (!cancelled) setTags(Array.isArray(j.items) ? j.items : [])
      } catch {
        if (!cancelled) setTags([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [q])

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else if (next.size < PROFILE_KINK_MAX) next.add(id)
    onChange([...next])
  }

  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Pick a handful', body: `Choose up to ${PROFILE_KINK_MAX}. More later in Profile Studio.` },
        { title: 'Use search', body: 'Type to filter the catalog instead of scrolling everything.' },
      ]}
    >
      <WizardStepHeader
        icon={TagIcon}
        eyebrow="Interests"
        title="What are you into?"
        description="Pick kinks that interest you. You can always change these later."
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search kinks…"
        className="mb-4 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-sm text-dc-text"
      />
      <p className="mb-3 text-xs text-dc-muted">
        {selectedIds.length} / {PROFILE_KINK_MAX} selected
      </p>
      {loading ?
        <p className="text-sm text-dc-muted">Loading kinks…</p>
      : <div className="flex max-h-[22rem] flex-wrap gap-2 overflow-y-auto pr-1">
          {tags.map((tag) => {
            const on = selected.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  on
                    ? 'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                    : 'border-dc-border bg-dc-elevated text-dc-text-muted hover:text-dc-text'
                }`}
              >
                {tag.displayName}
              </button>
            )
          })}
          {tags.length === 0 ? <p className="text-sm text-dc-muted">No matches.</p> : null}
        </div>
      }
    </OnboardingStepLayout>
  )
}
