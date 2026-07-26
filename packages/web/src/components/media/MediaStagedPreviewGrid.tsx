import type { MediaKind } from '@c2k/shared'

export type StagedMediaFile = {
  id: string
  file: File
  objectUrl: string
  mediaKind: MediaKind
  caption?: string
}

type Props = {
  items: StagedMediaFile[]
  onRemove: (id: string) => void
  onCaptionChange: (id: string, caption: string) => void
  disabled?: boolean
}

export default function MediaStagedPreviewGrid({ items, onRemove, onCaptionChange, disabled }: Props) {
  if (items.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className={`${cardClass} overflow-hidden`}>
          <div className="relative aspect-video bg-dc-elevated-solid">
            {item.mediaKind === 'video' ?
              <video src={item.objectUrl} className="h-full w-full object-contain" controls muted />
            : <img src={item.objectUrl} alt="" className="h-full w-full object-contain" />}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(item.id)}
              className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <div className="p-3">
            <input
              type="text"
              value={item.caption ?? ''}
              disabled={disabled}
              onChange={(e) => onCaptionChange(item.id, e.target.value)}
              placeholder="Caption for this file (optional)"
              className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
            />
            <p className="mt-1 truncate text-xs text-dc-muted">{item.file.name}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const cardClass = 'rounded-xl border border-dc-border/90 bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]'
