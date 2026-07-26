import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PresenterEckePanel from '@/components/ecke/PresenterEckePanel'

type PresenterRow = {
  userId: string
  headline: string | null
  bioShort: string | null
  bio: string | null
  backgroundStory?: string | null
  mentorshipOffered?: boolean
  mentorshipNotes?: string | null
  links: Record<string, string>
  profileKind: string
  expertiseTags: string[] | null
  directoryVisibility: string
  eckePublish?: boolean
}

type SkillClaimRow = {
  id: string
  skillLabel: string
  yearsActive: number | null
  frequency: string | null
  note: string | null
}

type RunnerMaterial = { label: string; url: string }

type Offering = {
  id: string
  title: string
  tease: string | null
  outline: string | null
  durationMinutes: number | null
  level: string | null
  format: string | null
  tags: string[] | null
  runnerMaterials?: RunnerMaterial[] | null
  isPublic: boolean
  sortOrder: number
}

type GalleryRow = { id: string; imageUrl: string; caption: string | null; sortOrder: number }

type TeachingRow = {
  id: string
  title: string
  eventName: string
  eventDate: string | null
  detailUrl: string | null
  verified: boolean
  scheduleSlotId: string | null
  conventionSlug?: string | null
}

type LinkRow = { key: string; label: string; url: string }

function tagsFromCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function csvFromTags(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ')
}

export default function PresenterCatalogSection() {
  const { viewerUserId, viewerUsername } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [presenter, setPresenter] = useState<PresenterRow | null>(null)
  const [headline, setHeadline] = useState('')
  const [bioShort, setBioShort] = useState('')
  const [bio, setBio] = useState('')
  const [profileKind, setProfileKind] = useState<'PRES' | 'AUTHOR' | 'BOTH' | 'PHOTO'>('PRES')
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>('UNLISTED')
  const [eckePublish, setEckePublish] = useState(false)
  const [linkRows, setLinkRows] = useState<LinkRow[]>([])

  const [offerings, setOfferings] = useState<Offering[]>([])
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTease, setEditTease] = useState('')
  const [editOutline, setEditOutline] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editLevel, setEditLevel] = useState('')
  const [editFormat, setEditFormat] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPublic, setEditPublic] = useState(true)
  const [editMaterials, setEditMaterials] = useState<RunnerMaterial[]>([])

  const [newTitle, setNewTitle] = useState('')
  const [newTease, setNewTease] = useState('')
  const [newOutline, setNewOutline] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [newLevel, setNewLevel] = useState('')
  const [newFormat, setNewFormat] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newPublic, setNewPublic] = useState(true)
  const [newMaterials, setNewMaterials] = useState<RunnerMaterial[]>([])

  const [gallery, setGallery] = useState<GalleryRow[]>([])
  const [newGalleryUrl, setNewGalleryUrl] = useState('')
  const [newGalleryCaption, setNewGalleryCaption] = useState('')

  const [credits, setCredits] = useState<TeachingRow[]>([])
  const [tcTitle, setTcTitle] = useState('')
  const [tcEvent, setTcEvent] = useState('')
  const [tcDate, setTcDate] = useState('')
  const [tcUrl, setTcUrl] = useState('')

  const [backgroundStory, setBackgroundStory] = useState('')
  const [mentorshipOffered, setMentorshipOffered] = useState(false)
  const [mentorshipNotes, setMentorshipNotes] = useState('')
  const [skillClaims, setSkillClaims] = useState<SkillClaimRow[]>([])
  const [scLabel, setScLabel] = useState('')
  const [scYears, setScYears] = useState('')
  const [scFrequency, setScFrequency] = useState('monthly')
  const [scNote, setScNote] = useState('')

  const load = useCallback(async () => {
    if (!viewerUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const [pr, off, gal, tc, sc] = await Promise.all([
        fetch(`/api/v1/presenters/by-user/${viewerUserId}`, { credentials: 'include' }),
        fetch('/api/v1/presenters/me/offerings', { credentials: 'include' }),
        fetch('/api/v1/presenters/me/gallery', { credentials: 'include' }),
        fetch('/api/v1/presenters/me/teaching-credits', { credentials: 'include' }),
        fetch('/api/v1/presenters/me/skill-claims', { credentials: 'include' }),
      ])
      if (pr.status === 503) {
        setMsg('Database mode required for presenter profiles.')
        setLoading(false)
        return
      }
      const pdata = (await pr.json()) as { presenter?: PresenterRow | null }
      if (pdata.presenter) {
        setPresenter(pdata.presenter as PresenterRow)
        setHeadline(pdata.presenter.headline ?? '')
        setBioShort(pdata.presenter.bioShort ?? '')
        setBio(pdata.presenter.bio ?? '')
        setBackgroundStory(pdata.presenter.backgroundStory ?? '')
        setMentorshipOffered(Boolean(pdata.presenter.mentorshipOffered))
        setMentorshipNotes(pdata.presenter.mentorshipNotes ?? '')
        setProfileKind((pdata.presenter.profileKind as typeof profileKind) ?? 'PRES')
        setTagsInput((pdata.presenter.expertiseTags ?? []).join(', '))
        setVisibility((pdata.presenter.directoryVisibility as typeof visibility) ?? 'UNLISTED')
        setEckePublish(Boolean(pdata.presenter.eckePublish))
        const links = pdata.presenter.links ?? {}
        setLinkRows(
          Object.entries(links).map(([label, url], i) => ({
            key: `lr-${i}-${label}`,
            label,
            url: url ?? '',
          }))
        )
      } else {
        setPresenter(null)
        setHeadline('')
        setBioShort('')
        setBio('')
        setProfileKind('PRES')
        setTagsInput('')
        setVisibility('UNLISTED')
        setEckePublish(false)
        setLinkRows([])
      }
      if (off.ok) {
        const odata = (await off.json()) as { items?: Offering[] }
        setOfferings(odata.items ?? [])
      } else {
        setOfferings([])
      }
      if (gal.ok) {
        const gdata = (await gal.json()) as { items?: GalleryRow[] }
        setGallery(gdata.items ?? [])
      } else {
        setGallery([])
      }
      if (tc.ok) {
        const tdata = (await tc.json()) as { items?: TeachingRow[] }
        setCredits(tdata.items ?? [])
      } else {
        setCredits([])
      }
      if (sc.ok) {
        const sdata = (await sc.json()) as { items?: SkillClaimRow[] }
        setSkillClaims(sdata.items ?? [])
      } else {
        setSkillClaims([])
      }
    } catch {
      setMsg('Network error')
    } finally {
      setLoading(false)
    }
  }, [viewerUserId])

  useEffect(() => {
    void load()
  }, [load])

  function linksPayload(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const row of linkRows) {
      const u = row.url.trim()
      if (!u) continue
      const lab = row.label.trim() || 'Link'
      out[lab] = u
    }
    return out
  }

  async function saveProfile() {
    if (!viewerUserId) return
    setSaving(true)
    setMsg(null)
    try {
      const expertiseTags = tagsFromCsv(tagsInput)
      const r = await fetch('/api/v1/presenters/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim() || null,
          bioShort: bioShort.trim() || null,
          bio: bio.trim() || null,
          backgroundStory: backgroundStory.trim() || null,
          mentorshipOffered,
          mentorshipNotes: mentorshipNotes.trim() || null,
          links: linksPayload(),
          profileKind,
          expertiseTags: expertiseTags.length ? expertiseTags : null,
          directoryVisibility: visibility,
          eckePublish: visibility === 'PUBLIC' ? eckePublish : false,
        }),
      })
      const data = (await r.json()) as { error?: string; presenter?: PresenterRow }
      if (!r.ok) {
        setMsg(data.error ?? 'Save failed')
        return
      }
      if (data.presenter) setPresenter(data.presenter as PresenterRow)
      setMsg('Presenter profile saved.')
    } catch {
      setMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  function startEditOffering(o: Offering) {
    setEditingOfferingId(o.id)
    setEditTitle(o.title)
    setEditTease(o.tease ?? '')
    setEditOutline(o.outline ?? '')
    setEditDuration(o.durationMinutes != null ? String(o.durationMinutes) : '')
    setEditLevel(o.level ?? '')
    setEditFormat(o.format ?? '')
    setEditTags(csvFromTags(o.tags))
    setEditPublic(o.isPublic)
    setEditMaterials([...(o.runnerMaterials ?? [])])
  }

  function cancelEditOffering() {
    setEditingOfferingId(null)
  }

  async function saveEditOffering() {
    if (!editingOfferingId) return
    const dm = editDuration.trim() ? parseInt(editDuration, 10) : null
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/presenters/me/offerings/${editingOfferingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          tease: editTease.trim() || null,
          outline: editOutline.trim() || null,
          durationMinutes: dm != null && !Number.isNaN(dm) && dm > 0 ? dm : null,
          level: editLevel.trim() || null,
          format: editFormat.trim() || null,
          tags: tagsFromCsv(editTags).length ? tagsFromCsv(editTags) : null,
          isPublic: editPublic,
          runnerMaterials: editMaterials.filter((m) => m.label.trim() && m.url.trim()),
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setMsg(data.error ?? 'Update failed')
        return
      }
      setEditingOfferingId(null)
      await load()
      setMsg('Offering updated.')
    } catch {
      setMsg('Network error')
    }
  }

  async function addOffering() {
    if (!newTitle.trim()) {
      setMsg('Title is required for a new offering.')
      return
    }
    const dm = newDuration.trim() ? parseInt(newDuration, 10) : null
    setMsg(null)
    try {
      const r = await fetch('/api/v1/presenters/me/offerings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          tease: newTease.trim() || null,
          outline: newOutline.trim() || null,
          durationMinutes: dm != null && !Number.isNaN(dm) && dm > 0 ? dm : null,
          level: newLevel.trim() || null,
          format: newFormat.trim() || null,
          tags: tagsFromCsv(newTags).length ? tagsFromCsv(newTags) : null,
          isPublic: newPublic,
          runnerMaterials: newMaterials.filter((m) => m.label.trim() && m.url.trim()),
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setMsg(data.error ?? 'Could not add offering')
        return
      }
      setNewTitle('')
      setNewTease('')
      setNewOutline('')
      setNewDuration('')
      setNewLevel('')
      setNewFormat('')
      setNewTags('')
      setNewPublic(true)
      setNewMaterials([])
      await load()
      setMsg('Offering added.')
    } catch {
      setMsg('Network error')
    }
  }

  async function deleteOffering(id: string) {
    if (!confirm('Remove this offering?')) return
    try {
      const r = await fetch(`/api/v1/presenters/me/offerings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        setMsg(data.error ?? 'Delete failed')
        return
      }
      if (editingOfferingId === id) setEditingOfferingId(null)
      await load()
    } catch {
      setMsg('Network error')
    }
  }

  async function addGalleryImage() {
    if (!newGalleryUrl.trim()) {
      setMsg('Image URL required.')
      return
    }
    setMsg(null)
    try {
      const r = await fetch('/api/v1/presenters/me/gallery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: newGalleryUrl.trim(),
          caption: newGalleryCaption.trim() || null,
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setMsg(data.error ?? 'Could not add image')
        return
      }
      setNewGalleryUrl('')
      setNewGalleryCaption('')
      await load()
    } catch {
      setMsg('Network error')
    }
  }

  async function deleteGalleryImage(id: string) {
    if (!confirm('Remove this gallery image?')) return
    try {
      const r = await fetch(`/api/v1/presenters/me/gallery/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        setMsg(data.error ?? 'Delete failed')
        return
      }
      await load()
    } catch {
      setMsg('Network error')
    }
  }

  async function addTeachingCredit() {
    if (!tcTitle.trim() || !tcEvent.trim()) {
      setMsg('Class title and event name are required.')
      return
    }
    setMsg(null)
    try {
      const r = await fetch('/api/v1/presenters/me/teaching-credits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tcTitle.trim(),
          eventName: tcEvent.trim(),
          eventDate: tcDate.trim() || null,
          detailUrl: tcUrl.trim() || null,
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setMsg(data.error ?? 'Could not add entry')
        return
      }
      setTcTitle('')
      setTcEvent('')
      setTcDate('')
      setTcUrl('')
      await load()
    } catch {
      setMsg('Network error')
    }
  }

  async function deleteTeachingCredit(id: string) {
    if (!confirm('Remove this teaching entry?')) return
    try {
      const r = await fetch(`/api/v1/presenters/me/teaching-credits/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        setMsg(data.error ?? 'Delete failed')
        return
      }
      await load()
    } catch {
      setMsg('Network error')
    }
  }

  function MaterialRowsEditor({
    items,
    onChange,
  }: {
    items: RunnerMaterial[]
    onChange: (next: RunnerMaterial[]) => void
  }) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-dc-muted">
          Runner-only handouts (HTTPS links). Shown to you and to org staff when you&apos;re on their program or have an
          approved presenter request. Not on the public page.
        </p>
        {items.map((m, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Label"
              value={m.label}
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...next[i], label: e.target.value }
                onChange(next)
              }}
              className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <input
              type="url"
              placeholder="https://…"
              value={m.url}
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...next[i], url: e.target.value }
                onChange(next)
              }}
              className="flex-[2] min-w-[180px] px-2 py-1.5 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <button
              type="button"
              className="text-xs text-red-400"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-dc-accent hover:underline"
          onClick={() => onChange([...items, { label: '', url: '' }])}
        >
          + Add link
        </button>
      </div>
    )
  }

  if (!viewerUserId) {
    return (
      <section className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]">
        <h2 className="text-sm font-semibold text-dc-muted uppercase mb-2">Presenter / author catalog</h2>
        <p className="text-sm text-dc-muted">
          Sign in with a database account to manage your public presenter profile and class offerings.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]">
        <h2 className="text-sm font-semibold text-dc-muted uppercase mb-2">Presenter / author catalog</h2>
        <p className="text-sm text-dc-muted">Loading…</p>
      </section>
    )
  }

  return (
    <section id="presenter-catalog" className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] scroll-mt-24">
      <h2 className="text-sm font-semibold text-dc-muted uppercase mb-4">Professional profile catalog</h2>
      <p className="text-xs text-dc-muted mb-4">
        List yourself in the{' '}
        <Link to="/presenters" className="text-dc-accent hover:underline">
          directory
        </Link>{' '}
        (set visibility to Public). Public sees class titles and descriptions; handout links are only visible to event
        organizers who have you on their program (or an approved request).
        {viewerUsername && (
          <>
            {' '}
            -{' '}
            <Link
              to={`/presenters/${encodeURIComponent(viewerUsername)}`}
              className="text-dc-accent hover:underline"
            >
              View your public page
            </Link>
          </>
        )}
      </p>
      <p className="text-xs text-dc-muted mb-4">
        Set up or extend your profile:{' '}
        <Link to="/presenters/onboarding?track=educator" className="text-dc-accent hover:underline font-medium">
          Educator
        </Link>
        {' · '}
        <Link to="/presenters/onboarding?track=speaker" className="text-dc-accent hover:underline font-medium">
          Speaker
        </Link>
        {' · '}
        <Link to="/presenters/onboarding?track=author" className="text-dc-accent hover:underline font-medium">
          Author
        </Link>
        {' · '}
        <Link to="/presenters/onboarding?track=photographer" className="text-dc-accent hover:underline font-medium">
          Photographer
        </Link>
        {' · '}
        <Link to="/education/write" className="text-dc-accent hover:underline font-medium">
          Write an educator article
        </Link>
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-dc-text-muted mb-1">Headline</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dc-text-muted mb-1">Short bio (card blurb)</label>
          <textarea
            value={bioShort}
            onChange={(e) => setBioShort(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dc-text-muted mb-1">Full bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dc-text-muted mb-1">Social &amp; web links</label>
          <p className="text-xs text-dc-muted mb-2">Shown on your public presenter page (label + URL).</p>
          {linkRows.map((row) => (
            <div key={row.key} className="flex flex-wrap gap-2 mb-2">
              <input
                type="text"
                placeholder="Label (e.g. FetLife)"
                value={row.label}
                onChange={(e) =>
                  setLinkRows((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r))
                  )
                }
                className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
              <input
                type="url"
                placeholder="https://…"
                value={row.url}
                onChange={(e) =>
                  setLinkRows((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, url: e.target.value } : r))
                  )
                }
                className="flex-[2] min-w-[160px] px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
              <button
                type="button"
                className="text-xs text-red-400 px-2"
                onClick={() => setLinkRows((rows) => rows.filter((r) => r.key !== row.key))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-dc-accent hover:underline"
            onClick={() =>
              setLinkRows((rows) => [...rows, { key: `lr-${Date.now()}`, label: '', url: '' }])
            }
          >
            + Add link
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-dc-text-muted mb-1">Kind</label>
            <select
              value={profileKind}
              onChange={(e) => setProfileKind(e.target.value as typeof profileKind)}
              className="w-full min-h-11 px-3 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            >
              <option value="PRES">Presenter</option>
              <option value="AUTHOR">Author</option>
              <option value="BOTH">Both</option>
              <option value="PHOTO">Photographer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-dc-text-muted mb-1">Directory visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="w-full min-h-11 px-3 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            >
              <option value="UNLISTED">Unlisted (direct link; not in directory)</option>
              <option value="PUBLIC">Public (searchable in directory)</option>
            </select>
            {visibility === 'UNLISTED' ?
              <p className="mt-1 text-xs text-dc-muted">
                Unlisted profiles do not appear in the presenter directory or people search, but anyone with the direct
                link may still view the public version. Unlisted pages use noindex for search engines.
              </p>
            : null}
          </div>
          {visibility === 'PUBLIC' ?
            <div className="rounded-lg border border-dc-border p-3 bg-dc-surface-muted/40">
              <label className="flex items-start gap-2 text-sm text-dc-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={eckePublish}
                  onChange={(e) => setEckePublish(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Publish presenter profile to East Coast Kink Events (ECKE) when I choose Publish below.
                  Private contact, references, and runner materials never sync.
                </span>
              </label>
            </div>
          : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-dc-text-muted mb-1">Expertise tags (comma-separated)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="rope, negotiation, impact…"
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm placeholder:text-dc-muted"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveProfile()}
          className="px-4 py-2 rounded-xl bg-dc-elevated-muted text-dc-text text-sm font-medium border border-dc-border hover:bg-white/15 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save presenter profile'}
        </button>
      </div>

      {viewerUserId && presenter && visibility === 'PUBLIC' && eckePublish ?
        <div className="mt-8 pt-6 border-t border-dc-border">
          <h3 className="text-sm font-semibold text-dc-text mb-3">ECKE publish</h3>
          <PresenterEckePanel presenterUserId={viewerUserId} />
        </div>
      : null}

      <div className="mt-8 pt-6 border-t border-dc-border">
        <h3 className="text-sm font-semibold text-dc-text mb-2">Portfolio gallery</h3>
        <p className="text-xs text-dc-muted mb-3">
          Extra photos (URLs). Your account avatar in Profile edit is your headshot; this section is for portfolio shots.
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {gallery.map((g) => (
            <li key={g.id} className="relative rounded-lg border border-dc-border overflow-hidden bg-dc-elevated-solid">
              <img src={g.imageUrl} alt="" className="w-full h-28 object-cover" />
              {g.caption ? <p className="text-[10px] text-dc-muted p-1 truncate">{g.caption}</p> : null}
              <button
                type="button"
                className="absolute top-1 right-1 text-[10px] bg-black/60 text-dc-text px-1 rounded"
                onClick={() => void deleteGalleryImage(g.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            placeholder="Image URL (https://…)"
            value={newGalleryUrl}
            onChange={(e) => setNewGalleryUrl(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <input
            type="text"
            placeholder="Caption (optional)"
            value={newGalleryCaption}
            onChange={(e) => setNewGalleryCaption(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <button
            type="button"
            onClick={() => void addGalleryImage()}
            className="px-4 py-2 rounded-xl bg-dc-accent text-dc-text text-sm font-medium"
          >
            Add image
          </button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-dc-border">
        <h3 className="text-sm font-semibold text-dc-text mb-3">Offerings (classes / workshops)</h3>
        <ul className="space-y-3 mb-4">
          {offerings.map((o) => (
            <li key={o.id} className="rounded-lg border border-dc-border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-dc-text">{o.title}</p>
                  {o.tease && <p className="text-dc-muted text-xs mt-1 line-clamp-2">{o.tease}</p>}
                  <p className="text-[10px] text-dc-muted mt-1">
                    {o.isPublic ? 'Public listing' : 'Hidden from public (you + runners only)'} ·{' '}
                    {(o.runnerMaterials?.length ?? 0)} runner link(s)
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditOffering(o)}
                    className="text-xs text-dc-accent hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteOffering(o.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {editingOfferingId === o.id && (
                <div className="mt-3 pt-3 border-t border-dc-border space-y-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                  />
                  <textarea
                    value={editTease}
                    onChange={(e) => setEditTease(e.target.value)}
                    rows={2}
                    placeholder="Public teaser"
                    className="w-full px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                  />
                  <textarea
                    value={editOutline}
                    onChange={(e) => setEditOutline(e.target.value)}
                    rows={3}
                    placeholder="Description / outline (public)"
                    className="w-full px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="Minutes"
                      className="px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                    />
                    <input
                      value={editLevel}
                      onChange={(e) => setEditLevel(e.target.value)}
                      placeholder="Level"
                      className="px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                    />
                    <input
                      value={editFormat}
                      onChange={(e) => setEditFormat(e.target.value)}
                      placeholder="Format"
                      className="px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                    />
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags, comma"
                      className="px-2 py-1.5 rounded bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-dc-text-muted">
                    <input
                      type="checkbox"
                      checked={editPublic}
                      onChange={(e) => setEditPublic(e.target.checked)}
                    />
                    Show in public presenter profile (if hidden, only you and qualified org staff see it)
                  </label>
                  <MaterialRowsEditor items={editMaterials} onChange={setEditMaterials} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEditOffering()}
                      className="px-3 py-1.5 rounded-lg bg-dc-accent text-dc-text text-xs"
                    >
                      Save offering
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditOffering}
                      className="px-3 py-1.5 rounded-lg border border-dc-border text-dc-text-muted text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs font-medium text-dc-text-muted mb-2">Add new offering</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <textarea
            placeholder="Public teaser"
            value={newTease}
            onChange={(e) => setNewTease(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <textarea
            placeholder="Description / outline (public)"
            value={newOutline}
            onChange={(e) => setNewOutline(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="Minutes"
              className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
            <input
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value)}
              placeholder="Level"
              className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
            <input
              value={newFormat}
              onChange={(e) => setNewFormat(e.target.value)}
              placeholder="Format"
              className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags, comma"
              className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-dc-text-muted">
            <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} />
            Public listing
          </label>
          <MaterialRowsEditor items={newMaterials} onChange={setNewMaterials} />
          <button
            type="button"
            onClick={() => void addOffering()}
            className="px-4 py-2 rounded-xl bg-dc-accent text-dc-text text-sm font-medium"
          >
            Add offering
          </button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-dc-border space-y-4">
        <h3 className="text-sm font-semibold text-dc-text">Background & mentorship</h3>
        <textarea
          rows={4}
          value={backgroundStory}
          onChange={(e) => setBackgroundStory(e.target.value)}
          placeholder="Your path into teaching, community roles, off-platform history…"
          className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm text-dc-text"
        />
        <label className="flex items-center gap-2 text-sm text-dc-text-muted">
          <input type="checkbox" checked={mentorshipOffered} onChange={(e) => setMentorshipOffered(e.target.checked)} />
          I offer mentorship
        </label>
        {mentorshipOffered ?
          <textarea
            rows={2}
            value={mentorshipNotes}
            onChange={(e) => setMentorshipNotes(e.target.value)}
            placeholder="What mentorship looks like for you…"
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm text-dc-text"
          />
        : null}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Skill tenure</h4>
        <ul className="space-y-2">
          {skillClaims.map((c) => (
            <li key={c.id} className="text-xs flex justify-between gap-2 rounded-lg border border-dc-border p-2">
              <span>
                {c.skillLabel}
                {c.yearsActive != null ? ` · ${c.yearsActive} yr` : ''}
                {c.frequency ? ` · ${c.frequency}` : ''}
              </span>
              <button
                type="button"
                className="text-red-400"
                onClick={() =>
                  void fetch(`/api/v1/presenters/me/skill-claims/${c.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                  }).then(() => void load())
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={scLabel}
            onChange={(e) => setScLabel(e.target.value)}
            placeholder="Skill (e.g. Rope)"
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm"
          />
          <input
            type="number"
            min={0}
            max={80}
            value={scYears}
            onChange={(e) => setScYears(e.target.value)}
            placeholder="Years active"
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm"
          />
          <select
            value={scFrequency}
            onChange={(e) => setScFrequency(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm"
          >
            <option value="rarely">Rarely</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
            <option value="professional">Professional</option>
          </select>
          <input
            value={scNote}
            onChange={(e) => setScNote(e.target.value)}
            placeholder="Note (optional)"
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-sm"
          />
        </div>
        <button
          type="button"
          className="text-sm text-dc-accent hover:underline"
          onClick={() =>
            void fetch('/api/v1/presenters/me/skill-claims', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                skillLabel: scLabel.trim(),
                yearsActive: scYears ? Number(scYears) : null,
                frequency: scFrequency,
                note: scNote.trim() || null,
              }),
            }).then(() => {
              setScLabel('')
              setScYears('')
              setScNote('')
              void load()
            })
          }
        >
          + Add skill claim
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-dc-border">
        <h3 className="text-sm font-semibold text-dc-text mb-2">Teaching history</h3>
        <p className="text-xs text-dc-muted mb-3">
          Self-reported entries appear with a &quot;Self-reported&quot; label. After you teach on an official program
          slot and the session ends, an &quot;On program&quot; row is added automatically from organizer data. Those
          rows cannot be edited or removed here. Upcoming assignments still appear under Scheduled sessions on your
          public presenter page.
        </p>
        <ul className="space-y-2 mb-4">
          {credits.map((c) => (
            <li key={c.id} className="rounded-lg border border-dc-border p-2 text-xs flex justify-between gap-2">
              <div>
                <span className="text-dc-text font-medium">{c.title}</span>
                <span className="text-dc-muted"> · {c.eventName}</span>
                {c.eventDate ? <span className="text-dc-muted"> · {c.eventDate}</span> : null}
                {c.verified ?
                  <span className="ml-2 text-dc-accent" title="On program after session ended">
                    On program
                  </span>
                : <span className="ml-2 text-dc-muted">Self-reported</span>}
                {c.conventionSlug ?
                  <Link
                    to={`/conventions/${encodeURIComponent(c.conventionSlug)}?tab=Schedule`}
                    className="block text-dc-accent truncate max-w-xs mt-0.5"
                  >
                    Convention program
                  </Link>
                : c.detailUrl ?
                  <a href={c.detailUrl} className="block text-dc-accent truncate max-w-xs mt-0.5" target="_blank" rel="noreferrer">
                    Link
                  </a>
                : null}
              </div>
              {!c.scheduleSlotId && !c.verified ?
                <button
                  type="button"
                  className="text-red-400 shrink-0"
                  onClick={() => void deleteTeachingCredit(c.id)}
                >
                  Remove
                </button>
              : null}
            </li>
          ))}
        </ul>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            placeholder="Class / workshop title"
            value={tcTitle}
            onChange={(e) => setTcTitle(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <input
            placeholder="Event or venue name"
            value={tcEvent}
            onChange={(e) => setTcEvent(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <input
            type="date"
            value={tcDate}
            onChange={(e) => setTcDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <input
            type="url"
            placeholder="Detail URL (optional)"
            value={tcUrl}
            onChange={(e) => setTcUrl(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void addTeachingCredit()}
          className="mt-2 px-4 py-2 rounded-xl bg-dc-elevated-muted text-dc-text text-sm border border-dc-border"
        >
          Add teaching entry
        </button>
      </div>

      {msg && <p className="text-sm mt-4 text-dc-text-muted">{msg}</p>}
      {!presenter && (
        <p className="text-xs text-dc-muted mt-4">
          Saving creates your presenter profile if you don&apos;t have one yet.
        </p>
      )}
    </section>
  )
}
