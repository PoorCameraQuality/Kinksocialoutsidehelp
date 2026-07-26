import type { MediaItemSummary } from '@c2k/shared'
import MediaCard from '@/components/media/MediaCard'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { ProfilePhotoGridSkeleton } from '@/components/ui/skeleton/C2kSkeleton'

type Props = {
  items: MediaItemSummary[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string | null
  blurItem?: (item: MediaItemSummary) => boolean
  emptyTitle?: string
  emptyMessage?: string
}

export default function MediaGrid({
  items,
  status,
  error,
  blurItem,
  emptyTitle = 'No media yet',
  emptyMessage = 'Nothing has been shared in this section.',
}: Props) {
  if (status === 'loading') {
    return <ProfilePhotoGridSkeleton count={8} />
  }

  if (status === 'error') {
    return <LoadErrorBanner message={error ?? 'Could not load media'} />
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} inline compact className="text-left" />
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} blurred={blurItem?.(item)} />
      ))}
    </div>
  )
}
