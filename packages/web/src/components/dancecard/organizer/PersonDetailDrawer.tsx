'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { Button } from '@/components/dancecard/ui/Button'

type PersonDetail = {
  id: string
  sceneName: string
  email: string | null
  pronouns: string | null
  publicBio: string | null
  photoUrl: string | null
}

type ProgramSlotRow = {
  id: string
  title: string
  startsAt: string | null
  endsAt: string | null
  role: string
  locationName: string | null
  trackDisplay: string | null
}

type LinkedRegistrant = {
  id: string
  sceneDisplayName: string
  status: string
  categoryId?: string
  categoryName: string | null
}

type CategoryOption = { id: string; name: string }

type TabKey = 'overview' | 'sessions' | 'registration'

function roleLabel(role: string) {
  return role.replace(/_/g, ' ')
}

export function PersonDetailDrawer({
  eventSlug,
  timezone,
  personId,
  initialSceneName,
  onClose,
  readOnly,
}: {
  eventSlug: string
  timezone: string
  personId: string
  initialSceneName: string
  onClose: () => void
  readOnly: boolean
}) {
  const signupsHref = useOrganizerTabHref('people', { peopleTab: 'signups' })
  const [tab, setTab] = useState<TabKey>('overview')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [sceneName, setSceneName] = useState(initialSceneName)
  const [email, setEmail] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [publicBio, setPublicBio] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [programSlots, setProgramSlots] = useState<ProgramSlotRow[]>([])
  const [registrant, setRegistrant] = useState<LinkedRegistrant | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    void organizerDancecardFetch<{ categories: CategoryOption[] }>(eventSlug, '/registration-categories')
      .then((r) => setCategories(r.categories ?? []))
      .catch(() => undefined)
  }, [eventSlug])

  async function changeRegistrantCategory(categoryId: string) {
    if (!registrant) return
    setSavingCategory(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/registrants/${registrant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update category')
    } finally {
      setSavingCategory(false)
    }
  }

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const res = await organizerDancecardFetch<{
        person: PersonDetail
        programSlots: ProgramSlotRow[]
        registrant: LinkedRegistrant | null
      }>(eventSlug, `/people/${personId}`)
      const p = res.person
      setSceneName(p.sceneName)
      setEmail(p.email ?? '')
      setPronouns(p.pronouns ?? '')
      setPublicBio(p.publicBio ?? '')
      setPhotoUrl(p.photoUrl ?? '')
      setProgramSlots(res.programSlots ?? [])
      setRegistrant(res.registrant ?? null)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load person')
    }
  }, [eventSlug, personId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveOverview() {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/people/${personId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sceneName: sceneName.trim(),
          email: email.trim() || '',
          pronouns: pronouns.trim() || null,
          publicBio: publicBio.trim() || null,
          photoUrl: photoUrl.trim() || null,
        }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'registration', label: 'Registration' },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex justify-end pt-[5.5rem] pr-3 pb-3 pl-3 sm:pr-6 sm:pb-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Close person panel"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-full w-full max-w-[min(32rem,calc(100vw-1.5rem))] flex-col rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="dc-person-drawer-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-dc-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-dc-muted">Person profile</p>
            <h2 id="dc-person-drawer-title" className="truncate font-serif text-lg text-dc-text">
              {sceneName || initialSceneName}
            </h2>
            <p className="mt-1 text-xs leading-snug text-dc-muted">
              Edit this person&apos;s organizer-side details, see what they&apos;re scheduled to do, and review or change
              their registration.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted hover:bg-white/5"
            onClick={onClose}
            aria-label="Close person panel"
          >
            Close
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-dc-border px-2 py-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? 'shrink-0 rounded-full bg-dc-accent-muted px-3 py-1.5 text-xs font-medium text-dc-accent-foreground ring-1 ring-dc-accent-border'
                  : 'shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs text-dc-muted hover:bg-white/5'
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-dc-text">
          {loadErr ? <p className="text-sm text-dc-danger">{loadErr}</p> : null}
          {err ? <p className="text-sm text-dc-danger">{err}</p> : null}

          {tab === 'overview' ? (
            <div className="space-y-4">
              <p className="text-xs text-dc-muted">
                The roster profile attendees and presenters see. Scene name and public bio appear on the program; email
                is used for organizer-only outreach.
              </p>
              {photoUrl.trim() ? (
                <div className="overflow-hidden rounded-xl border border-dc-border bg-dc-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl.trim()} alt="" className="max-h-40 w-full object-cover" />
                </div>
              ) : null}
              <label className="block text-xs uppercase text-dc-muted">
                Scene name
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={sceneName}
                  onChange={(e) => setSceneName(e.target.value)}
                  disabled={readOnly}
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Email
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={readOnly}
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Pronouns
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  disabled={readOnly}
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Photo URL
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  disabled={readOnly}
                  placeholder="https://..."
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Public bio
                <textarea
                  className="mt-1 min-h-[8rem] w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={publicBio}
                  onChange={(e) => setPublicBio(e.target.value)}
                  disabled={readOnly}
                />
              </label>
              {!readOnly ? (
                <Button type="button" disabled={busy || !sceneName.trim()} onClick={() => void saveOverview()}>
                  {busy ? 'Saving…' : 'Save profile'}
                </Button>
              ) : null}
            </div>
          ) : null}

          {tab === 'sessions' ? (
            <div className="space-y-3">
              <p className="text-xs text-dc-muted">
                Program sessions this person is attached to (as presenter, host, staff, etc). Edit the slot in Program
                to change role or schedule.
              </p>
              {programSlots.length ? (
                <ul className="space-y-2">
                  {programSlots.map((s) => (
                    <li key={s.id} className="rounded-lg border border-dc-border bg-dc-surface-muted/50 px-3 py-2">
                      <p className="font-medium text-dc-text">{s.title}</p>
                      <p className="mt-1 text-xs text-dc-muted">
                        {s.startsAt && s.endsAt
                          ? `${formatInTimeZone(new Date(s.startsAt), timezone, 'EEE MMM d · h:mm a')} – ${formatInTimeZone(new Date(s.endsAt), timezone, 'h:mm a')}`
                          : 'Unscheduled'}
                        {s.role ? ` · ${roleLabel(s.role)}` : ''}
                      </p>
                      {s.locationName || s.trackDisplay ? (
                        <p className="mt-1 text-xs text-dc-muted">
                          {[s.locationName, s.trackDisplay].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-dc-muted">Not linked to any program sessions yet.</p>
              )}
            </div>
          ) : null}

          {tab === 'registration' ? (
            <div className="space-y-3">
              <p className="text-xs text-dc-muted">
                Their signup record for this convention (ticket category, status). Use this to bump someone between
                Attendee, Presenter comp, Staff comp, etc.
              </p>
              {registrant ? (
                <>
                  <p className="text-dc-muted">
                    Linked signup:{' '}
                    <span className="font-medium text-dc-text">{registrant.sceneDisplayName}</span>
                  </p>
                  <p className="text-xs text-dc-muted">
                    Status: {registrant.status}
                    {registrant.categoryName ? ` · ${registrant.categoryName}` : ''}
                  </p>
                  {!readOnly && categories.length ? (
                    <label className="block text-xs font-medium uppercase tracking-wide text-dc-muted">
                      Change category
                      <select
                        className="mt-1 w-full rounded border border-dc-border bg-dc-surface px-2 py-1 text-sm text-dc-text disabled:opacity-50"
                        disabled={savingCategory}
                        value={registrant.categoryId ?? ''}
                        onChange={(e) => void changeRegistrantCategory(e.target.value)}
                      >
                        <option value="">Select one</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <Link href={signupsHref} className="text-sm font-semibold text-dc-accent hover:underline">
                    Open signups →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-dc-muted">
                    No signup record linked to this person yet. Match by email in signups or link from a registrant
                    profile.
                  </p>
                  <Link href={signupsHref} className="text-sm font-semibold text-dc-accent hover:underline">
                    Browse signups →
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
