'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'

type TrustedRole = { id: string; name: string; applySlug: string; roleKind?: string; status: string }

export function ParticipationSettingsPanel({ eventSlug, readOnly }: { eventSlug: string; readOnly: boolean }) {
  const [presenterEnabled, setPresenterEnabled] = useState(false)
  const [vendorEnabled, setVendorEnabled] = useState(false)
  const [staffRoleId, setStaffRoleId] = useState('')
  const [volunteerRoleId, setVolunteerRoleId] = useState('')
  const [roles, setRoles] = useState<TrustedRole[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [settingsRes, rolesRes] = await Promise.all([
      organizerDancecardFetch<{ participation: Record<string, unknown> }>(eventSlug, '/participation-settings').catch(() => ({ participation: {} })),
      organizerDancecardFetch<{ roles: TrustedRole[] }>(eventSlug, '/trusted-roles').catch(() => ({ roles: [] })),
    ])
    const p: Record<string, unknown> = settingsRes.participation ?? {}
    const pa = (p.presenterApply ?? {}) as { enabled?: boolean }
    const va = (p.vendorApply ?? {}) as { enabled?: boolean }
    setPresenterEnabled(Boolean(pa.enabled))
    setVendorEnabled(Boolean(va.enabled))
    setStaffRoleId(typeof p.staffRoleId === 'string' ? p.staffRoleId : '')
    setVolunteerRoleId(typeof p.volunteerRoleId === 'string' ? p.volunteerRoleId : '')
    setRoles(rolesRes.roles ?? [])
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (readOnly) return
    setBusy(true)
    setMsg(null)
    try {
      await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/participation-settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participation: {
            presenterApply: { enabled: presenterEnabled },
            vendorApply: { enabled: vendorEnabled },
            staffRoleId: staffRoleId || null,
            volunteerRoleId: volunteerRoleId || null,
          },
        }),
      })
      setMsg('Participation settings saved.')
    } catch {
      setMsg('Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const publishedRoles = roles.filter((r) => r.status === 'published')

  return (
    <Panel className="space-y-4 p-4">
      <h3 className="font-serif text-lg text-dc-text">Participation apply paths</h3>
      <p className="text-sm text-dc-muted">
        Control public Get involved links on the convention Welcome tab. Staff and volunteer use published trusted roles; offers are sent from application queues.
      </p>

      <label className="flex items-center gap-2 text-sm text-dc-text">
        <input type="checkbox" checked={presenterEnabled} disabled={readOnly} onChange={(e) => setPresenterEnabled(e.target.checked)} />
        Open presenter applications (catalog-based)
      </label>
      <label className="flex items-center gap-2 text-sm text-dc-text">
        <input type="checkbox" checked={vendorEnabled} disabled={readOnly} onChange={(e) => setVendorEnabled(e.target.checked)} />
        Open vendor booth applications
      </label>

      <label className={SETTINGS_LABEL_CLASS}>
        Staff apply role
        <select className={SETTINGS_FIELD_CLASS} value={staffRoleId} disabled={readOnly} onChange={(e) => setStaffRoleId(e.target.value)}>
          <option value="">, None -</option>
          {publishedRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      <label className={SETTINGS_LABEL_CLASS}>
        Volunteer apply role
        <select className={SETTINGS_FIELD_CLASS} value={volunteerRoleId} disabled={readOnly} onChange={(e) => setVolunteerRoleId(e.target.value)}>
          <option value="">, None -</option>
          {publishedRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      {msg ? <p className="text-sm text-dc-muted">{msg}</p> : null}
      {!readOnly ?
        <button type="button" disabled={busy} className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50" onClick={() => void save()}>
          Save participation settings
        </button>
      : null}
    </Panel>
  )
}
