import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import Button from '@/components/ui/Button'
import SectionHeader from '@/components/ui/SectionHeader'
import StatusBanner from '@/components/ui/StatusBanner'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import type { ApiMutedTag } from '@/hooks/useApiMutedTags'

type Props = {
  mutedTags: ApiMutedTag[]
  mutedTagsLoading: boolean
  mutedTagsError: string | null
  onUnmuteTag: (muteId: string) => void
  unmuteTagBusy: boolean
}

export default function SettingsMutedTagsPanel({
  mutedTags,
  mutedTagsLoading,
  mutedTagsError,
  onUnmuteTag,
  unmuteTagBusy,
}: Props) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Feed"
        title="Muted interest tags"
        description="Posts tagged with these interests are hidden from your Following and Near you feeds. Mute tags from a tag page when that menu is available."
      />
      {mutedTagsError ? <StatusBanner tone="error">{mutedTagsError}</StatusBanner> : null}
      {mutedTagsLoading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : mutedTags.length === 0 ?
        <p className="mt-4 text-sm text-dc-muted">You have not muted any interest tags.</p>
      : <ul className="mt-4 space-y-2">
          {mutedTags.map((mute) => {
            const label = mute.tag?.displayName ?? mute.tag?.slug ?? 'Unknown tag'
            const slug = mute.tag?.slug
            return (
              <li
                key={mute.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dc-border bg-dc-elevated/40 px-3 py-2"
              >
                <div className="min-w-0">
                  {slug ?
                    <Link to={`/tags/${encodeURIComponent(slug)}`} className="text-sm font-medium text-dc-text hover:text-dc-accent">
                      {label}
                    </Link>
                  : <span className="text-sm font-medium text-dc-text">{label}</span>}
                  {slug ? <p className="text-xs text-dc-muted">#{slug}</p> : null}
                </div>
                <Button type="button" variant="secondary" disabled={unmuteTagBusy} onClick={() => onUnmuteTag(mute.id)}>
                  Unmute
                </Button>
              </li>
            )
          })}
        </ul>
      }
    </Panel>
  )
}
