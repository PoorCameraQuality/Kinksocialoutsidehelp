'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { StaffInviteLinksPanel } from '@/components/dancecard/organizer/settings/StaffInviteLinksPanel'
import type { ConventionCommandPermissions } from '@c2k/shared'

type TeamMember = {
  id: string
  userId: string
  username: string
  displayName: string | null
  canRegistration: boolean
  canStaffOps: boolean
  canScheduler: boolean
  note: string | null
  grantedAt: string | null
}

type PickerUser = {
  userId: string
  username: string
  displayName: string | null
}

type Props = {
  eventSlug: string
  permissions: ConventionCommandPermissions
}

export function CommandTeamPanel({ eventSlug, permissions }: Props) {
  const [items, setItems] = useState<TeamMember[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<PickerUser[]>([])
  const [selectedUser, setSelectedUser] = useState<PickerUser | null>(null)
  const [draftFlags, setDraftFlags] = useState({
    canRegistration: false,
    canStaffOps: false,
    canScheduler: false,
    note: '',
  })

  const canManage = permissions.canManageTeam

  const load = useCallback(async () => {
    if (!canManage) return
    setLoadErr(null)
    try {
      const res = await organizerDancecardFetch<{ items: TeamMember[] }>(eventSlug, '/command-team')
      setItems(res.items ?? [])
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load team')
    }
  }, [canManage, eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!canManage || query.trim().length < 2) {
      setPickerResults([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await organizerDancecardFetch<{ users: PickerUser[] }>(
            eventSlug,
            `/organizer/user-picker?q=${encodeURIComponent(query.trim())}`,
          )
          if (!cancelled) setPickerResults(res.users ?? [])
        } catch {
          if (!cancelled) setPickerResults([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [canManage, eventSlug, query])

  const saveGrant = async (
    userId: string,
    flags: { canRegistration: boolean; canStaffOps: boolean; canScheduler: boolean; note?: string | null },
  ) => {
    setSavingUserId(userId)
    try {
      await organizerDancecardFetch(eventSlug, `/command-team/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(flags),
      })
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not save grant')
    } finally {
      setSavingUserId(null)
    }
  }

  const revoke = async (userId: string) => {
    setSavingUserId(userId)
    try {
      await organizerDancecardFetch(eventSlug, `/command-team/${userId}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not revoke grant')
    } finally {
      setSavingUserId(null)
    }
  }

  if (!canManage) {
    return (
      <p className="text-sm text-dc-muted">
        Only organization owners and admins can manage Event Systems team permissions.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-dc-text">Event team</h2>
        <p className="mt-2 max-w-2xl text-sm text-dc-muted">
          Grant convention-scoped access without changing org membership. A user can be registered as an attendee and
          still receive registration-desk access only.
        </p>
      </div>

      {loadErr ? <p className="text-sm text-dc-danger">{loadErr}</p> : null}

      <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
        <h3 className="text-sm font-semibold text-dc-text">Add or update member</h3>
        <label htmlFor="command-team-user-search" className={`${SETTINGS_LABEL_CLASS} mt-3`}>
          Find Kink Social user
        </label>
        <input
          id="command-team-user-search"
          className={SETTINGS_FIELD_CLASS}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedUser(null)
          }}
          placeholder="Search by username…"
        />
        {pickerResults.length > 0 && !selectedUser ? (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-dc-border">
            {pickerResults.map((u) => (
              <li key={u.userId}>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-dc-elevated-muted/80"
                  onClick={() => {
                    setSelectedUser(u)
                    setQuery(u.displayName ? `${u.displayName} (@${u.username})` : u.username)
                    setPickerResults([])
                  }}
                >
                  {u.displayName ? `${u.displayName} (@${u.username})` : u.username}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draftFlags.canRegistration}
              onChange={(e) => setDraftFlags((f) => ({ ...f, canRegistration: e.target.checked }))}
            />
            Registration
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draftFlags.canStaffOps}
              onChange={(e) => setDraftFlags((f) => ({ ...f, canStaffOps: e.target.checked }))}
            />
            Staff ops
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draftFlags.canScheduler}
              onChange={(e) => setDraftFlags((f) => ({ ...f, canScheduler: e.target.checked }))}
            />
            Scheduler
          </label>
        </div>
        <label htmlFor="command-team-note" className={`${SETTINGS_LABEL_CLASS} mt-3`}>
          Note (optional)
        </label>
        <input
          id="command-team-note"
          className={SETTINGS_FIELD_CLASS}
          value={draftFlags.note}
          onChange={(e) => setDraftFlags((f) => ({ ...f, note: e.target.value }))}
          placeholder="e.g. PAF26 registration desk Sat AM"
        />
        <button
          type="button"
          disabled={!selectedUser || savingUserId !== null}
          className="mt-4 rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-fg disabled:opacity-50"
          onClick={() => {
            if (!selectedUser) return
            void saveGrant(selectedUser.userId, {
              canRegistration: draftFlags.canRegistration,
              canStaffOps: draftFlags.canStaffOps,
              canScheduler: draftFlags.canScheduler,
              note: draftFlags.note.trim() || null,
            }).then(() => {
              setSelectedUser(null)
              setQuery('')
              setDraftFlags({ canRegistration: false, canStaffOps: false, canScheduler: false, note: '' })
            })
          }}
        >
          Save grant
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-dc-border">
        <table className="min-w-full text-sm">
          <thead className="bg-dc-surface-muted text-left text-xs uppercase tracking-wide text-dc-muted">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Registration</th>
              <th className="px-3 py-2">Staff ops</th>
              <th className="px-3 py-2">Scheduler</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-dc-muted">
                  No explicit grants yet. Org owners and admins always have full access.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t border-dc-border">
                  <td className="px-3 py-2">
                    {row.displayName ? `${row.displayName} (@${row.username})` : row.username}
                  </td>
                  <td className="px-3 py-2">{row.canRegistration ? 'Yes' : '-'}</td>
                  <td className="px-3 py-2">{row.canStaffOps ? 'Yes' : '-'}</td>
                  <td className="px-3 py-2">{row.canScheduler ? 'Yes' : '-'}</td>
                  <td className="px-3 py-2 text-dc-muted">{row.note ?? '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-dc-danger hover:underline disabled:opacity-50"
                      disabled={savingUserId === row.userId}
                      onClick={() => void revoke(row.userId)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <StaffInviteLinksPanel conventionKey={eventSlug} />
    </div>
  )
}
