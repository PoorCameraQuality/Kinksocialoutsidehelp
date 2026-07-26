'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { supportCopy } from '@/lib/dancecard/supportCopy'

type GroupRow = {
  id: string
  name: string
  groupType: string
  visibility: string
  status: string
  recruitmentStatus: string
  curatedPin: boolean
  authorSceneName: string
  authorUsername: string
}

type ReportRow = {
  id: string
  group_id: string
  reason: string
  created_at: string
}

export function AttendeeGroupsModerationPanel({
  eventSlug,
  readOnly,
}: {
  eventSlug: string
  readOnly: boolean
}) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    setNeedsMigration(false)
    try {
      const res = await organizerDancecardFetch<{ groups: GroupRow[]; reports: ReportRow[]; needsMigration?: string }>(
        eventSlug,
        '/attendee-groups/moderation',
      )
      setGroups(res.groups ?? [])
      setReports(res.reports ?? [])
      if (res.needsMigration) setNeedsMigration(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load attendee groups'
      if (msg.includes('054') || msg.includes('migration')) {
        setNeedsMigration(true)
      }
      setErr(msg)
      setGroups([])
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function patchGroup(groupId: string, patch: Record<string, unknown>) {
    if (readOnly) return
    setBusyId(groupId)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/attendee-groups/moderation', {
        method: 'PATCH',
        body: JSON.stringify({ groupId, ...patch }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel>
      <ModerationHeader onRefresh={() => void load()} />
      {needsMigration ? (
        <p className="mb-3 text-sm text-amber-800">{supportCopy.groupsModerationNotReady}</p>
      ) : null}
      {err ? <p className="mb-3 text-sm text-red-700">{err}</p> : null}
      {reports.length ? (
        <ReportsBlock reports={reports} groups={groups} />
      ) : null}
      {!groups.length && !err ? <p className="text-sm text-dc-muted">No attendee groups yet.</p> : null}
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="rounded-xl border border-dc-border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-dc-text">{g.name}</p>
                <p className="text-xs text-dc-muted">
                  {g.authorSceneName}
                  {g.authorUsername ? ` (@${g.authorUsername})` : ''} · {g.groupType} · {g.visibility} · {g.status}
                  {g.curatedPin ? ' · pinned' : ''}
                </p>
              </div>
              {!readOnly ? (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busyId === g.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() => void patchGroup(g.id, { curatedPin: !g.curatedPin })}
                  >
                    {g.curatedPin ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === g.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() =>
                      void patchGroup(g.id, {
                        status: g.status === 'removed_by_mod' ? 'active' : 'removed_by_mod',
                      })
                    }
                  >
                    {g.status === 'removed_by_mod' ? 'Restore' : 'Hide'}
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ModerationHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-serif text-lg text-dc-text">Attendee groups moderation</h3>
        <p className="text-xs text-dc-muted">Pin groups on Discover, hide inappropriate groups, review reports.</p>
      </div>
      <button
        type="button"
        className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:bg-dc-surface-muted"
        onClick={onRefresh}
      >
        Refresh
      </button>
    </div>
  )
}

function ReportsBlock({
  reports,
  groups,
}: {
  reports: ReportRow[]
  groups: GroupRow[]
}) {
  const byId = new Map(groups.map((g) => [g.id, g.name]))
  return (
    <div className="mb-4 rounded-xl border border-amber-900/30 bg-amber-950/20 p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-amber-200">Recent reports</p>
      <ul className="space-y-2 text-sm">
        {reports.map((r) => (
          <li key={r.id}>
            <span className="font-medium">{byId.get(r.group_id) ?? 'Group'}</span>
            <span className="text-dc-muted"> · {r.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
