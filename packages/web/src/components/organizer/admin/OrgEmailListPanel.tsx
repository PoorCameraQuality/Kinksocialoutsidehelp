'use client'

import { useCallback, useEffect, useState } from 'react'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import ScopeEmailBroadcastPanel from '@/components/email/ScopeEmailBroadcastPanel'

type Props = {
  orgSlug: string
}

export default function OrgEmailListPanel({ orgSlug }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [headline, setHeadline] = useState('')
  const [blurb, setBlurb] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/email-list-meta`, {
      credentials: 'include',
    })
    if (!r.ok) return
    const d = (await r.json()) as { enabled?: boolean; headline?: string | null; blurb?: string | null }
    setEnabled(Boolean(d.enabled))
    setHeadline(d.headline ?? '')
    setBlurb(d.blurb ?? '')
  }, [orgSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          community: {
            emailListEnabled: enabled,
            emailListHeadline: headline.trim() || null,
            emailListBlurb: blurb.trim() || null,
          },
        }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setMsg(j.error ?? 'Could not save')
        return
      }
      setMsg('Email list settings saved.')
      void load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <OrganizerPanel
        title="Public email list"
        description="Let visitors subscribe on your org hub. You can send broadcasts to the list; the platform owner receives a BCC when SMTP is configured."
      >
        <form onSubmit={save} className="space-y-4">
          <OrganizerFormSection title="Signup form">
            <label className="flex items-center gap-2 text-sm text-dc-text-muted">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Show email signup on public org Overview
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline (e.g. Stay in the loop)"
              className="mt-2 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
            />
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="Short description"
              rows={3}
              className="mt-2 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
            />
          </OrganizerFormSection>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save email list settings'}
          </button>
          {msg ? <p className="text-sm text-dc-text-muted">{msg}</p> : null}
        </form>
      </OrganizerPanel>
      <ScopeEmailBroadcastPanel scopeType="organization" scopeKey={orgSlug} canManage />
    </div>
  )
}
