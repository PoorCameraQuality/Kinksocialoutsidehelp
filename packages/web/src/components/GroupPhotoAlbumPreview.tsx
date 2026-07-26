import { Link } from 'react-router-dom'
import type { MockGroupPhoto } from '@/data/mock-data'

type GroupPhotoAlbumPreviewProps = {
  photos: MockGroupPhoto[]
  groupId: string
}

/** Compact photo grid for sidebar. Photos require approval before appearing. */
export default function GroupPhotoAlbumPreview({ photos, groupId }: GroupPhotoAlbumPreviewProps) {
  const previewCount = 6
  const displayPhotos = photos.slice(0, previewCount)

  return (
    <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dc-text">Photo Album</h3>
        <Link
          to={`/groups/${groupId}?tab=Photos`}
          className="text-xs text-dc-accent hover:underline"
        >
          View all
        </Link>
      </div>
      <p className="text-xs text-dc-muted mb-3">Members can upload; photos require approval.</p>
      {displayPhotos.length === 0 ? (
        <p className="text-sm text-dc-muted py-4 text-center">No approved photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {displayPhotos.map((p) => (
            <div
              key={p.id}
              className="aspect-square rounded-lg bg-dc-elevated-solid flex items-center justify-center overflow-hidden"
            >
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
                <svg className="w-6 h-6 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
