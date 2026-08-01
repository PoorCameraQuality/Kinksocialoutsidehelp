import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import PlaySpaceProgramComposer from '@/components/play/program/PlaySpaceProgramComposer'
import { fetchPlaySpace, type PlaySpaceListItem } from '@/hooks/useApiPlaySpaces'
import {
  createProgramSlot,
  deleteProgramSlot,
  fetchProgram,
  type ProgramSlot,
} from '@/hooks/usePlaySpaceDancecard'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'
import {
  buildProgramDays,
  formatSessionTimeRange,
  humanTimezone,
} from '@/lib/play-space-program'

export default function PlaySpaceProgramManagePage() {
  const { slug = '' } = useParams()
  const [space, setSpace] = useState<PlaySpaceListItem | null>(null)
  const [items, setItems] = useState<ProgramSlot[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const load = useCallback(async () => {
    if (!slug) return
    setError(null)
    try {
      const [s, prog] = await Promise.all([fetchPlaySpace(slug), fetchProgram(slug)])
      setSpace(s)
      setItems(prog.items)
      setCanEdit(prog.canEdit)
      if (!prog.canEdit) setError('Only the Play Space owner can manage the program.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load program')
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(
    () => buildProgramDays(items, space?.timezone ?? 'UTC'),
    [items, space?.timezone],
  )

  async function onCreate(payload: {
    title: string
    startsAt: string
    endsAt: string
    location?: string
    description?: string
  }) {
    setBusy(true)
    try {
      await createProgramSlot(slug, payload)
      setComposerOpen(false)
      setNotice('Session added.')
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not add session')
    } finally {
      setBusy(false)
    }
  }

  if (!space && !error) {
    return <p className="p-6 text-sm text-dc-muted">Loading…</p>
  }

  return (
    <div
      className="dc-gold-chrome min-h-dvh text-dc-text"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      style={themeStyle as CSSProperties}
    >
      <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
        <header className="flex items-center justify-between gap-2">
          <Link to={`/play/${encodeURIComponent(slug)}`} className="min-h-11 text-sm font-medium text-dc-text-muted">
            ‹ Program
          </Link>
          <p className="text-sm font-semibold text-dc-text">Manage program</p>
          <span className="w-16" />
        </header>

        <div className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Official schedule</p>
          <h1 className="mt-1 text-[22px] font-semibold text-dc-text">{space?.title ?? 'Play Space'}</h1>
          <p className="mt-1 text-[13px] text-dc-muted">
            Times entered here use event time: {humanTimezone(space?.timezone ?? 'UTC')}
          </p>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {notice ? (
          <p className="mt-4 text-sm text-dc-muted" role="status">
            {notice}
          </p>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-5 min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
          >
            + Add session
          </button>
        ) : null}

        <div className="mt-6 space-y-6">
          {days.length === 0 ? (
            <p className="text-sm text-dc-muted">No sessions yet. Add the first one above.</p>
          ) : (
            days.map((day) => (
              <section key={day.dayKey}>
                <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">{day.label}</p>
                <ul className="mt-2 space-y-2">
                  {day.sessions.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3"
                    >
                      <p className="text-[13px] text-dc-muted">
                        {formatSessionTimeRange(s.startsAt, s.endsAt, space?.timezone ?? 'UTC')}
                      </p>
                      <p className="mt-0.5 text-[16px] font-semibold text-dc-text">{s.title}</p>
                      {s.location ? <p className="mt-0.5 text-[14px] text-dc-text-muted">{s.location}</p> : null}
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="min-h-10 text-sm font-medium text-[var(--dc-danger)]"
                          onClick={() => {
                            if (!window.confirm(`Delete “${s.title}”? This removes it from the official Program.`)) {
                              return
                            }
                            void deleteProgramSlot(slug, s.id)
                              .then(() => load())
                              .catch((e) => setNotice(e instanceof Error ? e.message : 'Delete failed'))
                          }}
                        >
                          Delete session
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-dc-muted">
                  {day.sessions.length} published session{day.sessions.length === 1 ? '' : 's'}
                </p>
              </section>
            ))
          )}
        </div>
      </div>

      {composerOpen ? (
        <PlaySpaceProgramComposer
          timezone={space?.timezone ?? 'UTC'}
          spaceStartsAt={space?.startsAt}
          spaceEndsAt={space?.endsAt}
          busy={busy}
          onCancel={() => setComposerOpen(false)}
          onSave={onCreate}
        />
      ) : null}
    </div>
  )
}
