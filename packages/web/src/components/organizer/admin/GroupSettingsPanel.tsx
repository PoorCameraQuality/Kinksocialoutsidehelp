import { useCallback, useEffect, useState } from 'react'
import { GROUP_CATEGORY_DESCRIPTIONS, GROUP_CATEGORY_VALUES, normalizeGroupTags } from '@c2k/shared'
import TagSelector from '@/components/ui/TagSelector'
import TextInput from '@/components/ui/TextInput'
import PlaceRegionPicker from '@/components/location/PlaceRegionPicker'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { TAG_SEEDS } from '@/data/mock-data'

type GroupRecord = {
  id: string
  slug: string
  name: string
  visibility: string
  category?: string | null
  description?: string | null
  tags?: string[]
  placeId?: string | null
  placeLabel?: string | null
  serviceRadiusMi?: number
  emailSignupEnabled?: boolean
}

type Props = {
  groupId: string
  onGroupUpdated?: (group: GroupRecord) => void
  /** Render inside organizer settings shell (no duplicate page chrome). */
  embedded?: boolean
}

const inputClass =
  'w-full min-h-10 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus:ring-2 focus:ring-dc-accent/30'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private (members only)' },
  { value: 'invite-only', label: 'Invite only' },
  { value: 'owner_absent', label: 'Owner absent (restricted)' },
] as const

export default function GroupSettingsPanel({ groupId, onGroupUpdated, embedded = false }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [tags, setTags] = useState<string[]>([])
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [serviceRadiusMi, setServiceRadiusMi] = useState(50)
  const [emailSignupEnabled, setEmailSignupEnabled] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [customTag, setCustomTag] = useState('')

  const loadGroup = useCallback(async () => {
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadError('Could not load group settings.')
        return
      }
      const j = (await r.json()) as { group?: GroupRecord }
      const g = j.group
      if (!g) {
        setLoadError('Group settings unavailable.')
        return
      }
      setName(g.name ?? '')
      setCategory(g.category ?? '')
      setDescription(g.description ?? '')
      setVisibility(g.visibility ?? 'public')
      setTags(Array.isArray(g.tags) ? g.tags : [])
      setPlaceId(g.placeId ?? null)
      setServiceRadiusMi(g.serviceRadiusMi ?? 50)
      setEmailSignupEnabled(Boolean(g.emailSignupEnabled))
      onGroupUpdated?.(g)
    } catch {
      setLoadError('Network error loading group settings.')
    } finally {
      setLoadAttempted(true)
    }
  }, [groupId, onGroupUpdated])

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])

  useEffect(() => {
    if (!msg || /fail|error|could not|network|not available|required/i.test(msg)) return
    const timer = window.setTimeout(() => setMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [msg])

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setMsg('Group name is required.')
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category || null,
          description: description.trim() || null,
          visibility,
          tags,
          placeId,
          serviceRadiusMi,
          emailSignupEnabled,
        }),
      })
      if (r.status === 404 || r.status === 405) {
        setMsg('Group settings could not be saved in this environment.')
        return
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string; group?: GroupRecord }
      if (!r.ok) {
        setMsg(j.error ?? 'Could not save group settings.')
        return
      }
      if (j.group) {
        setName(j.group.name ?? name.trim())
        setCategory(j.group.category ?? '')
        setDescription(j.group.description ?? '')
        setVisibility(j.group.visibility ?? visibility)
        setTags(Array.isArray(j.group.tags) ? j.group.tags : tags)
        onGroupUpdated?.(j.group)
      }
      setMsg('Settings saved.')
    } catch {
      setMsg('Network error saving settings.')
    } finally {
      setSaving(false)
    }
  }

  const msgIsError = Boolean(msg && /fail|error|could not|network|not available|required/i.test(msg))

  const formBody = (
    <>
      {loadError ?
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadGroup()}
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

      {!loadAttempted ?
        <div className="h-32 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {loadAttempted && !loadError ?
        <form onSubmit={saveSettings} className="space-y-0">
            <OrganizerFormSection title="Basics">
              <label className="block space-y-1">
                <span className="text-xs text-dc-muted">Group name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  maxLength={255}
                  disabled={saving}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-dc-muted">Purpose</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                  disabled={saving}
                >
                  <option value="">No category</option>
                  {GROUP_CATEGORY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value} · {GROUP_CATEGORY_DESCRIPTIONS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-dc-muted">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={`${inputClass} resize-none`}
                  disabled={saving}
                  placeholder="Short summary for discovery and the group page"
                  maxLength={5000}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-dc-muted">Visibility</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className={inputClass}
                  disabled={saving}
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </OrganizerFormSection>

            <OrganizerFormSection
              title="Home region"
              description="Geographic groups appear in Near you discovery when members search within your service radius."
            >
              <PlaceRegionPicker value={placeId} onChange={setPlaceId} disabled={saving} idPrefix="group-home" />
              <label className="block space-y-1 mt-3">
                <span className="text-xs text-dc-muted">
                  Service radius (miles): {serviceRadiusMi}
                </span>
                <input
                  type="range"
                  min={5}
                  max={200}
                  step={5}
                  value={serviceRadiusMi}
                  onChange={(e) => setServiceRadiusMi(Number(e.target.value))}
                  disabled={saving}
                  className="w-full"
                />
              </label>
            </OrganizerFormSection>

            <OrganizerFormSection title="Email list">
              <label className="flex items-center gap-2 text-sm text-dc-text-muted">
                <input
                  type="checkbox"
                  checked={emailSignupEnabled}
                  onChange={(e) => setEmailSignupEnabled(e.target.checked)}
                  disabled={saving}
                />
                Show public email signup on group page
              </label>
            </OrganizerFormSection>

            <OrganizerFormSection
              title="Tags"
              description="Specific interests and keywords. Searchable alongside the group name."
            >
              <TagSelector
                tags={TAG_SEEDS}
                selectedTags={tags}
                onToggle={(tag) => {
                  setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
                }}
                ariaLabel="Suggested group tags"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {tags
                  .filter((t) => !(TAG_SEEDS as readonly string[]).includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      className="min-h-10 rounded-lg border border-dc-accent bg-dc-accent/20 px-3 py-2 text-sm text-dc-accent"
                    >
                      #{tag} ×
                    </button>
                  ))}
              </div>
              <div className="mt-3 flex gap-2">
                <TextInput
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="Add custom tag"
                  className="min-h-10 flex-1 rounded-xl"
                  disabled={saving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const next = normalizeGroupTags([...tags, customTag])
                      if (next.length > tags.length) setTags(next)
                      setCustomTag('')
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={saving || !customTag.trim()}
                  onClick={() => {
                    const next = normalizeGroupTags([...tags, customTag])
                    if (next.length > tags.length) setTags(next)
                    setCustomTag('')
                  }}
                  className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </OrganizerFormSection>

            <div className="sticky bottom-0 z-10 -mx-1 mt-6 border-t border-dc-border bg-[var(--organizer-panel-bg)]/95 px-1 py-4 backdrop-blur-sm sm:-mx-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="min-h-11 rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save metadata'}
              </button>
            </div>
          </form>
        : null}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-dc-text">Metadata &amp; discovery</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            Name, category, description, visibility, region, and tags shown on discovery and the public group page.
          </p>
        </div>
        {formBody}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <OrganizerPanel
        title="Group metadata"
        description="Name, category, description, and visibility shown on discovery and the public group page."
      >
        {formBody}
      </OrganizerPanel>
    </div>
  )
}
