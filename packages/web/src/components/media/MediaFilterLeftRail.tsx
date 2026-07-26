import TabButton from '@/components/ui/TabButton'
import type { MediaFormat } from '@/hooks/useApiMediaShows'
import { MEDIA_FORMAT_TABS, MEDIA_TOPIC_META, MEDIA_TOPIC_TAGS, type MediaTopicTag } from '@/lib/media-page-utils'

type Props = {
  format: MediaFormat | ''
  tag: string | null
  onFormatChange: (format: MediaFormat | '') => void
  onTagChange: (tag: string | null) => void
}

export default function MediaFilterLeftRail({ format, tag, onFormatChange, onTagChange }: Props) {
  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
      <h3 className="mb-3 text-sm font-semibold text-dc-text">Media filters</h3>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Format</p>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Media format">
        {MEDIA_FORMAT_TABS.map((tab) => (
          <TabButton
            key={tab.id || 'all'}
            label={tab.label}
            isActive={format === tab.id}
            onClick={() => onFormatChange(tab.id)}
          />
        ))}
      </nav>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Topics</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Media topics">
        <button
          type="button"
          onClick={() => onTagChange(null)}
          className={`min-h-9 rounded-full px-3 text-xs font-medium transition-colors ${
            tag === null ?
              'bg-dc-accent text-dc-accent-foreground'
            : 'border border-dc-border text-dc-text-muted hover:text-dc-text'
          }`}
        >
          All topics
        </button>
        {MEDIA_TOPIC_TAGS.map((topic) => {
          const meta = MEDIA_TOPIC_META[topic as MediaTopicTag]
          return (
            <button
              key={topic}
              type="button"
              onClick={() => onTagChange(tag === topic ? null : topic)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                tag === topic ?
                  'bg-dc-accent-muted text-dc-accent ring-1 ring-dc-accent-border/40'
                : 'border border-dc-border text-dc-text-muted hover:border-dc-accent-border/30 hover:text-dc-text'
              }`}
            >
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
