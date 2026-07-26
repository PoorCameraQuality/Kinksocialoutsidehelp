'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'

type Period = { id: string; label: string; starts_at: string | null }
type Rollup = {
  mealPeriodId: string
  byChoice: { choice: string; count: number }[]
  dietary: { name: string; notes: string | null }[]
}

export function KitchenMealPanel({ eventSlug, readOnly }: { eventSlug: string; readOnly: boolean }) {
  const [periods, setPeriods] = useState<Period[]>([])
  const [rollup, setRollup] = useState<Rollup[]>([])
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        organizerDancecardFetch<{ periods: Period[] }>(eventSlug, '/meal-periods'),
        organizerDancecardFetch<{ rollup: Rollup[] }>(eventSlug, '/meal-signups'),
      ])
      setPeriods(p.periods ?? [])
      setRollup(r.rollup ?? [])
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load kitchen data')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function addPeriod() {
    if (!label.trim() || readOnly) return
    await organizerDancecardFetch(eventSlug, '/meal-periods', {
      method: 'POST',
      body: JSON.stringify({ label: label.trim() }),
    })
    setLabel('')
    await load()
  }

  const periodLabel = (id: string) => periods.find((p) => p.id === id)?.label ?? id.slice(0, 8)

  return (
    <Panel className="space-y-4 p-4">
      <h3 className="font-serif text-lg text-dc-text">Kitchen. Meal signups</h3>
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-dc-border px-3 py-2 text-sm"
            placeholder="New meal period (e.g. Saturday dinner)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            type="button"
            className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
            onClick={() => void addPeriod()}
          >
            Add period
          </button>
        </div>
      ) : null}
      {rollup.length === 0 ? (
        <p className="text-sm text-dc-muted">No signups yet.</p>
      ) : (
        <ul className="space-y-4">
          {rollup.map((r) => (
            <li key={r.mealPeriodId} className="rounded-xl border border-dc-border p-3">
              <p className="font-medium text-dc-text">{periodLabel(r.mealPeriodId)}</p>
              <ul className="mt-2 text-sm text-dc-subtle">
                {r.byChoice.map((c) => (
                  <li key={c.choice}>
                    {c.choice}: {c.count}
                  </li>
                ))}
              </ul>
              {r.dietary.length > 0 ? (
                <div className="mt-2 text-xs text-dc-muted">
                  <p className="font-medium">Dietary notes</p>
                  <ul>
                    {r.dietary.map((d, i) => (
                      <li key={i}>
                        {d.name}: {d.notes}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
