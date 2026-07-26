'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { supportCopy } from '@/lib/dancecard/supportCopy'

type FeedbackConfig = {
  enabled?: boolean
  windowHoursAfterEnd?: number
  showAggregatesToOrganizers?: boolean
}

export function SessionFeedbackConfigPanel({
  eventSlug,
  readOnly,
}: {
  eventSlug: string
  readOnly: boolean
}) {
  const [config, setConfig] = useState<FeedbackConfig>({ enabled: false })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    setNeedsMigration(false)
    try {
      const res = await organizerDancecardFetch<{
        feedbackConfig: FeedbackConfig
        needsMigration?: string
      }>(eventSlug, '/session-feedback')
      setConfig(res.feedbackConfig ?? { enabled: false })
      if (res.needsMigration) setNeedsMigration(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load feedback settings'
      if (msg.includes('050') || msg.includes('migration')) {
        setNeedsMigration(true)
      }
      setErr(msg)
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function save(next: FeedbackConfig) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/session-feedback', {
        method: 'PATCH',
        body: JSON.stringify({ feedbackConfig: next }),
      })
      setConfig(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <h3 className="font-serif text-lg text-dc-text">Session feedback</h3>
      <p className="mt-1 text-xs text-dc-muted">
        Attendees can rate sessions after they end. Enable the module under Event modules, then turn on collection here.
      </p>
      {needsMigration ? (
        <p className="mt-3 text-sm text-dc-warning">{supportCopy.sessionFeedbackNotReady}</p>
      ) : null}
      {err ? <p className="mt-3 text-sm text-dc-danger">{err}</p> : null}
      <label className="mt-4 flex items-center gap-2 text-sm text-dc-text">
        <input
          type="checkbox"
          disabled={readOnly || busy}
          checked={Boolean(config.enabled)}
          onChange={(e) => void save({ ...config, enabled: e.target.checked })}
        />
        Collect session feedback from attendees
      </label>
      <label className="mt-3 block text-xs text-dc-muted">
        Window (hours after session ends)
        <input
          type="number"
          min={1}
          max={168}
          disabled={readOnly || busy}
          className="mt-1 block w-24 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
          value={config.windowHoursAfterEnd ?? 24}
          onChange={(e) =>
            setConfig((c) => ({ ...c, windowHoursAfterEnd: Number(e.target.value) || 24 }))
          }
          onBlur={() => void save(config)}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-dc-text">
        <input
          type="checkbox"
          disabled={readOnly || busy}
          checked={config.showAggregatesToOrganizers !== false}
          onChange={(e) => void save({ ...config, showAggregatesToOrganizers: e.target.checked })}
        />
        Show aggregate ratings in organizer program tools
      </label>
    </Panel>
  )
}
