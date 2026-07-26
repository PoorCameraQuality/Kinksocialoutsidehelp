'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { ParticipationOfferComposer } from '@/components/dancecard/organizer/ParticipationOfferComposer'

type Exhibitor = {
  id: string
  name: string
  booth: string | null
  hours: string | null
  description: string | null
  view_count: number
  is_published: boolean
  application_status?: string | null
}

export function ExhibitorsOrganizerPanel({ eventSlug, readOnly }: { eventSlug: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Exhibitor[]>([])
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'directory' | 'pending'>('pending')
  const [offerForId, setOfferForId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await organizerDancecardFetch<{ exhibitors: Exhibitor[] }>(eventSlug, '/exhibitors')
      setRows(d.exhibitors ?? [])
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load exhibitors')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!name.trim() || readOnly) return
    await organizerDancecardFetch(eventSlug, '/exhibitors', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    })
    setName('')
    await load()
  }

  const pending = rows.filter((r) => r.application_status === 'pending' || r.application_status === 'offered')
  const directory = rows.filter((r) => !r.application_status)

  return (
    <Panel className="space-y-4 p-4">
      <h3 className="font-serif text-lg text-dc-text">Exhibitor directory</h3>
      <div className="flex gap-2">
        <button
          type="button"
          className={tab === 'pending' ? 'rounded-lg bg-dc-accent/20 px-3 py-1 text-xs text-dc-accent' : 'rounded-lg border border-dc-border px-3 py-1 text-xs'}
          onClick={() => setTab('pending')}
        >
          Applications ({pending.length})
        </button>
        <button
          type="button"
          className={tab === 'directory' ? 'rounded-lg bg-dc-accent/20 px-3 py-1 text-xs text-dc-accent' : 'rounded-lg border border-dc-border px-3 py-1 text-xs'}
          onClick={() => setTab('directory')}
        >
          Directory
        </button>
      </div>
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {tab === 'directory' && !readOnly ?
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-dc-border px-3 py-2 text-sm"
            placeholder="Exhibitor name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
            onClick={() => void add()}
          >
            Add
          </button>
        </div>
      : null}
      <ul className="space-y-2 text-sm">
        {(tab === 'pending' ? pending : directory).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dc-border px-3 py-2">
            <span>
              <span className="font-medium text-dc-text">{r.name}</span>
              {r.booth ? <span className="ml-2 text-xs text-dc-muted">Booth {r.booth}</span> : null}
              {r.application_status ?
                <span className="ml-2 text-xs text-dc-warning">{r.application_status}</span>
              : null}
            </span>
            <span className="flex items-center gap-2">
              {!r.application_status ?
                <span className="text-xs text-dc-muted">{r.view_count} views</span>
              : !readOnly && r.application_status === 'pending' ?
                <button
                  type="button"
                  className="rounded-lg bg-dc-accent px-2 py-1 text-xs font-medium text-dc-accent-foreground"
                  onClick={() => setOfferForId(r.id)}
                >
                  Send offer
                </button>
              : null}
            </span>
          </li>
        ))}
      </ul>
      {offerForId ?
        <ParticipationOfferComposer
          conventionKey={eventSlug}
          sourceType="vendor_application"
          sourceId={offerForId}
          showVendorFields
          defaultLetter="Thank you for your vendor application. We are pleased to offer the following booth terms."
          onSent={() => {
            setOfferForId(null)
            void load()
          }}
          onCancel={() => setOfferForId(null)}
        />
      : null}
    </Panel>
  )
}
