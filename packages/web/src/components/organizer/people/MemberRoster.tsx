import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OrgMemberRow } from '@/components/organizer/admin/OrgMemberAdminPanel'
import MemberRoleBadge, { DirectoryVisibilityBadge } from '@/components/organizer/people/MemberRoleBadge'
import { PeopleSection } from '@/components/organizer/people/people-ui'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import CommunityTrustChip from '@/components/trust/CommunityTrustChip'
import ScopedMemberStandingPanel from '@/components/trust/ScopedMemberStandingPanel'
import { ORGANIZER_ACCESS, isSoleOwner } from '@/lib/organizer/org-people-utils'

const ASSIGNABLE_ROLES = ['ADMIN', 'MODERATOR', 'STAFF', 'MEMBER'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

type Props = {
  orgSlug: string
  members: OrgMemberRow[]
  allMembers: OrgMemberRow[]
  canManageRoles: boolean
  viewerUserId: string | null
  onReload: () => Promise<void>
  sectionId: string
}

function AccessSummary({ role }: { role: string }) {
  const bullets = ORGANIZER_ACCESS[role] ?? ORGANIZER_ACCESS.MEMBER
  return (
    <ul className="space-y-0.5 text-xs text-dc-text-muted">
      {bullets.map((b) => (
        <li key={b} className="flex gap-1.5">
          <span className="text-emerald-500/80" aria-hidden>
            •
          </span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  )
}

function MemberRowActions({
  member,
  allMembers,
  canManageRoles,
  onPatchTags,
}: {
  member: OrgMemberRow
  allMembers: OrgMemberRow[]
  canManageRoles: boolean
  onPatchTags: (m: OrgMemberRow) => void
}) {
  if (isSoleOwner(allMembers, member)) {
    return (
      <p className="text-xs leading-snug text-dc-text-muted" title="Organization must keep at least one owner">
        Full control. Cannot be changed here
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canManageRoles && member.role !== 'OWNER' ?
        <span className="text-dc-micro text-dc-muted">Change role in the Role column</span>
      : null}
      {canManageRoles && member.role !== 'OWNER' ?
        <button
          type="button"
          onClick={() => onPatchTags(member)}
          className="min-h-9 rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted hover:text-dc-accent"
        >
          Manage tags
        </button>
      : null}
      <Link
        to={`/profile/${encodeURIComponent(member.username)}`}
        className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted hover:text-dc-text"
      >
        View profile
      </Link>
    </div>
  )
}

function MemberCard({
  member,
  allMembers,
  canManageRoles,
  viewerUserId,
  orgSlug,
  onRoleChange,
  onPatchTags,
}: {
  member: OrgMemberRow
  allMembers: OrgMemberRow[]
  canManageRoles: boolean
  viewerUserId: string | null
  orgSlug: string
  onRoleChange: (userId: string, role: AssignableRole) => void
  onPatchTags: (m: OrgMemberRow) => void
}) {
  const isYou = viewerUserId && member.userId === viewerUserId
  const soleOwner = isSoleOwner(allMembers, member)

  return (
    <article className="rounded-xl border border-dc-border bg-dc-surface/40 p-4">
      <div className="flex gap-3">
        <PlaceholderAvatar size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-dc-text">{member.displayName || member.username}</p>
            {isYou ?
              <span className="rounded bg-dc-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-dc-accent">You</span>
            : null}
          </div>
          <p className="text-dc-micro text-dc-muted">@{member.username}</p>
          <CommunityTrustChip username={member.username} />
        </div>
        <DirectoryVisibilityBadge listed={!!member.listedInOrgDirectory} />
      </div>
      <div className="mt-3">
        {canManageRoles && member.role !== 'OWNER' && !soleOwner ?
          <select
            value={ASSIGNABLE_ROLES.includes(member.role as AssignableRole) ? member.role : 'MEMBER'}
            onChange={(e) => onRoleChange(member.userId, e.target.value as AssignableRole)}
            className="w-full min-h-10 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            aria-label={`Role for ${member.displayName || member.username}`}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        : (
          <MemberRoleBadge role={member.role} />
        )}
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">Organizer access</p>
        <div className="mt-1">
          <AccessSummary role={member.role} />
        </div>
      </div>
      {(member.volunteerTags?.length ?? 0) > 0 ?
        <div className="mt-3 flex flex-wrap gap-1">
          {(member.volunteerTags ?? []).map((t) => (
            <span key={t} className="rounded bg-dc-elevated-muted px-2 py-0.5 text-[10px] uppercase text-dc-text-muted">
              {t}
            </span>
          ))}
        </div>
      : null}
      <div className="mt-4">
        <MemberRowActions
          member={member}
          allMembers={allMembers}
          canManageRoles={canManageRoles}
          onPatchTags={onPatchTags}
        />
      </div>
      {canManageRoles && member.role !== 'OWNER' ?
        <div className="mt-4">
          <ScopedMemberStandingPanel
            scope="organization"
            scopeKey={orgSlug}
            memberUserId={member.userId}
            memberLabel={member.displayName || member.username}
            canModerate={canManageRoles}
          />
        </div>
      : null}
    </article>
  )
}

export default function MemberRoster({
  orgSlug,
  members,
  allMembers,
  canManageRoles,
  viewerUserId,
  onReload,
  sectionId,
}: Props) {
  const orgKey = encodeURIComponent(orgSlug)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const patchMember = useCallback(
    async (userId: string, body: { role?: AssignableRole; volunteerTags?: string[] }) => {
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
        await onReload()
      } catch {
        setActionMsg('Network error')
      }
    },
    [orgKey, onReload],
  )

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
    <PeopleSection id={sectionId}>
      <h3 className="text-base font-semibold text-dc-text">Member roster</h3>
      <p className="mt-1 text-sm text-dc-text-muted">
        {canManageRoles ?
          'Change roles to grant organizer console access. Volunteer tags appear on the public Overview when listed.'
        : 'View team roles and directory visibility. Contact an owner or admin to change roles.'}
      </p>

      {members.length === 0 ?
        <p className="mt-6 text-sm text-dc-text-muted">No members match your search or filters.</p>
      : (
        <>
          <div className="mt-4 hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-dc-border text-[10px] font-medium uppercase tracking-wide text-dc-muted">
                  <th className="pb-2 pr-4 font-medium">Member</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Organizer access</th>
                  <th className="pb-2 pr-4 font-medium">Volunteer tags</th>
                  <th className="pb-2 pr-4 font-medium">Public directory</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dc-border/80">
                {members.map((m) => {
                  const isYou = viewerUserId && m.userId === viewerUserId
                  const soleOwner = isSoleOwner(allMembers, m)
                  return (
                    <tr key={m.userId} className="align-top">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <PlaceholderAvatar size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-dc-text">{m.displayName || m.username}</span>
                              {isYou ?
                                <span className="rounded bg-dc-accent/20 px-1.5 py-0.5 text-[10px] text-dc-accent">
                                  You
                                </span>
                              : null}
                            </div>
                            <p className="text-dc-micro text-dc-muted">@{m.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {canManageRoles && m.role !== 'OWNER' && !soleOwner ?
                          <select
                            value={ASSIGNABLE_ROLES.includes(m.role as AssignableRole) ? m.role : 'MEMBER'}
                            onChange={(e) => void patchMember(m.userId, { role: e.target.value as AssignableRole })}
                            className="w-full max-w-[9rem] rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-xs text-dc-text"
                            aria-label={`Role for ${m.displayName || m.username}`}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r.charAt(0) + r.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        : (
                          <MemberRoleBadge role={m.role} />
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-[12rem]">
                        <AccessSummary role={m.role} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {(m.volunteerTags ?? []).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-dc-elevated-muted px-1.5 py-0.5 text-[9px] uppercase text-dc-text-muted"
                            >
                              {t}
                            </span>
                          ))}
                          {canManageRoles && m.role !== 'OWNER' ?
                            <button
                              type="button"
                              onClick={() => promptVolunteerTags(m)}
                              className="text-[10px] text-dc-accent hover:underline"
                            >
                              {(m.volunteerTags?.length ?? 0) > 0 ? 'Edit' : '+ Add tag'}
                            </button>
                          : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <DirectoryVisibilityBadge listed={!!m.listedInOrgDirectory} />
                      </td>
                      <td className="py-3 text-right">
                        <MemberRowActions
                          member={m}
                          allMembers={allMembers}
                          canManageRoles={canManageRoles}
                          onPatchTags={promptVolunteerTags}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 lg:hidden">
            {members.map((m) => (
              <MemberCard
                key={m.userId}
                member={m}
                allMembers={allMembers}
                canManageRoles={canManageRoles}
                viewerUserId={viewerUserId}
                orgSlug={orgSlug}
                onRoleChange={(userId, role) => void patchMember(userId, { role })}
                onPatchTags={promptVolunteerTags}
              />
            ))}
          </div>
        </>
      )}
      {actionMsg ?
        <p className="mt-3 text-sm text-red-400" role="alert">
          {actionMsg}
        </p>
      : null}
    </PeopleSection>
  )
}
