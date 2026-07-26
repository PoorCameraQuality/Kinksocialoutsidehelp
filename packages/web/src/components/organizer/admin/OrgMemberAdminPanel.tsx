import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import OrganizerDataTable from '@/components/organizer/ui/OrganizerDataTable'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

export type OrgMemberRow = {
  userId: string
  role: string
  username: string
  displayName: string | null
  joinedAt: string
  listedInOrgDirectory?: boolean
  volunteerTags?: string[] | null
}

const ASSIGNABLE_ROLES = ['ADMIN', 'MODERATOR', 'STAFF', 'MEMBER'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

const ROLE_HINTS: Record<string, string> = {
  OWNER: 'Full control. Cannot be changed here',
  ADMIN: 'Settings, roles, publish',
  MODERATOR: 'Forums & chat moderation',
  STAFF: 'Volunteer tags, program assignments',
  MEMBER: 'Standard member access',
}

export type OrgMemberAdminPanelProps = {
  orgSlug: string
  /** When true, role picker is enabled (requires ADMIN per API). */
  canManageRoles?: boolean
  /** When provided, skips member fetch. */
  members?: OrgMemberRow[] | null
  onMembersChange?: (members: OrgMemberRow[]) => void
}

export default function OrgMemberAdminPanel({
  orgSlug,
  canManageRoles = true,
  members: controlledMembers,
  onMembersChange,
}: OrgMemberAdminPanelProps) {
  const orgKey = encodeURIComponent(orgSlug)
  const [internalMembers, setInternalMembers] = useState<OrgMemberRow[] | null>(
    controlledMembers === undefined ? null : controlledMembers
  )
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const members = controlledMembers !== undefined ? controlledMembers : internalMembers

  const setMembers = useCallback(
    (next: OrgMemberRow[]) => {
      if (controlledMembers === undefined) setInternalMembers(next)
      onMembersChange?.(next)
    },
    [controlledMembers, onMembersChange]
  )

  const reloadMembers = useCallback(async () => {
    const rm = await fetch(`/api/v1/organizations/${orgKey}/members`, { credentials: 'include' })
    if (rm.ok) {
      const d = (await rm.json()) as { items: OrgMemberRow[] }
      setMembers(d.items ?? [])
    }
  }, [orgKey, setMembers])

  useEffect(() => {
    if (controlledMembers !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const rm = await fetch(`/api/v1/organizations/${orgKey}/members`, { credentials: 'include' })
        if (cancelled) return
        if (rm.ok) {
          const d = (await rm.json()) as { items: OrgMemberRow[] }
          setInternalMembers(d.items ?? [])
        } else {
          setInternalMembers([])
        }
      } catch {
        if (!cancelled) setInternalMembers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgKey, controlledMembers])

  const sortedMembers = useMemo(() => {
    if (!members) return []
    const order = ['OWNER', 'ADMIN', 'MODERATOR', 'STAFF', 'MEMBER']
    return [...members].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
  }, [members])

  async function patchMember(userId: string, body: { role?: AssignableRole; volunteerTags?: string[] }) {
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setActionMsg(j.error ?? 'Could not update member')
        return
      }
      await reloadMembers()
    } catch {
      setActionMsg('Network error')
    }
  }

  function promptVolunteerTags(m: OrgMemberRow) {
    const cur = (m.volunteerTags ?? []).join(', ')
    const next = window.prompt('Volunteer tags (comma-separated)', cur)
    if (next === null) return
    void patchMember(m.userId, {
      volunteerTags: next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
    })
  }

  return (
    <OrganizerPanel
      title="Member roster"
      description="Change roles to grant organizer console access. Volunteer tags appear on the public Overview."
    >
      {members === null ?
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
      : members.length === 0 ?
        <p className="text-sm text-dc-muted">No members loaded.</p>
      : (
        <OrganizerDataTable
          rows={sortedMembers}
          rowKey={(m) => m.userId}
          emptyMessage="No members."
          columns={[
            {
              key: 'name',
              header: 'Member',
              render: (m) => (
                <div>
                  <Link
                    to={`/profile/${encodeURIComponent(m.username)}`}
                    className="font-medium text-dc-accent hover:underline"
                  >
                    {m.displayName || m.username}
                  </Link>
                  <p className="text-xs text-dc-muted">@{m.username}</p>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Role',
              className: 'w-36',
              render: (m) =>
                canManageRoles && m.role !== 'OWNER' ?
                  <select
                    value={ASSIGNABLE_ROLES.includes(m.role as AssignableRole) ? m.role : 'MEMBER'}
                    onChange={(e) => void patchMember(m.userId, { role: e.target.value as AssignableRole })}
                    className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-xs text-dc-text"
                    aria-label={`Role for ${m.displayName || m.username}`}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                : (
                  <span className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">{m.role}</span>
                ),
            },
            {
              key: 'hint',
              header: 'Access',
              className: 'hidden md:table-cell',
              render: (m) => (
                <span className="text-xs text-dc-muted">{ROLE_HINTS[m.role] ?? ''}</span>
              ),
            },
            {
              key: 'tags',
              header: 'Volunteer tags',
              className: 'w-40',
              render: (m) => (
                <div className="flex flex-wrap items-center gap-1">
                  {(m.volunteerTags ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-dc-elevated-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-dc-text-muted"
                    >
                      {t}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => promptVolunteerTags(m)}
                    className="text-[10px] text-dc-muted hover:text-dc-accent"
                  >
                    {(m.volunteerTags?.length ?? 0) > 0 ? 'Edit' : '+ Tags'}
                  </button>
                </div>
              ),
            },
            {
              key: 'directory',
              header: 'Directory',
              className: 'w-20 text-center',
              render: (m) =>
                m.listedInOrgDirectory ?
                  <span className="text-xs text-teal-300" title="Visible on public Overview">Listed</span>
                : (
                  <span className="text-xs text-dc-muted" title="Not in public directory">Hidden</span>
                ),
            },
          ]}
        />
      )}

      {actionMsg && <p className="mt-3 text-sm text-red-400">{actionMsg}</p>}
    </OrganizerPanel>
  )
}
