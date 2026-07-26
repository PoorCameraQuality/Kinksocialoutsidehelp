import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GroupRoleBadge from '@/components/GroupRoleBadge'
import OrganizerDataTable from '@/components/organizer/ui/OrganizerDataTable'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import type { GroupRole } from '@/data/mock-data'

type GroupMember = {
  id?: string
  userId: string
  username: string
  role: string
  memberListHidden?: boolean
}

type Props = {
  groupId: string
  viewerRole?: string | null
}

/** Roles accepted by PATCH /api/v1/groups/:id/members/:userId */
const ASSIGNABLE_ROLES: GroupRole[] = ['admin', 'moderator', 'event_host', 'member']

const ADMIN_ROLES = new Set(['owner', 'admin'])

const UNCHANGED = ''

function normalizeRole(role: string): GroupRole {
  const lower = role.toLowerCase() as GroupRole
  const known: GroupRole[] = ['owner', 'admin', 'moderator', 'event_host', 'vetted', 'member']
  return known.includes(lower) ? lower : 'member'
}

function roleOptionsForMember(currentRole: GroupRole): { value: string; label: string }[] {
  if (currentRole === 'owner') {
    return [{ value: 'owner', label: 'owner' }]
  }
  if (currentRole === 'vetted') {
    return [
      { value: UNCHANGED, label: 'Choose new role…' },
      ...ASSIGNABLE_ROLES.map((role) => ({ value: role, label: role.replace(/_/g, ' ') })),
    ]
  }
  return ASSIGNABLE_ROLES.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))
}

function isRoleChangePending(member: GroupMember, draft: string | undefined): boolean {
  const current = normalizeRole(member.role)
  if (current === 'owner' || !draft || draft === UNCHANGED) return false
  if (current === 'vetted') return ASSIGNABLE_ROLES.includes(draft as GroupRole)
  return draft !== current
}

export default function GroupMemberRolePanel({ groupId, viewerRole }: Props) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({})
  const [resolvedViewerRole, setResolvedViewerRole] = useState<string | null>(viewerRole ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const effectiveViewerRole = viewerRole ?? resolvedViewerRole
  const canManageRoles = ADMIN_ROLES.has((effectiveViewerRole ?? '').toLowerCase())

  const loadMembers = useCallback(async () => {
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadError('Could not load group members.')
        return
      }
      const j = (await r.json()) as {
        members?: GroupMember[]
        viewerMember?: { role?: string } | null
      }
      const rows = j.members ?? []
      setMembers(
        rows.map((m) => ({
          ...m,
          memberListHidden: (m as GroupMember).memberListHidden,
        })),
      )
      setResolvedViewerRole((prev) => viewerRole ?? j.viewerMember?.role ?? prev)
      setRoleDrafts(
        Object.fromEntries(
          rows.map((m) => {
            const current = normalizeRole(m.role)
            if (current === 'vetted') return [m.userId, UNCHANGED]
            return [m.userId, current]
          }),
        ),
      )
    } catch {
      setLoadError('Network error loading group members.')
    } finally {
      setLoadAttempted(true)
    }
  }, [groupId, viewerRole])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    if (viewerRole !== undefined) setResolvedViewerRole(viewerRole)
  }, [viewerRole])

  const pendingChanges = useMemo(() => {
    return members.filter((m) => isRoleChangePending(m, roleDrafts[m.userId]))
  }, [members, roleDrafts])

  async function saveRoles() {
    if (pendingChanges.length === 0) {
      setMsg('No role changes to save.')
      return
    }

    const staffPromotions = pendingChanges.filter((m) => {
      const role = roleDrafts[m.userId]
      return (role === 'admin' || role === 'moderator') && m.memberListHidden
    })
    if (
      staffPromotions.length > 0 &&
      !window.confirm(
        'Staff roles are visible for accountability. Accepting this role will show the member in the group member list. Continue?',
      )
    ) {
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const results = await Promise.all(
        pendingChanges.map(async (m) => {
          const role = roleDrafts[m.userId]
          const r = await fetch(
            `/api/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(m.userId)}`,
            {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role }),
            },
          )
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          return { userId: m.userId, ok: r.ok, status: r.status, error: j.error }
        }),
      )

      const unavailable = results.some((res) => res.status === 404 || res.status === 405)
      if (unavailable) {
        setMsg('Role updates are not available in this environment.')
        return
      }

      const failed = results.filter((res) => !res.ok)
      if (failed.length > 0) {
        const detail = failed.find((res) => res.error)?.error
        setMsg(detail ?? 'Some role updates failed.')
        return
      }

      setMsg('Member roles updated.')
      await loadMembers()
    } catch {
      setMsg('Network error saving roles.')
    } finally {
      setSaving(false)
    }
  }

  const msgIsError = Boolean(msg && /fail|error|could not|network|not available|no role changes/i.test(msg))

  return (
    <div className="space-y-4 max-w-4xl">
      <OrganizerPanel
        title="Member roles"
        description="Assign steward, moderator, and member roles. Owners and admins can promote others."
      >
        {loadError ?
          <div
            className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadMembers()}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Retry
              </button>
            </div>
          </div>
        : null}

        {msg ?
          <div
            className={`text-sm rounded-xl border px-3 py-2 ${
              msgIsError ?
                'border-amber-500/30 bg-amber-950/25 text-amber-100'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
            }`}
            role={msgIsError ? 'alert' : 'status'}
          >
            {msg}
          </div>
        : null}

        {!canManageRoles ?
          <p className="text-sm text-dc-muted">
            Only group owners and admins can change member roles. Your role: {effectiveViewerRole ?? 'member'}.
          </p>
        : null}

        {!loadAttempted ?
          <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
        : null}

        {loadAttempted && !loadError ?
          <OrganizerFormSection title="Roster" description="Active members in this group.">
            <OrganizerDataTable
              rows={members}
              rowKey={(m) => m.userId}
              emptyMessage="No members in this group yet."
              columns={[
                {
                  key: 'member',
                  header: 'Member',
                  render: (m) => (
                    <Link to={`/profile/${encodeURIComponent(m.username)}`} className="font-medium text-dc-text hover:underline">
                      @{m.username}
                    </Link>
                  ),
                },
                {
                  key: 'current',
                  header: 'Current',
                  render: (m) => <GroupRoleBadge role={normalizeRole(m.role)} />,
                },
                {
                  key: 'role',
                  header: 'Assign',
                  render: (m) => {
                    const current = normalizeRole(m.role)
                    const isOwner = current === 'owner'
                    const draft = roleDrafts[m.userId] ?? (current === 'vetted' ? UNCHANGED : current)
                    const options = roleOptionsForMember(current)
                    return (
                      <select
                        value={draft}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({ ...prev, [m.userId]: e.target.value }))
                        }
                        disabled={!canManageRoles || saving || isOwner}
                        className="min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-1.5 text-sm text-dc-text disabled:opacity-50"
                        aria-label={`Role for ${m.username}`}
                      >
                        {options.map((opt) => (
                          <option key={opt.value || 'unchanged'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )
                  },
                },
              ]}
            />

            {canManageRoles ?
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void saveRoles()}
                  disabled={saving || pendingChanges.length === 0}
                  className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `Save role changes${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}`}
                </button>
                {pendingChanges.length > 0 ?
                  <span className="text-xs text-dc-muted">{pendingChanges.length} unsaved change(s)</span>
                : null}
              </div>
            : null}
          </OrganizerFormSection>
        : null}
      </OrganizerPanel>
    </div>
  )
}
