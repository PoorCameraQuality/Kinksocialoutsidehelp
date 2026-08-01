import {
  ISO_MENU_TAGS,
  ISO_PITCH_INTENSITY,
  ISO_PITCH_ROLE,
  ISO_PITCH_SEX,
  type IsoScenePitch,
} from '@c2k/shared'

function labelOf(id: string, opts: readonly { id: string; label: string }[]) {
  return opts.find((o) => o.id === id)?.label ?? id
}

export default function ScenePitchCard({
  pitch,
  index,
  mode = 'public',
  onEdit,
  onRemove,
}: {
  pitch: IsoScenePitch
  index: number
  mode?: 'public' | 'editor'
  onEdit?: () => void
  onRemove?: () => void
}) {
  const meta = [
    labelOf(pitch.intensity, ISO_PITCH_INTENSITY),
    labelOf(pitch.myRole, ISO_PITCH_ROLE),
    labelOf(pitch.sex, ISO_PITCH_SEX),
  ].join(' · ')
  const tags = pitch.tags
    .slice(0, 3)
    .map((id) => labelOf(id, ISO_MENU_TAGS))
    .join(' · ')

  const body = (
    <>
      <p className="text-[12px] tabular-nums text-dc-muted">{String(index + 1).padStart(2, '0')}</p>
      <p className="mt-0.5 text-[18px] font-semibold leading-snug text-dc-text">
        {pitch.title.trim() || 'Untitled scene'}
      </p>
      {pitch.description.trim() ?
        <p
          className={`mt-1 text-[15px] leading-relaxed text-dc-text-muted ${
            mode === 'editor' ? 'line-clamp-1' : 'line-clamp-4'
          }`}
        >
          {pitch.description}
        </p>
      : null}
      <p className="mt-2 text-[13px] text-dc-muted">{meta}</p>
      {tags && mode === 'public' ? <p className="mt-1 text-[13px] text-dc-muted">{tags}</p> : null}
    </>
  )

  if (mode === 'editor') {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated p-4">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
            {body}
          </button>
          <div className="relative shrink-0">
            <details className="group">
              <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl text-dc-muted marker:content-none [&::-webkit-details-marker]:hidden hover:bg-dc-elevated-muted">
                ⋮
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-36 rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-soft)]">
                <button
                  type="button"
                  onClick={onEdit}
                  className="block w-full px-3 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="block w-full px-3 py-2 text-left text-sm text-[var(--dc-danger)] hover:bg-dc-elevated-muted"
                >
                  Remove
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    )
  }

  return <div className="border-b border-dc-border py-4 last:border-b-0 last:pb-0 first:pt-0">{body}</div>
}
