import { FormEvent, useEffect, useState } from 'react'
import { updatePlaySpace, type PlaySpaceListItem } from '@/hooks/useApiPlaySpaces'

type Props = {
  space: PlaySpaceListItem
  slug: string
  onSaved: (next: PlaySpaceListItem) => void
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent/40'

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Owner-only editor for play space title, description, place, window, visibility. */
export default function PlaySpaceOwnerDetailsForm({ space, slug, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState(space.title)
  const [description, setDescription] = useState(space.description ?? '')
  const [locationLabel, setLocationLabel] = useState(space.locationLabel ?? '')
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>(
    space.visibility === 'unlisted' || space.visibility === 'private' ? space.visibility : 'public',
  )
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(space.startsAt))
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(space.endsAt))

  useEffect(() => {
    if (open) return
    setTitle(space.title)
    setDescription(space.description ?? '')
    setLocationLabel(space.locationLabel ?? '')
    setVisibility(
      space.visibility === 'unlisted' || space.visibility === 'private' ? space.visibility : 'public',
    )
    setStartsAt(toDatetimeLocal(space.startsAt))
    setEndsAt(toDatetimeLocal(space.endsAt))
    setErr(null)
  }, [space, open])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const next = await updatePlaySpace(slug, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        locationLabel: locationLabel.trim() ? locationLabel.trim() : null,
        visibility,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      })
      onSaved(next)
      setOpen(false)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          open ?
            'inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated px-4 text-sm font-semibold text-dc-text hover:bg-dc-elevated-muted'
          : 'inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground shadow-[var(--dc-shadow-soft)] hover:bg-dc-accent-hover'
        }
      >
        {open ? 'Cancel editing' : 'Edit title & description'}
      </button>

      {open ?
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-3 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/80 p-3 sm:p-4"
        >
          <p className="text-xs text-dc-muted">
            This description shows on the Play Spaces directory card and at the top of your space.
          </p>
          <label className="block text-sm text-dc-text-muted">
            Title
            <input
              required
              minLength={2}
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-dc-text-muted">
            Description
            <textarea
              rows={4}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this gathering is, vibe, who it’s for…"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-dc-text-muted">
            Place / vibe
            <input
              maxLength={512}
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Barn loft, upstairs lounge…"
              className={fieldClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-dc-text-muted">
              Starts
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm text-dc-text-muted">
              Ends
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block text-sm text-dc-text-muted">
            Visibility
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className={fieldClass}
            >
              <option value="public">Public — listed so people can find &amp; join</option>
              <option value="unlisted">Unlisted — invite link / code</option>
              <option value="private">Private — invite code required</option>
            </select>
          </label>
          {err ? (
            <p className="text-sm text-dc-danger" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </form>
      : null}
    </div>
  )
}
