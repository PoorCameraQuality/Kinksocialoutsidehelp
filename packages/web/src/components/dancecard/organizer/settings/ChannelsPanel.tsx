'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganizerWorkspaceBase } from '@/components/dancecard/organizer/organizerWorkspaceContext'

type ChannelRow = {
  id: string
  name: string
  slug: string
  kind: string
  requiresConventionId: string | null
}

type Props = {
  eventSlug: string
  canEdit: boolean
}

function orgSlugFromBase(base: string | null): string | null {
  if (!base) return null
  const m = base.match(/\/organizer\/orgs\/([^/]+)\//)
  return m?.[1] ?? null
}

export function ChannelsPanel({ eventSlug, canEdit }: Props) {
  const workspaceBase = useOrganizerWorkspaceBase()
  const orgSlug = orgSlugFromBase(workspaceBase)
  const [conventionId, setConventionId] = useState<string | null>(null)
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const cr = await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}`, { credentials: 'include' })
    if (!cr.ok) return
    const cd = (await cr.json()) as { convention: { id: string; organizationId: string | null } }
    setConventionId(cd.convention.id)
    const orgKey = orgSlug ?? cd.convention.organizationId
    if (!orgKey) return
    const r = await fetch(
      `/api/v1/organizations/${encodeURIComponent(orgKey)}/channels?forConventionId=${encodeURIComponent(cd.convention.id)}`,
      { credentials: 'include' },
    )
    if (!r.ok) {
      setChannels([])
      return
    }
    const d = (await r.json()) as { items: ChannelRow[] }
    setChannels(d.items ?? [])
  }, [eventSlug, orgSlug])

  useEffect(() => {
    void load()
  }, [load])

  const toggleRestrict = async (ch: ChannelRow) => {
    if (!canEdit || !conventionId || !orgSlug) return
    const next = ch.requiresConventionId === conventionId ? null : conventionId
    setMsg(null)
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/channels/${ch.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requiresConventionId: next }),
    })
    if (!r.ok) {
      setMsg('Could not update channel')
      return
    }
    setMsg('Channel access updated')
    await load()
  }

  return (
    <div className="space-y-4 text-sm text-dc-text">
      <p className="text-dc-muted">
        Restrict org chat channels to registered attendees of this convention. Attendees lose access automatically if
        registration is cancelled.
      </p>
      {msg ? <p className="text-dc-accent">{msg}</p> : null}
      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border px-3 py-2">
            <div>
              <p className="font-medium text-dc-text">
                #{ch.name}{' '}
                <span className="text-xs font-normal text-dc-muted">({ch.kind})</span>
              </p>
              {ch.requiresConventionId === conventionId ?
                <p className="text-xs text-emerald-400">Attendees only (this convention)</p>
              : ch.requiresConventionId ?
                <p className="text-xs text-amber-300">Locked to another convention</p>
              : (
                <p className="text-xs text-dc-muted">Org-wide channel</p>
              )}
            </div>
            {canEdit && conventionId && (!ch.requiresConventionId || ch.requiresConventionId === conventionId) ?
              <button
                type="button"
                className="rounded-full border border-dc-border px-3 py-1 text-xs font-medium hover:border-dc-accent-border"
                onClick={() => void toggleRestrict(ch)}
              >
                {ch.requiresConventionId === conventionId ? 'Remove attendee lock' : 'Restrict to attendees'}
              </button>
            : null}
          </li>
        ))}
      </ul>
      {channels.length === 0 ? <p className="text-dc-muted">No channels found. Enable org chat and create channels first.</p> : null}
    </div>
  )
}
