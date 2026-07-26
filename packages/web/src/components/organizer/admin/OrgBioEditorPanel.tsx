import { useCallback, useEffect, useState } from 'react'
import OrgRichBioEditor from '@/components/org/OrgRichBioEditor'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

export type OrgBioEditorPanelProps = {
  orgSlug: string
  /** When provided, skips org fetch for bio fields. */
  bio?: string | null
  bioFormat?: 'text' | 'html'
  /** Start in edit mode immediately. */
  autoEdit?: boolean
  onSaved?: (bio: string) => void
  onCancel?: () => void
}

export default function OrgBioEditorPanel({
  orgSlug,
  bio: controlledBio,
  bioFormat: controlledBioFormat,
  autoEdit = false,
  onSaved,
  onCancel,
}: OrgBioEditorPanelProps) {
  const orgKey = encodeURIComponent(orgSlug)
  const [internalBio, setInternalBio] = useState<string | null>(controlledBio ?? null)
  const [internalBioFormat, setInternalBioFormat] = useState<'text' | 'html'>(controlledBioFormat ?? 'text')
  const [editing, setEditing] = useState(autoEdit)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(controlledBio === undefined)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const bio = controlledBio !== undefined ? controlledBio : internalBio
  const bioFormat = controlledBioFormat !== undefined ? controlledBioFormat : internalBioFormat
  const bioFmt = bioFormat === 'html' ? 'html' : 'text'

  const loadBio = useCallback(async () => {
    setLoadErr(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadErr('Could not load organization bio.')
        return
      }
      const data = (await r.json()) as {
        organization: { bio: string | null; bioFormat?: 'text' | 'html' }
      }
      setInternalBio(data.organization.bio)
      setInternalBioFormat(data.organization.bioFormat === 'html' ? 'html' : 'text')
    } catch {
      setLoadErr('Network error')
    } finally {
      setLoading(false)
    }
  }, [orgKey])

  useEffect(() => {
    if (controlledBio !== undefined) return
    void loadBio()
  }, [controlledBio, loadBio])

  async function saveBio(html: string) {
    setSaveErr(null)
    setSaving(true)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: html, bioFormat: 'html' }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setSaveErr(j.error ?? 'Save failed')
        return
      }
      if (controlledBio === undefined) {
        setInternalBio(html)
        setInternalBioFormat('html')
      }
      setEditing(false)
      onSaved?.(html)
    } catch {
      setSaveErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <OrganizerPanel title="About description">
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
      </OrganizerPanel>
    )
  }

  if (loadErr) {
    return (
      <OrganizerPanel title="About description">
        <p className="text-sm text-red-400">{loadErr}</p>
        <button
          type="button"
          onClick={() => void loadBio()}
          className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Retry
        </button>
      </OrganizerPanel>
    )
  }

  return (
    <OrganizerPanel
      title="About description"
      description="Rich-text bio shown on the About tab."
      actions={
        !editing ? (
          <button
            type="button"
            onClick={() => {
              setSaveErr(null)
              setEditing(true)
            }}
            className="text-xs text-dc-accent hover:underline"
          >
            Edit description
          </button>
        ) : null
      }
    >
      {editing ? (
        <OrgRichBioEditor
          bio={bio}
          bioFormat={bioFmt}
          saving={saving}
          error={saveErr}
          onSave={(html) => void saveBio(html)}
          onCancel={() => {
            setEditing(false)
            setSaveErr(null)
            onCancel?.()
          }}
          onDismissError={() => setSaveErr(null)}
        />
      ) : bio ? (
        bioFmt === 'html' ? (
          <div
            className="prose prose-invert prose-sm max-w-none text-dc-text-muted [&_a]:text-dc-accent"
            dangerouslySetInnerHTML={{ __html: bio }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-dc-text-muted">{bio}</p>
        )
      ) : (
        <p className="text-sm text-dc-muted">No description yet. Use Edit to add one.</p>
      )}
    </OrganizerPanel>
  )
}
