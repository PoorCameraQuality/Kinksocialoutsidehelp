import { useState } from 'react'
import { FormStatusMessage } from '@/components/ui/primitives/layout'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { profileStudioNestedRowClass } from '@/components/profile/studio/profile-studio-classes'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

export default function WebsitesPanel() {
  const ctx = useProfileEdit()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasDraft = url.trim().length > 0

  async function addLink() {
    setError(null)
    setSuccess(null)
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Enter a website URL first.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/profile/me/links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, label: label.trim() || null }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error ?? 'Could not save link.')
        return
      }
      setUrl('')
      setLabel('')
      setSuccess('Link saved to your public profile.')
      await ctx.reloadLinks()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeLink(id: string) {
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const r = await fetch(`/api/profile/me/links/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) {
        setError('Could not remove link.')
        return
      }
      setSuccess('Link removed.')
      await ctx.reloadLinks()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProfileStudioSectionCard
      title="Links & Presence"
      description="Websites and external profiles shown on your public profile."
      icon={<IconUser />}
    >
      <ProfileStudioInsetCard className="space-y-2">
      <ul className="space-y-2">
        {ctx.links.map((link) => (
          <li key={link.id} className={`flex flex-wrap items-center justify-between gap-2 text-sm ${profileStudioNestedRowClass}`}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-dc-accent hover:underline truncate">
              {link.label ?? link.url}
            </a>
            <button type="button" onClick={() => void removeLink(link.id)} className="text-xs text-dc-accent hover:underline shrink-0">
              remove
            </button>
          </li>
        ))}
      </ul>
      </ProfileStudioInsetCard>
      <ProfileStudioInsetCard className="space-y-3">
        <p className="text-xs text-dc-muted">
          Links save with <strong className="text-dc-text">Save link</strong> below—not the footer Save bar.
        </p>
        <input
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
            setSuccess(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addLink()
            }
          }}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm disabled:opacity-60"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addLink()
            }
          }}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm disabled:opacity-60"
        />
        {error ?
          <FormStatusMessage tone="warning">{error}</FormStatusMessage>
        : null}
        {success ?
          <FormStatusMessage tone="success">{success}</FormStatusMessage>
        : null}
        <button
          type="button"
          onClick={() => void addLink()}
          disabled={saving || !hasDraft}
          className="min-h-10 rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
        >
          {saving ? 'Saving link…' : 'Save link'}
        </button>
      </ProfileStudioInsetCard>
      <p className="text-xs text-dc-muted">
        Presenter and vendor profiles are linked from those programs when you enroll.
      </p>
    </ProfileStudioSectionCard>
  )
}
