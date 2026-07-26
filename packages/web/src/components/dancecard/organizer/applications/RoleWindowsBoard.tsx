'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { organizerDancecardFetch, invalidateOrganizerDancecardCache } from '@/components/dancecard/organizer/organizerApi'
import {
  organizerTabHref,
  useOrganizerWorkspacePath,
} from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { applySlugFromName, publicTrustedRoleApplyPath } from '@/lib/dancecard/trustedRoles'
import type { ConventionCommandPermissions } from '@c2k/shared'

type TrustedRoleRow = {
  id: string
  name: string
  applySlug: string
  status: string
  roleKind?: string
  applyOpensAt?: string | null
  applyClosesAt?: string | null
  applyOpen?: boolean
}

type VettingAppRow = { id: string; status: string; trusted_role_id: string | null }

/** Standard application types we can seed as trusted roles in one click. */
const DEFAULT_ROLE_TEMPLATES: Array<{ key: string; name: string; roleKind: string; intro: string }> = [
  { key: 'educator', name: 'Educator / Presenter', roleKind: 'educator', intro: 'Apply to teach a class or lead a session at this event.' },
  { key: 'photographer', name: 'Photographer', roleKind: 'photographer', intro: 'Apply to shoot photo or video coverage at this event.' },
  { key: 'performer', name: 'Performer', roleKind: 'performer', intro: 'Apply to perform at this event.' },
  { key: 'volunteer', name: 'Volunteer', roleKind: 'volunteer', intro: 'Apply to volunteer during this event.' },
  { key: 'staff', name: 'Staff', roleKind: 'staff', intro: 'Apply for a staff position at this event.' },
]

const ROLE_KIND_LABELS: Record<string, string> = {
  staff: 'Staff',
  volunteer: 'Volunteer',
  presenter: 'Presenter',
  educator: 'Educator',
  photographer: 'Photographer',
  performer: 'Performer',
  custom: 'Custom',
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string | null {
  if (!local.trim()) return null
  const d = new Date(local)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

export function RoleWindowsBoard({
  eventSlug,
  readOnly,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
  readOnly: boolean
}) {
  const workspaceBase = useOrganizerWorkspacePath(eventSlug)
  const [roles, setRoles] = useState<TrustedRoleRow[]>([])
  const [apps, setApps] = useState<VettingAppRow[]>([])
  const [presenterEnabled, setPresenterEnabled] = useState(false)
  const [vendorEnabled, setVendorEnabled] = useState(false)
  const [participation, setParticipation] = useState<Record<string, unknown>>({})
  const [drafts, setDrafts] = useState<Record<string, { opensAt: string; closesAt: string }>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [rolesRes, settingsRes, appsRes] = await Promise.all([
        organizerDancecardFetch<{ roles: TrustedRoleRow[] }>(eventSlug, '/trusted-roles').catch(() => ({ roles: [] })),
        organizerDancecardFetch<{ participation: Record<string, unknown> }>(eventSlug, '/participation-settings').catch(
          () => ({ participation: {} }),
        ),
        organizerDancecardFetch<{ applications: VettingAppRow[] }>(eventSlug, '/vetting-applications').catch(() => ({
          applications: [],
        })),
      ])
      const list = rolesRes.roles ?? []
      setRoles(list)
      setApps(appsRes.applications ?? [])
      const p: Record<string, unknown> = settingsRes.participation ?? {}
      setParticipation(p)
      setPresenterEnabled(Boolean((p.presenterApply as { enabled?: boolean } | undefined)?.enabled))
      setVendorEnabled(Boolean((p.vendorApply as { enabled?: boolean } | undefined)?.enabled))
      setDrafts(
        Object.fromEntries(
          list.map((r) => [r.id, { opensAt: isoToLocalInput(r.applyOpensAt), closesAt: isoToLocalInput(r.applyClosesAt) }]),
        ),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load application windows')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const pendingByRole = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of apps) {
      if (!a.trusted_role_id) continue
      if (a.status === 'pending' || a.status === 'review') {
        map.set(a.trusted_role_id, (map.get(a.trusted_role_id) ?? 0) + 1)
      }
    }
    return map
  }, [apps])

  const existingKinds = useMemo(() => new Set(roles.map((r) => (r.roleKind ?? 'custom').toLowerCase())), [roles])
  const missingTemplates = DEFAULT_ROLE_TEMPLATES.filter((t) => !existingKinds.has(t.roleKind))

  async function patchParticipation(extra: Record<string, unknown>) {
    if (readOnly) return
    try {
      await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/participation-settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participation: {
            ...participation,
            ...extra,
          },
        }),
      })
      invalidateOrganizerDancecardCache(eventSlug, '/participation-settings')
    } catch {
      setErr('Could not sync public apply links')
    }
  }

  async function patchRole(id: string, patch: Record<string, unknown>) {
    if (readOnly) return
    const role = roles.find((r) => r.id === id)
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/trusted-roles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      invalidateOrganizerDancecardCache(eventSlug, '/trusted-roles')

      const kind = (role?.roleKind ?? 'custom').toLowerCase()
      if (patch.status === 'published' && (kind === 'staff' || kind === 'volunteer')) {
        await patchParticipation(kind === 'staff' ? { staffRoleId: id } : { volunteerRoleId: id })
      }
      if (patch.status === 'draft' && role) {
        const p = participation as Record<string, unknown>
        if (kind === 'staff' && p.staffRoleId === id) await patchParticipation({ staffRoleId: null })
        if (kind === 'volunteer' && p.volunteerRoleId === id) await patchParticipation({ volunteerRoleId: null })
      }

      await load()
      setMsg('Saved.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveParticipation(next: { presenterEnabled?: boolean; vendorEnabled?: boolean }) {
    if (readOnly) return
    const presenter = next.presenterEnabled ?? presenterEnabled
    const vendor = next.vendorEnabled ?? vendorEnabled
    setPresenterEnabled(presenter)
    setVendorEnabled(vendor)
    setBusy(true)
    setErr(null)
    try {
      await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/participation-settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participation: {
            ...participation,
            presenterApply: { ...(participation.presenterApply as object), enabled: presenter },
            vendorApply: { ...(participation.vendorApply as object), enabled: vendor },
          },
        }),
      })
      invalidateOrganizerDancecardCache(eventSlug, '/participation-settings')
      setMsg('Saved.')
    } catch {
      setErr('Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function seedDefaultRoles() {
    if (readOnly || !missingTemplates.length) return
    setBusy(true)
    setErr(null)
    try {
      for (const t of missingTemplates) {
        await organizerDancecardFetch(eventSlug, '/trusted-roles', {
          method: 'POST',
          body: JSON.stringify({
            name: t.name,
            applySlug: applySlugFromName(t.name),
            roleKind: t.roleKind,
            status: 'draft',
            introText: t.intro,
            questions: [
              { type: 'long_text', label: 'Tell us about your relevant experience.', required: true, sortOrder: 0, optionsJson: [] },
            ],
          }),
        })
      }
      invalidateOrganizerDancecardCache(eventSlug, '/trusted-roles')
      await load()
      setMsg('Standard application types added as drafts. Open the ones you want to accept.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add standard roles')
    } finally {
      setBusy(false)
    }
  }

  function copyApplyLink(role: TrustedRoleRow) {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}${publicTrustedRoleApplyPath(eventSlug, role.applySlug)}`
    void navigator.clipboard.writeText(url).then(() => setMsg('Apply link copied.'))
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-dc-text">Application windows</h2>
          <p className="mt-1 max-w-2xl text-xs text-dc-muted">
            Open or close each application type. Open windows show a public apply link; closed windows reject new
            submissions. Set optional open and close dates to schedule a window.
          </p>
        </div>
        {!readOnly && missingTemplates.length ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-dc-accent-border bg-dc-accent-muted px-4 py-2 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted/80 disabled:opacity-40"
            onClick={() => void seedDefaultRoles()}
          >
            + Add standard roles ({missingTemplates.length})
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-lg border border-dc-danger/30 bg-dc-danger-muted px-3 py-2 text-xs text-dc-danger">{err}</p>
      ) : null}
      {msg ? <p className="text-xs text-dc-muted">{msg}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* Presenter catalog window (participation-based) */}
        <ParticipationWindowCard
          title="Presenters (catalog)"
          subtitle="Catalog-based class submissions on the public Get involved page."
          enabled={presenterEnabled}
          readOnly={readOnly || busy}
          onToggle={(v) => void saveParticipation({ presenterEnabled: v })}
        />
        {/* Vendor booth window (participation-based) */}
        <ParticipationWindowCard
          title="Vendors"
          subtitle="Booth and exhibitor applications."
          enabled={vendorEnabled}
          readOnly={readOnly || busy}
          onToggle={(v) => void saveParticipation({ vendorEnabled: v })}
        />

        {roles.map((role) => {
          const draft = drafts[role.id] ?? { opensAt: '', closesAt: '' }
          const open = role.status === 'published'
          const pending = pendingByRole.get(role.id) ?? 0
          const windowDirty =
            draft.opensAt !== isoToLocalInput(role.applyOpensAt) || draft.closesAt !== isoToLocalInput(role.applyClosesAt)
          return (
            <div
              key={role.id}
              className="flex flex-col gap-3 rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-dc-text">{role.name}</p>
                  <p className="mt-0.5 text-[11px] text-dc-muted">{ROLE_KIND_LABELS[role.roleKind ?? 'custom'] ?? 'Custom'}</p>
                </div>
                <span
                  className={
                    role.applyOpen
                      ? 'shrink-0 rounded-full bg-dc-success-muted px-2 py-0.5 text-[10px] font-semibold text-dc-success'
                      : 'shrink-0 rounded-full bg-dc-elevated px-2 py-0.5 text-[10px] font-semibold text-dc-muted'
                  }
                >
                  {role.applyOpen ? 'Accepting' : open ? 'Scheduled' : 'Closed'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-dc-muted">
                  {pending > 0 ? `${pending} awaiting review` : 'No pending applications'}
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={
                      open
                        ? 'rounded-full border border-dc-border px-3 py-1 text-[11px] font-semibold text-dc-muted hover:bg-white/5 disabled:opacity-40'
                        : 'rounded-full bg-dc-accent px-3 py-1 text-[11px] font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40'
                    }
                    onClick={() => void patchRole(role.id, { status: open ? 'draft' : 'published' })}
                  >
                    {open ? 'Close' : 'Open'}
                  </button>
                ) : null}
              </div>

              {!readOnly ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Opens
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      value={draft.opensAt}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [role.id]: { ...draft, opensAt: e.target.value } }))
                      }
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Closes
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      value={draft.closesAt}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [role.id]: { ...draft, closesAt: e.target.value } }))
                      }
                    />
                  </label>
                </div>
              ) : null}

              {!readOnly && windowDirty ? (
                <button
                  type="button"
                  disabled={busy}
                  className="self-start rounded-full border border-dc-accent-border px-3 py-1 text-[11px] font-semibold text-dc-accent hover:bg-dc-accent-muted disabled:opacity-40"
                  onClick={() =>
                    void patchRole(role.id, {
                      applyOpensAt: localInputToIso(draft.opensAt),
                      applyClosesAt: localInputToIso(draft.closesAt),
                    })
                  }
                >
                  Save window
                </button>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-dc-border pt-2 text-[11px]">
                {open ? (
                  <button type="button" className="text-dc-accent hover:underline" onClick={() => copyApplyLink(role)}>
                    Copy apply link
                  </button>
                ) : null}
                <Link
                  to={organizerTabHref(workspaceBase, 'applications', { vettingRoleId: role.id })}
                  className="text-dc-accent hover:underline"
                >
                  Review →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ParticipationWindowCard({
  title,
  subtitle,
  enabled,
  readOnly,
  onToggle,
}: {
  title: string
  subtitle: string
  enabled: boolean
  readOnly: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-dc-text">{title}</p>
          <p className="mt-0.5 text-[11px] text-dc-muted">{subtitle}</p>
        </div>
        <span
          className={
            enabled
              ? 'shrink-0 rounded-full bg-dc-success-muted px-2 py-0.5 text-[10px] font-semibold text-dc-success'
              : 'shrink-0 rounded-full bg-dc-elevated px-2 py-0.5 text-[10px] font-semibold text-dc-muted'
          }
        >
          {enabled ? 'Accepting' : 'Closed'}
        </span>
      </div>
      {!readOnly ? (
        <button
          type="button"
          className={
            enabled
              ? 'self-start rounded-full border border-dc-border px-3 py-1 text-[11px] font-semibold text-dc-muted hover:bg-white/5'
              : 'self-start rounded-full bg-dc-accent px-3 py-1 text-[11px] font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover'
          }
          onClick={() => onToggle(!enabled)}
        >
          {enabled ? 'Close' : 'Open'}
        </button>
      ) : null}
    </div>
  )
}
