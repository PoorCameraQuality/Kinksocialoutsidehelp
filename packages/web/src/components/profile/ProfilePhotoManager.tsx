import { useEffect } from 'react'
import PhotoUpload from '@/components/PhotoUpload'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import MediaAttestationModal from '@/components/media/MediaAttestationModal'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { ProfilePhotoGridSkeleton } from '@/components/ui/skeleton'
import { MediaUploadProgressOverlay } from '@/components/media/MediaUploadProgress'
import { useProfilePhotos } from '@/hooks/useProfilePhotos'
import type { MockProfilePhoto } from '@/data/mock-data'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { PROFILE_PHOTO_GUIDELINES, PROFILE_PHOTO_PENDING_REVIEW_DETAIL, PROFILE_PHOTO_PENDING_REVIEW_SHORT, PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE } from '@c2k/shared'
import PersonalPhotoQuotaNotice from '@/components/media/PersonalPhotoQuotaNotice'

type ProfilePhotoManagerProps = {
  apiBacked?: boolean
  basePhotos?: MockProfilePhoto[]
  onPhotosChanged?: () => void
  /** Open upload panel when gallery is empty (default true; desktop only). */
  autoOpenUploadWhenEmpty?: boolean
  /** Hide duplicate heading when nested under ProfileMediaTabPanel */
  embedded?: boolean
}

export default function ProfilePhotoManager({
  apiBacked = false,
  basePhotos = [],
  onPhotosChanged,
  autoOpenUploadWhenEmpty = true,
  embedded = false,
}: ProfilePhotoManagerProps) {
  const {
    photos,
    loading,
    uploading,
    uploadStage,
    pendingUploadPreview,
    error,
    quota,
    reload,
    addPhotoOpen,
    setAddPhotoOpen,
    addPhoto,
    editingId,
    editingCaption,
    setEditingCaption,
    startEditCaption,
    saveCaption,
    cancelEdit,
    deleteConfirmId,
    setDeleteConfirmId,
    deletePhoto,
    attestationTarget,
    setAttestationTarget,
    onAttestationCompleted,
  } = useProfilePhotos({ basePhotos, apiBacked, onPhotosChanged })

  useEffect(() => {
    if (embedded || !autoOpenUploadWhenEmpty || loading || photos.length > 0) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(min-width: 640px)').matches) return
    setAddPhotoOpen(true)
  }, [embedded, autoOpenUploadWhenEmpty, loading, photos.length, setAddPhotoOpen])

  const handleAddPhoto: typeof addPhoto = async (result) => {
    await addPhoto(result)
  }

  const handleSaveCaption = () => {
    void saveCaption()
  }

  const handleDelete = (id: string) => {
    void deletePhoto(id)
  }

  const handleAttestationDone = () => {
    onAttestationCompleted()
    onPhotosChanged?.()
  }

  const atPhotoLimit = Boolean(apiBacked && quota?.atLimit)

  return (
    <>
      <div className={embedded ? 'min-w-0 space-y-4' : 'rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 shadow-[var(--dc-shadow-soft)] sm:p-6'}>
        {!embedded ?
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase text-dc-muted">Profile photos</h3>
              <p className="mt-1 text-sm text-dc-text-muted">
                Upload images, add captions, and manage your gallery. Your primary photo is the first image.
              </p>
            </div>
            {!addPhotoOpen ? (
              <button
                type="button"
                disabled={atPhotoLimit}
                title={atPhotoLimit ? PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE : undefined}
                onClick={() => setAddPhotoOpen(true)}
                className="shrink-0 rounded-lg bg-dc-accent px-3 py-1.5 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add photo
              </button>
            ) : null}
          </div>
        : !addPhotoOpen ?
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-xs text-dc-text-muted">Primary photo is the first image in your gallery.</p>
            <button
              type="button"
              disabled={atPhotoLimit}
              title={atPhotoLimit ? PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE : undefined}
              onClick={() => setAddPhotoOpen(true)}
              className="shrink-0 rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              Add photo
            </button>
          </div>
        : null}

        {apiBacked ? <PersonalPhotoQuotaNotice quota={quota} className="mb-3" /> : null}

        {error ? <LoadErrorBanner className="mb-4" message={error} onRetry={() => void reload()} /> : null}

        {addPhotoOpen ? (
          <div
            className={
              embedded ?
                'mb-3 rounded-lg border border-dc-border/80 bg-dc-surface-muted/50 p-2'
              : 'mb-4 rounded-xl border border-dc-border bg-dc-surface-muted p-3 sm:mb-6 sm:p-4'
            }
          >
            <div className={`flex items-center justify-between gap-2 ${embedded ? 'mb-2' : 'mb-3'}`}>
              <p className={`font-medium text-dc-text ${embedded ? 'text-xs sm:text-sm' : 'text-sm'}`}>
                Upload a photo
              </p>
              <button
                type="button"
                onClick={() => setAddPhotoOpen(false)}
                className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-dc-border px-2.5 text-xs font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                Close
              </button>
            </div>
            <PhotoUpload
              compact={embedded}
              onSelect={handleAddPhoto}
              uploading={uploading}
              uploadStage={uploadStage}
              guidelines={[...PROFILE_PHOTO_GUIDELINES]}
            />
          </div>
        ) : null}

        {loading ?
          <ProfilePhotoGridSkeleton count={Math.max(photos.length, 4)} />
        : photos.length === 0 && !addPhotoOpen && !pendingUploadPreview ?
          <p className="py-8 text-center text-sm text-dc-text-muted">
            No photos yet. Use <span className="text-dc-text">Add photo</span> to upload your first image.
          </p>
        : photos.length > 0 || pendingUploadPreview ? (
          <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 sm:gap-4 sm:pb-0 md:grid-cols-4">
            {pendingUploadPreview ?
              <div className="relative flex aspect-square flex-col overflow-hidden rounded-xl bg-dc-elevated-solid dc-panel-enter motion-reduce:animate-none">
                <img
                  src={pendingUploadPreview.objectUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {uploadStage ?
                  <MediaUploadProgressOverlay stage={uploadStage} />
                : null}
                <div className="bg-dc-elevated-solid/50 p-2">
                  <p className="truncate text-xs text-dc-muted">
                    {pendingUploadPreview.caption ?? 'Adding…'}
                  </p>
                </div>
              </div>
            : null}
            {photos.map((photo) => {
              const displayUrl = mediaDisplayUrl(photo.url)
              return (
              <div
                key={photo.id}
                className="group relative flex aspect-square flex-col overflow-hidden rounded-xl bg-dc-elevated-solid"
              >
                <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
                  {photo.pendingReview ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-dc-surface-muted/90 p-3 text-center">
                      <p className="text-xs font-medium text-amber-100">{PROFILE_PHOTO_PENDING_REVIEW_SHORT}</p>
                      <p className="text-[10px] text-dc-muted">{PROFILE_PHOTO_PENDING_REVIEW_DETAIL}</p>
                    </div>
                  ) : null}
                  {displayUrl ?
                    <ProfilePhotoImage
                      src={displayUrl}
                      alt={photo.caption ?? 'Profile photo'}
                      displaySettings={photo.displaySettings}
                      className="h-full w-full object-cover"
                    />
                  : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                      <svg className="h-12 w-12 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-[10px] text-dc-muted">Photo unavailable</p>
                    </div>
                  )}
                </div>
                <div className="bg-dc-elevated-solid/50 p-2">
                  {editingId === photo.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
                      <input
                        type="text"
                        value={editingCaption}
                        onChange={(e) => setEditingCaption(e.target.value)}
                        placeholder="Write a caption…"
                        className="min-w-0 flex-1 rounded border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-xs text-dc-text"
                        autoFocus
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={handleSaveCaption}
                          className="inline-flex min-h-9 items-center text-xs font-medium text-dc-accent"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex min-h-9 items-center text-xs text-dc-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-xs text-dc-text-muted">
                        {photo.caption?.trim() ? photo.caption : 'Add a caption'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEditCaption(photo.id)}
                          className="inline-flex min-h-9 items-center text-xs font-medium text-dc-accent hover:underline"
                        >
                          {photo.caption ? 'Edit caption' : 'Add caption'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(photo.id)}
                          className="inline-flex min-h-9 items-center text-xs font-medium text-dc-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {deleteConfirmId === photo.id ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-dc-surface-muted/95 p-2">
                    <p className="text-center text-xs">Delete this photo?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(photo.id)}
                        className="rounded bg-dc-danger px-2 py-1 text-xs text-dc-text"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded bg-dc-elevated-solid px-2 py-1 text-xs text-dc-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <MediaAttestationModal
        open={attestationTarget}
        onClose={() => setAttestationTarget(null)}
        onSubmitted={handleAttestationDone}
        profilePhotoOnly
      />
    </>
  )
}
