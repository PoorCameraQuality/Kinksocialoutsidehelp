import {
  ISO_APPROACH,
  ISO_MENU_TAGS,
  ISO_PLAY_INTENT,
  ISO_ROLE_TAGS,
  ISO_SEEKING_WHO,
  type IsoStructured,
} from '@c2k/shared'
import ScenePitchCard from './ScenePitchCard'

function labelOf(id: string, opts: readonly { id: string; label: string }[]) {
  return opts.find((o) => o.id === id)?.label ?? id
}

/** Compact live preview of the public ISO (not a phone mock). */
export default function IsoLivePreview({
  structured,
  body,
}: {
  structured: IsoStructured
  body: string
}) {
  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated p-5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">What others see</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {structured.roles.slice(0, 4).map((id) => (
          <span
            key={id}
            className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-[12px] text-dc-text-muted"
          >
            {labelOf(id, ISO_ROLE_TAGS)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[14px] text-dc-text-muted">{labelOf(structured.playIntent, ISO_PLAY_INTENT)}</p>

      <div className="mt-4">
        <p className="text-[12px] font-medium text-dc-muted">How to approach</p>
        <p className="mt-1 text-[14px] text-dc-text-muted">
          {structured.approach === 'visual_signal' && structured.visualSignal.trim()
            ? structured.visualSignal.trim()
            : labelOf(structured.approach, ISO_APPROACH)}
        </p>
      </div>

      {structured.seekingWho.length ?
        <div className="mt-4">
          <p className="text-[12px] font-medium text-dc-muted">Looking for</p>
          <p className="mt-1 text-[14px] text-dc-text-muted">
            {structured.seekingWho.map((id) => labelOf(id, ISO_SEEKING_WHO)).join(', ')}
          </p>
        </div>
      : null}

      {structured.pitches.length ?
        <div className="mt-4">
          <p className="text-[12px] font-medium text-dc-muted mb-1">Scene menu</p>
          {structured.pitches.slice(0, 3).map((p, i) => (
            <ScenePitchCard key={p.id} pitch={p} index={i} mode="public" />
          ))}
        </div>
      : structured.into.length ?
        <div className="mt-4">
          <p className="text-[12px] font-medium text-dc-muted">Open to</p>
          <p className="mt-1 text-[14px] text-dc-text-muted">
            {structured.into
              .slice(0, 5)
              .map((id) => labelOf(id, ISO_MENU_TAGS))
              .join(' · ')}
          </p>
        </div>
      : <p className="mt-4 text-[14px] text-dc-muted">Add a scene or a few interests to see your card.</p>}

      {body.trim() ?
        <div className="mt-4">
          <p className="text-[12px] font-medium text-dc-muted">In your words</p>
          <p className="mt-1 text-[14px] text-dc-text-muted line-clamp-3 whitespace-pre-wrap">{body}</p>
        </div>
      : null}
    </div>
  )
}
