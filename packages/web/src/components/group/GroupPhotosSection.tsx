import PhotoUpload from '@/components/PhotoUpload'
import TagLink from '@/components/TagLink'
import TagSelector from '@/components/ui/TagSelector'
import PhotoPlaceholder from '@/components/group/PhotoPlaceholder'
import Card from '@/components/ui/Card'
import { useGroupDetailContext } from '@/contexts/GroupDetailContext'
import { toggleArrayItem } from '@/lib/utils/toggleArrayItem'
import { TAG_SEEDS } from '@/data/mock-data'
import { useViewerUsername } from '@/contexts/AuthContext'
import type { MockGroupPhoto } from '@/data/mock-data'

interface GroupPhotosSectionProps {
  photos: MockGroupPhoto[]
  pendingPhotos: MockGroupPhoto[]
  myPendingPhotos: MockGroupPhoto[]
  uploadPhotoOpen: boolean
  setUploadPhotoOpen: (open: boolean) => void
  uploadTags: string[]
  setUploadTags: React.Dispatch<React.SetStateAction<string[]>>
  denyPhotoId: string | null
  setDenyPhotoId: (id: string | null) => void
  denyReason: string
  setDenyReason: (value: string) => void
  onPhotoUpload: (result: { objectUrl: string; caption: string }) => void
  onApprovePhoto: (id: string) => void
  onDenyPhoto: (id: string, reason?: string) => void
  onWithdrawPhoto: (id: string) => void
  onRemovePhoto: (id: string) => void
}

export default function GroupPhotosSection({
  photos,
  pendingPhotos,
  myPendingPhotos,
  uploadPhotoOpen,
  setUploadPhotoOpen,
  uploadTags,
  setUploadTags,
  denyPhotoId,
  setDenyPhotoId,
  denyReason,
  setDenyReason,
  onPhotoUpload,
  onApprovePhoto,
  onDenyPhoto,
  onWithdrawPhoto,
  onRemovePhoto,
}: GroupPhotosSectionProps) {
  const viewerUsername = useViewerUsername()
  const { isMember, canModerate } = useGroupDetailContext()
  const toggleTag = (tag: string) => setUploadTags((prev) => toggleArrayItem(prev, tag))

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dc-muted uppercase">Group Photos</h3>
        {isMember ? (
          <button
            type="button"
            onClick={() => setUploadPhotoOpen(true)}
            className="px-3 py-1.5 text-sm bg-dc-accent hover:bg-dc-accent-hover text-dc-accent-foreground rounded-lg font-medium"
          >
            Upload photo
          </button>
        ) : (
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-dc-accent/70 cursor-not-allowed"
            disabled
            title="Join the group to upload"
          >
            Upload photo
          </button>
        )}
      </div>
      <p className="text-xs text-dc-muted mb-4">
        Members can upload photos; all require approval before appearing.
      </p>

      {uploadPhotoOpen && isMember && (
        <div className="mb-6 p-4 bg-dc-surface-muted rounded-xl border border-dc-border">
          <h4 className="text-sm font-medium text-dc-text mb-3">Upload a photo</h4>
          <PhotoUpload
            onSelect={(result) => {
              if (!result.objectUrl) return
              onPhotoUpload({ objectUrl: result.objectUrl, caption: result.caption ?? '' })
              setUploadPhotoOpen(false)
              setUploadTags([])
            }}
          />
          <div className="mt-3">
            <label className="block text-xs font-medium text-dc-muted mb-2">Tags (optional)</label>
            <TagSelector
              tags={TAG_SEEDS}
              selectedTags={uploadTags}
              onToggle={toggleTag}
              size="small"
              ariaLabel="Photo tags"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setUploadPhotoOpen(false)
              setUploadTags([])
            }}
            className="mt-2 text-sm text-dc-muted hover:text-dc-text"
          >
            Cancel
          </button>
        </div>
      )}

      {isMember && !canModerate && myPendingPhotos.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-dc-accent mb-3">Your pending</h4>
          <div className="space-y-3">
            {myPendingPhotos.map((photo) => (
              <div
                key={photo.id}
                className="flex gap-4 p-3 bg-dc-surface-muted rounded-xl border border-dc-border items-center"
              >
                <div className="w-16 h-16 rounded-lg bg-dc-elevated-solid flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {photo.url ? (
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PhotoPlaceholder size="sm" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dc-text truncate">{photo.caption ?? 'Photo'}</p>
                  <p className="text-xs text-dc-muted">Submitted {photo.submittedAt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onWithdrawPhoto(photo.id)}
                  className="px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded"
                >
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canModerate && pendingPhotos.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-dc-accent mb-3">Pending approval</h4>
          <div className="space-y-3">
            {pendingPhotos.map((photo) => (
              <div
                key={photo.id}
                className="flex gap-4 p-3 bg-dc-surface-muted rounded-xl border border-dc-border items-start"
              >
                <div className="w-20 h-20 rounded-lg bg-dc-elevated-solid flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {photo.url ? (
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PhotoPlaceholder size="md" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dc-text truncate">{photo.caption ?? 'Photo'}</p>
                  <p className="text-xs text-dc-muted">
                    by {photo.authorUsername} · {photo.submittedAt}
                  </p>
                  {denyPhotoId === photo.id ? (
                    <div className="mt-2 flex gap-2 items-center">
                      <input
                        type="text"
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 px-2 py-1.5 bg-dc-elevated-solid border border-dc-border rounded text-sm text-dc-text placeholder-dc-muted"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onDenyPhoto(photo.id, denyReason || undefined)
                          setDenyPhotoId(null)
                          setDenyReason('')
                        }}
                        className="px-2 py-1.5 text-sm bg-dc-danger hover:bg-dc-danger/90 text-dc-text rounded"
                      >
                        Confirm deny
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDenyPhotoId(null)
                          setDenyReason('')
                        }}
                        className="px-2 py-1.5 text-sm text-dc-muted hover:text-dc-text"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onApprovePhoto(photo.id)}
                        className="px-2 py-1 text-sm bg-dc-success hover:bg-dc-success/90 text-dc-text rounded"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDenyPhotoId(photo.id)}
                        className="px-2 py-1 text-sm bg-dc-danger/90 hover:bg-dc-danger text-dc-text rounded"
                      >
                        Deny
                      </button>
                      {viewerUsername && photo.authorUsername === viewerUsername && (
                        <button
                          type="button"
                          onClick={() => onWithdrawPhoto(photo.id)}
                          className="px-2 py-1 text-sm text-amber-400 hover:text-amber-300 border border-amber-400/50 rounded"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h4 className="text-sm font-medium text-dc-muted uppercase mb-3">Approved photos</h4>
      {photos.length === 0 ? (
        <p className="text-dc-text-muted py-12 text-center">No approved photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-xl bg-dc-elevated-solid flex flex-col overflow-hidden group/item relative"
            >
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid overflow-hidden">
                {photo.url ? (
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PhotoPlaceholder size="lg" />
                )}
              </div>
              <div className="p-2 bg-dc-elevated-solid/50 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-dc-muted truncate">{photo.caption ?? 'Photo'}</p>
                    <p className="text-[10px] text-dc-muted">by {photo.authorUsername}</p>
                  </div>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(photo.id)}
                      className="flex-shrink-0 px-2 py-1 text-[10px] text-dc-danger hover:text-dc-danger/90 hover:bg-dc-danger/10 rounded"
                      title="Remove photo"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {photo.tags.map((tag) => (
                      <TagLink key={tag} tag={tag} className="text-[10px]" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
