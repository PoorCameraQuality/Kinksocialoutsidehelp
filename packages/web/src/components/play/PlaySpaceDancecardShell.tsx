import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from 'react'
import ConventionAttendeeHubShell from '@/components/conventions/ConventionAttendeeHubShell'
import PlaySpaceProgramAgenda from '@/components/play/program/PlaySpaceProgramAgenda'
import type { PlaySpaceListItem } from '@/hooks/useApiPlaySpaces'
import {
  addProgramToDancecard,
  createMap,
  deleteMap,
  fetchMaps,
  fetchProgram,
  removeProgramFromDancecard,
  uploadMapImage,
  type PlayMap,
  type ProgramSlot,
} from '@/hooks/usePlaySpaceDancecard'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

type Props = {
  space: PlaySpaceListItem
  slug: string
  isOwner: boolean
  onRefreshSpace?: () => void
}

/** Real Dancecard attendee hub on Play Spaces — Black Velvet, scoped tabs. */
export default function PlaySpaceDancecardShell({ space, slug, isOwner }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  const [program, setProgram] = useState<ProgramSlot[]>([])
  const [maps, setMaps] = useState<PlayMap[]>([])
  const [canEditProgram, setCanEditProgram] = useState(false)
  const [canEditMaps, setCanEditMaps] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [busySlotId, setBusySlotId] = useState<string | null>(null)
  const [addedHintShown, setAddedHintShown] = useState(false)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const loadMeta = useCallback(async () => {
    try {
      const [prog, mapRes] = await Promise.all([fetchProgram(slug), fetchMaps(slug)])
      setProgram(prog.items)
      setCanEditProgram(prog.canEdit)
      setMaps(mapRes.items)
      setCanEditMaps(mapRes.canEdit)
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load program/maps' })
    }
  }, [slug])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta, reloadKey])

  async function onAddToPlan(slotId: string) {
    setBusySlotId(slotId)
    try {
      await addProgramToDancecard(slug, slotId)
      setProgram((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, isOnMyDancecard: true } : s)),
      )
      if (!addedHintShown) {
        setAddedHintShown(true)
        setNotice({
          type: 'success',
          text: 'Added to your plan. Compare and shared availability will now treat this time as busy.',
        })
      } else {
        setNotice({ type: 'success', text: 'Added to your plan' })
      }
      setReloadKey((k) => k + 1)
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Could not add session' })
    } finally {
      setBusySlotId(null)
    }
  }

  async function onRemoveFromPlan(slotId: string) {
    setBusySlotId(slotId)
    try {
      await removeProgramFromDancecard(slug, slotId)
      setProgram((prev) =>
        prev.map((s) =>
          s.id === slotId ? { ...s, isOnMyDancecard: false, personalEntryId: null } : s,
        ),
      )
      setNotice({ type: 'success', text: 'Removed from your plan' })
      setReloadKey((k) => k + 1)
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Could not remove session' })
    } finally {
      setBusySlotId(null)
    }
  }

  async function onAddMap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const file = fd.get('file')
    if (!(file instanceof File) || file.size === 0) {
      setNotice({ type: 'error', text: 'Choose a map image to upload.' })
      return
    }
    setBusy(true)
    try {
      const uploaded = await uploadMapImage(slug, file)
      await createMap(slug, {
        label: String(fd.get('label') || 'Venue map').trim() || 'Venue map',
        imageUrl: uploaded.url,
      })
      form.reset()
      await loadMeta()
      setNotice({ type: 'success', text: 'Map uploaded.' })
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not add map' })
    } finally {
      setBusy(false)
    }
  }

  const ownerMap =
    isOwner && canEditMaps ?
      <details className="mt-6 rounded-xl border border-dc-border bg-dc-elevated/50 open:pb-0">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-dc-text [&::-webkit-details-marker]:hidden">
          <span>Edit map</span>
          <span className="text-xs font-normal text-dc-muted">Owner upload</span>
        </summary>
        <form onSubmit={onAddMap} className="space-y-2 border-t border-dc-border px-4 py-3">
          <p className="text-xs text-dc-muted">Recommended size: 800×600 (PNG or JPG).</p>
          <input
            name="label"
            placeholder="Label"
            defaultValue="Venue map"
            className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          />
          <label className="block text-xs text-dc-muted">
            Map image
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="mt-1 block w-full text-sm text-dc-text file:mr-3 file:rounded-lg file:border-0 file:bg-dc-accent/18 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-dc-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Uploading…' : 'Upload map'}
          </button>
          {maps.length > 0 ?
            <ul className="space-y-1 pt-2 text-xs text-dc-muted">
              {maps.map((m) => (
                <li key={m.id} className="flex min-h-11 items-center justify-between gap-2">
                  <span>{m.label}</span>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-red-300 hover:underline"
                    onClick={() =>
                      void deleteMap(slug, m.id)
                        .then(() => loadMeta())
                        .catch((err) =>
                          setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed' }),
                        )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          : null}
        </form>
      </details>
    : null

  const manageHref = `/play/${encodeURIComponent(slug)}/program/manage`

  return (
    <div
      className="dc-gold-chrome"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      data-dc-theme="event"
      style={themeStyle as CSSProperties}
    >
      <ConventionAttendeeHubShell
        slug={slug}
        timezone={space.timezone}
        reloadKey={reloadKey}
        slotsByDay={[]}
        onAddToDancecard={onAddToPlan}
        showGroups={false}
        showIso
        showMatchmaker
        isSpaceOwner={isOwner}
        apiKind="play-space"
        eventTitle={space.title}
        actionNotice={notice}
        onDismissActionNotice={() => setNotice(null)}
        onPlanMutated={() => setReloadKey((k) => k + 1)}
        ownerExtras={{ map: ownerMap }}
        programPanel={
          <PlaySpaceProgramAgenda
            sessions={program}
            timezone={space.timezone}
            canEdit={isOwner && canEditProgram}
            manageHref={manageHref}
            busySlotId={busySlotId}
            onAdd={onAddToPlan}
            onRemove={onRemoveFromPlan}
          />
        }
      />
      <p className="mt-8 text-center text-xs text-dc-muted">
        Dancecard, Playspaces, and Organizer tools Powered by{' '}
        <a href="https://kink.social" className="text-dc-accent hover:underline">
          Kink.Social
        </a>
      </p>
    </div>
  )
}
