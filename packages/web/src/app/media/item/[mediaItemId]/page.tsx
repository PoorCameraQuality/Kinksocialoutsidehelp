import { useParams } from 'react-router-dom'
import MediaDetailPageClient from '@/components/media/MediaDetailPageClient'

export default function MediaItemDetailPage() {
  const { mediaItemId } = useParams<{ mediaItemId: string }>()
  if (!mediaItemId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-dc-muted">Invalid media link.</div>
    )
  }
  return <MediaDetailPageClient mediaItemId={mediaItemId} />
}
