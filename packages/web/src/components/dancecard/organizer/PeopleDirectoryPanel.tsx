'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import {
  PERSON_PARAM,
  useOrganizerTabHref,
  useOrganizerWorkspacePath,
} from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'
import type { PeopleRoleBucket } from '@/lib/dancecard/peopleDirectoryRoleBuckets'
import { formatServiceHours, type PersonCompPackage } from '@/lib/dancecard/peopleCompPackages'
import { PersonDetailDrawer } from '@/components/dancecard/organizer/PersonDetailDrawer'
import { DancecardTableSkeleton } from '@/components/dancecard/organizer/ui'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type PersonRow = {
  id: string
  sceneName: string
  legalName: string | null
  email: string | null
  phone: string | null
  publicBio: string | null
  internalNotes: string | null
  pronouns: string | null
  photoUrl: string | null
  showLegalNameOnPublic: boolean
}

type RoleFilter = 'all' | PeopleRoleBucket

const ROLE_FILTERS: { key: RoleFilter; label: string; hint?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'presenter', label: 'Presenters' },
  { key: 'staff', label: 'Staff & volunteers' },
  { key: 'photographer', label: 'Photographers' },
  { key: 'attendee', label: 'Attendees' },
  { key: 'registered', label: 'Registered', hint: 'Signed up via registration' },
]

function filterPillClass(active: boolean, accent?: boolean) {
  if (!active) {
    return 'rounded-full border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:bg-dc-elevated-muted'
  }
  if (accent) {
    return 'rounded-full border border-emerald-400/40 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800'
  }
  return 'rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground'
}

export function PeopleDirectoryPanel({
  eventSlug,
  timezone,
  readOnly,
  embedded = false,
}: {
  eventSlug: string
  timezone: string
  readOnly: boolean
  embedded?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceBase = useOrganizerWorkspacePath(eventSlug)
  const signupsHref = useOrganizerTabHref('people', { peopleTab: 'signups' })
  const programHref = useOrganizerTabHref('program')
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [people, setPeople] = useState<PersonRow[]>([])
  const [roleBuckets, setRoleBuckets] = useState<Record<string, PeopleRoleBucket[]>>({})
  const [compPackages, setCompPackages] = useState<Record<string, PersonCompPackage>>({})
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sceneName, setSceneName] = useState('')
  const [email, setEmail] = useState('')
  const { ask, dialog } = useConfirmDialog()
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; sceneName: string } | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const syncPersonUrl = useCallback(
    (personId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (personId) params.set(PERSON_PARAM, personId)
      else params.delete(PERSON_PARAM)
      router.replace(`${workspaceBase}?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, workspaceBase],
  )

  const deepPersonId = searchParams.get(PERSON_PARAM)
  useEffect(() => {
    if (!deepPersonId || listLoading) return
    const hit = people.find((p) => p.id === deepPersonId)
    if (hit) setSelectedPerson({ id: hit.id, sceneName: hit.sceneName })
  }, [deepPersonId, people, listLoading])

  const load = useCallback(async () => {
    setLoadErr(null)
    setListLoading(true)
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      const res = await organizerDancecardFetch<{
        people: PersonRow[]
        roleBuckets?: Record<string, PeopleRoleBucket[]>
        compPackages?: Record<string, PersonCompPackage>
      }>(eventSlug, `/people${qs}`)
      setPeople(res.people ?? [])
      setRoleBuckets(res.roleBuckets ?? {})
      setCompPackages(res.compPackages ?? {})
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load people')
    } finally {
      setListLoading(false)
    }
  }, [eventSlug, q])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(t)
  }, [load])

  const filteredPeople = useMemo(() => {
    if (roleFilter === 'all') return people
    return people.filter((p) => (roleBuckets[p.id] ?? []).includes(roleFilter))
  }, [people, roleBuckets, roleFilter])

  const roleCounts = useMemo(() => {
    const counts: Partial<Record<RoleFilter, number>> = { all: people.length }
    for (const p of people) {
      for (const b of roleBuckets[p.id] ?? []) {
        counts[b] = (counts[b] ?? 0) + 1
      }
    }
    return counts
  }, [people, roleBuckets])

  async function addPerson() {
    if (readOnly || !sceneName.trim()) return
    setBusy(true)
    try {
      await organizerDancecardFetch(eventSlug, '/people', {
        method: 'POST',
        body: JSON.stringify({
          sceneName: sceneName.trim(),
          email: email.trim() || null,
        }),
      })
      setSceneName('')
      setEmail('')
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not add person')
    } finally {
      setBusy(false)
    }
  }

  async function removePerson(id: string) {
    if (readOnly) return
    if (
      !(await ask({
        title: 'Remove person?',
        message: 'Remove this person from the event directory?',
        destructive: true,
      }))
    )
      return
    setBusy(true)
    try {
      await organizerDancecardFetch(eventSlug, `/people/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {dialog}
      {!embedded ? (
        <p className="text-sm text-dc-muted">
          Roster shows presenters, staff, volunteers, attendees, and registered people synced from convention activity.
        </p>
      ) : null}
      {roleCounts.all !== undefined && roleCounts.all > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total people', value: roleCounts.all },
            { label: 'Presenters', value: roleCounts.presenter ?? 0 },
            { label: 'Staff & volunteers', value: roleCounts.staff ?? 0 },
            { label: 'Registered', value: roleCounts.registered ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
              <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{s.label}</p>
              <p className="mt-0.5 font-serif text-xl tabular-nums text-dc-text">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {readOnly ? (
        <p className="rounded-xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Read-only: browse the directory; add and remove require staff ops permission.
        </p>
      ) : null}
      {loadErr ? <p className="text-sm text-red-700">{loadErr}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          placeholder="Search by scene name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!readOnly ? (
          <button
            type="button"
            className="min-h-10 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            onClick={() => setAddOpen((v) => !v)}
          >
            Add person
          </button>
        ) : null}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-muted">Filter by role</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map(({ key, label, hint }) => {
            const active = roleFilter === key
            const count = roleCounts[key]
            const isRegistered = key === 'registered'
            return (
              <button
                key={key}
                type="button"
                title={hint}
                className={filterPillClass(active, isRegistered && active)}
                onClick={() => setRoleFilter(key)}
              >
                {label}
                {count !== undefined ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
        {roleFilter === 'registered' ? (
          <p className="mt-2 text-xs text-emerald-700/80">
            People linked to a registrant record (by profile or matching email). Import or sync registrants to populate
            this list.
          </p>
        ) : null}
        {roleFilter === 'attendee' ? (
          <p className="mt-2 text-xs text-dc-muted">
            Registered guests without a presenter, staff, or photographer assignment on the program or shift board.
          </p>
        ) : null}
      </div>
      {!readOnly && addOpen ? (
        <div className="grid gap-2 rounded-xl border border-dc-border bg-dc-elevated-muted p-4 sm:grid-cols-2">
          <label className="text-xs uppercase text-dc-muted">
            New scene name
            <input
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
            />
          </label>
          <label className="text-xs uppercase text-dc-muted">
            Email (optional)
            <input
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={busy || !sceneName.trim()}
              className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
              onClick={() => void addPerson().then(() => setAddOpen(false))}
            >
              Add person
            </button>
          </div>
        </div>
      ) : null}
      {listLoading ? (
        <DancecardTableSkeleton rows={8} cols={readOnly ? 7 : 8} />
      ) : (
      <div className="overflow-x-auto rounded-xl border border-dc-border dc-tab-content-enter">
        <table className="min-w-full text-left text-sm text-dc-text">
          <thead className="border-b border-dc-border bg-dc-surface-muted text-xs uppercase text-dc-muted">
            <tr>
              <th className="px-3 py-2">Scene</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Pronouns</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Comp type</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">Comp code</th>
              <th className="px-3 py-2">Service hours</th>
              {!readOnly ? <th className="px-3 py-2 w-24"> </th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-b border-dc-border/50 hover:bg-white/[0.03]"
                onClick={() => {
                  setSelectedPerson({ id: p.id, sceneName: p.sceneName })
                  syncPersonUrl(p.id)
                }}
              >
                <td className="px-3 py-2 font-medium text-dc-text">{p.sceneName}</td>
                <td className="px-3 py-2 text-dc-muted">{p.email ?? '-'}</td>
                <td className="px-3 py-2 text-dc-muted">{p.pronouns ?? '-'}</td>
                <td className="px-3 py-2 text-xs text-dc-muted">
                  {(roleBuckets[p.id] ?? []).length
                    ? (roleBuckets[p.id] ?? [])
                        .map((b) => ROLE_FILTERS.find((f) => f.key === b)?.label ?? b)
                        .join(', ')
                    : '-'}
                </td>
                <td className="px-3 py-2 text-dc-muted">
                  {compPackages[p.id]?.roleKindLabel ?? (
                    <span className="text-dc-muted" title="No linked signup or category">
                      -
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-dc-muted">
                  {compPackages[p.id]?.categoryName ?? (
                    <span className="text-dc-muted">-</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-dc-muted">
                  {compPackages[p.id]?.accessCode ?? (
                    <span className="font-sans text-dc-muted" title="No code on this package">
                      -
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-dc-muted">
                  {compPackages[p.id] ? (
                    formatServiceHours(compPackages[p.id].expectedHours)
                  ) : (
                    <span className="text-dc-muted">-</span>
                  )}
                </td>
                {!readOnly ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation()
                        void removePerson(p.id)
                      }}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {!filteredPeople.length ? (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="px-3 py-6 text-center text-dc-muted">
                  {people.length && roleFilter !== 'all'
                    ? 'No people match this filter.'
                    : 'No people in the roster yet.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      )}
      {!listLoading && !people.length ? (
        <PeopleEmptyState
          title="No people in the roster yet"
          actions={[
            ...(!readOnly ? [{ label: 'Add person', onClick: () => setAddOpen(true), primary: true }] : []),
            { label: 'Go to Signups', href: signupsHref },
            { label: 'Go to Program', href: programHref },
          ]}
        >
          People appear here as attendees register, staff shifts are assigned, presenters are added, or manual records
          are created.
        </PeopleEmptyState>
      ) : null}
      {selectedPerson ? (
        <PersonDetailDrawer
          eventSlug={eventSlug}
          timezone={timezone}
          personId={selectedPerson.id}
          initialSceneName={selectedPerson.sceneName}
          readOnly={readOnly}
          onClose={() => {
            setSelectedPerson(null)
            syncPersonUrl(null)
          }}
        />
      ) : null}
    </div>
  )
}
