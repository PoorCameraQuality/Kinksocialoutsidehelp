import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

export type SubgroupRow = {
  id: string
  name: string
  slug: string
  memberCount?: number
}

export type OrgSubgroupAdminPanelProps = {
  orgSlug: string
  orgId: string
  subgroupsEnabled?: boolean
  /** When provided, skips subgroup fetch. */
  subgroups?: SubgroupRow[] | null
  onSubgroupsChange?: (items: SubgroupRow[]) => void
  onCreated?: (message: string) => void
}

export default function OrgSubgroupAdminPanel({
  orgSlug,
  orgId,
  subgroupsEnabled = true,
  subgroups: controlledSubgroups,
  onSubgroupsChange,
  onCreated,
}: OrgSubgroupAdminPanelProps) {
  const navigate = useNavigate()
  const [internalSubgroups, setInternalSubgroups] = useState<SubgroupRow[] | null>(
    controlledSubgroups === undefined ? null : controlledSubgroups
  )
  const [sgName, setSgName] = useState('')
  const [sgSlug, setSgSlug] = useState('')
  const [sgMsg, setSgMsg] = useState<string | null>(null)

  const subgroups = controlledSubgroups !== undefined ? controlledSubgroups : internalSubgroups

  const setSubgroups = useCallback(
    (next: SubgroupRow[]) => {
      if (controlledSubgroups === undefined) setInternalSubgroups(next)
      onSubgroupsChange?.(next)
    },
    [controlledSubgroups, onSubgroupsChange]
  )

  const reloadSubgroups = useCallback(async () => {
    const lr = await fetch(`/api/v1/groups?organizationId=${encodeURIComponent(orgId)}`, {
      credentials: 'include',
    })
    if (lr.ok) {
      const d = (await lr.json()) as { items: SubgroupRow[] }
      setSubgroups(d.items ?? [])
    }
  }, [orgId, setSubgroups])

  useEffect(() => {
    if (controlledSubgroups !== undefined || !subgroupsEnabled) return
    let cancelled = false
    ;(async () => {
      try {
        const lr = await fetch(`/api/v1/groups?organizationId=${encodeURIComponent(orgId)}`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (lr.ok) {
          const d = (await lr.json()) as { items: SubgroupRow[] }
          setInternalSubgroups(d.items ?? [])
        } else {
          setInternalSubgroups([])
        }
      } catch {
        if (!cancelled) setInternalSubgroups([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, subgroupsEnabled, controlledSubgroups])

  async function createSubgroup(e: React.FormEvent) {
    e.preventDefault()
    setSgMsg(null)
    if (!orgId || !sgName.trim() || !sgSlug.trim()) return
    try {
      const r = await fetch('/api/v1/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sgName.trim(),
          slug: sgSlug.trim().toLowerCase().replace(/\s+/g, '-'),
          organizationId: orgId,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; group?: { id: string } }
      if (!r.ok) {
        setSgMsg(j.error ?? 'Could not create group')
        return
      }
      setSgName('')
      setSgSlug('')
      const groupId = j.group?.id
      if (groupId) {
        navigate(`/organizer/groups/${encodeURIComponent(groupId)}`, { replace: true })
        return
      }
      const msg = 'Subgroup created.'
      setSgMsg(msg)
      onCreated?.(msg)
      await reloadSubgroups()
    } catch {
      setSgMsg('Network error')
    }
  }

  if (!subgroupsEnabled) {
    return (
      <OrganizerPanel title="Subgroups" description="Enable subgroups in org settings to create lightweight groups.">
        <p className="text-sm text-dc-muted">
          Subgroups are disabled for this organization. Turn on the subgroups module in Settings first.
        </p>
        <Link
          to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=settings`}
          className="mt-2 inline-block text-sm text-dc-accent hover:underline"
        >
          Open org settings
        </Link>
      </OrganizerPanel>
    )
  }

  return (
    <OrganizerPanel
      title="Subgroups"
      description="Create lightweight groups linked to this organization."
    >
      <OrganizerFormSection title="Existing subgroups">
        {subgroups === null ? (
          <div className="h-16 animate-pulse rounded-xl bg-dc-elevated-muted" />
        ) : subgroups.length === 0 ? (
          <p className="text-sm text-dc-muted">No sub-groups yet.</p>
        ) : (
          <ul className="space-y-2">
            {subgroups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/organizer/groups/${encodeURIComponent(g.id)}`}
                  className="block rounded-xl border border-dc-border px-4 py-3 text-dc-accent hover:border-dc-accent-border/40"
                >
                  <span className="font-medium text-dc-text">{g.name}</span>
                  <span className="ml-2 text-xs text-dc-muted">/{g.slug}</span>
                  {typeof g.memberCount === 'number' && (
                    <span className="ml-2 text-xs text-dc-muted">
                      {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OrganizerFormSection>

      <OrganizerFormSection title="Create sub-group" description="Requires moderator role or higher.">
        <form onSubmit={createSubgroup} className="max-w-md space-y-3">
          <input
            value={sgName}
            onChange={(e) => setSgName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <input
            value={sgSlug}
            onChange={(e) => setSgSlug(e.target.value)}
            placeholder="URL slug (e.g. munch-announce)"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <button type="submit" className="min-h-11 rounded-xl bg-dc-accent px-4 py-2 text-sm text-dc-text">
            Create
          </button>
          {sgMsg && <p className="text-sm text-dc-muted">{sgMsg}</p>}
        </form>
      </OrganizerFormSection>
    </OrganizerPanel>
  )
}
