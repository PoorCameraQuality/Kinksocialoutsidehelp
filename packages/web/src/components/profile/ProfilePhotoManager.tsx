import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PhotoUpload from '@/components/PhotoUpload'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import MediaAttestationModal from '@/components/media/MediaAttestationModal'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { ProfilePhotoGridSkeleton } from '@/components/ui/skeleton'
import { MediaUploadProgressOverlay } from '@/components/media/MediaUploadProgress'
import { useProfilePhotos } from '@/hooks/useProfilePhotos'
import type { MockProfilePhoto } from '@/data/mock-data'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import {
  PROFILE_PHOTO_GUIDELINES,
  PROFILE_PHOTO_PENDING_REVIEW_DETAIL,
  PROFILE_PHOTO_PENDING_REVIEW_SHORT,
  PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE,
} from '@c2k/shared'
import PersonalPhotoQuotaNotice from '@/components/media/PersonalPhotoQuotaNotice'

type ProfilePhotoManagerProps = {
  apiBacked?: boolean
  basePhotos?: MockProfilePhoto[]
  onPhotosChanged?: () => void
  /** Open upload panel when gallery is empty (default true; desktop only). */
  autoOpenUploadWhenEmpty?: boolean
  /** Hide duplicate heading when nested under ProfileMediaTabPanel */
  embedded?: boolean
  /** Photos Studio mode: richer actions + upload intent checkbox. */
  studioMode?: boolean
  /** When set, "Set as profile picture" asks the parent to confirm. */
  onRequestSetPrimary?: (photoId: string) => void
  settingPrimaryId?: string | null
  /** When embedded on public Media tab, show a Studio link instead of full editing. */
  studioLinkOnly?: boolean
}

export default function ProfilePhotoManager({
  apiBacked = false,
  basePhotos = [],
  onPhotosChanged,
  autoOpenUploadWhenEmpty = true,
  embedded = false,
  studioMode = false,
  onRequestSetPrimary,
  settingPrimaryId: settingPrimaryIdProp,
  studioLinkOnly = false,
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
    addPhotoWithOptions,
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
    setPrimary,
    settingPrimaryId: settingPrimaryIdHook,
  } = useProfilePhotos({ basePhotos, apiBacked, onPhotosChanged })

  const settingPrimaryId = settingPrimaryIdProp ?? settingPrimaryIdHook
  const [makePrimaryOnUpload, setMakePrimaryOnUpload] = useState(false)

  useEffect(() => {
    if (embedded || studioMode || !autoOpenUploadWhenEmpty || loading || photos.length > 0) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(min-width: 640px)').matches) return
    setAddPhotoOpen(true)
  }, [embedded, studioMode, autoOpenUploadWhenEmpty, loading, photos.length, setAddPhotoOpen])

  if (studioLinkOnly) {
    return (
      <div className="rounded-xl border border-dc-border-subtle bg-dc-elevated-solid p-4">
        <p className="text-sm text-dc-text-muted">
          Manage your profile picture and gallery in Profile Studio.
        </p>
        <Link
          to="/profile/edit/photos"
          className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-dc-border-subtle px-3 text-sm font-medium text-dc-text hover:border-dc-accent"
        >
          Manage photos
        </Link>
      </div>
    )
  }

  const handleAddPhoto = async (result: Parameters<typeof addPhotoWithOptions>[0]) => {
    await addPhotoWithOptions(result, { makePrimary: makePrimaryOnUpload })
    setMakePrimaryOnUpload(false)
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

  const handleSetPrimary = (id: string) => {
    if (onRequestSetPrimary) {
      onRequestSetPrimary(id)
      return
    }
    void setPrimary(id)
  }

  const atPhotoLimit = Boolean(apiBacked && quota?.atLimit)

  return (
    <>
      <div
        className={
          embedded ?
            'min-w-0 space-y-4'
          : 'rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 shadow-[var(--dc-shadow-soft)] sm:p-6'
        }
      >
        {!embedded ?
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase text-dc-muted">Profile photos</h3>
              <p className="mt-1 text-sm text-dc-text-muted">
                Upload images, add captions, and choose your profile picture from the gallery.
              </p>
            </div>
            {!addPhotoOpen ?
              <button
                type="button"
                disabled={atPhotoLimit}
                title={atPhotoLimit ? PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE : undefined}
                onClick={() => setAddPhotoOpen(true)}
                className="shrink-0 rounded-lg border border-dc-border-subtle bg-dc-surface-muted px-3 py-1.5 text-sm font-medium text-dc-text hover:border-dc-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upload photos
              </button>
            : null}
          </div>
        : !addPhotoOpen ?
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-xs text-dc-text-muted">
              Profile picture = photo with the PROFILE PHOTO badge.
            </p>
            <button
              type="button"
              disabled={atPhotoLimit}
              title={atPhotoLimit ? PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE : undefined}
              onClick={() => setAddPhotoOpen(true)}
              className="shrink-0 rounded-lg border border-dc-border-subtle bg-dc-surface-muted px-3 py-1.5 text-xs font-medium text-dc-text hover:border-dc-accent disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              Upload photos
            </button>
          </div>
        : null}

        {apiBacked ? <PersonalPhotoQuotaNotice quota={quota} className="mb-3" /> : null}

        {error ? <LoadErrorBanner className="mb-4" message={error} onRetry={() => void reload()} /> : null}

        {addPhotoOpen ?
          <div
            className={
              embedded ?
                'mb-3 rounded-lg border border-dc-border/80 bg-dc-surface-muted/50 p-2'
              : 'mb-4 rounded-xl border border-dc-border bg-dc-surface-muted p-3 sm:mb-6 sm:p-4'
            }
          >
            <div className={`flex items-center justify-between gap-2 ${embedded ? 'mb-2' : 'mb-3'}`}>
              <p className={`font-medium text-dc-text ${embedded ? 'text-xs sm:text-sm' : 'text-sm'}`}>
                Upload photos
              </p>
              <button
                type="button"
                onClick={() => setAddPhotoOpen(false)}
                className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-dc-border px-2.5 text-xs font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                Close
              </button>
            </div>
            <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm text-dc-text-muted">
              <input
                type="checkbox"
                checked={makePrimaryOnUpload}
                onChange={(e) => setMakePrimaryOnUpload(e.target.checked)}
                className="mt-1"
              />
              <span>Make the first uploaded photo my profile picture</span>
            </label>
            <PhotoUpload
              compact={embedded}
              onSelect={handleAddPhoto}
              uploading={uploading}
              uploadStage={uploadStage}
              guidelines={[...PROFILE_PHOTO_GUIDELINES]}
            />
          </div>
        : null}

        {loading ?
          <ProfilePhotoGridSkeleton count={Math.max(photos.length, 4)} />
        : photos.length === 0 && !addPhotoOpen && !pendingUploadPreview ?
          <p className="py-8 text-center text-sm text-dc-text-muted">
            No photos yet. Use <span className="text-dc-text">Upload photos</span> to add your first image.
          </p>
        : photos.length > 0 || pendingUploadPreview ?
          <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 sm:gap-4 sm:pb-0 md:grid-cols-4">
            {pendingUploadPreview ?
              <div className="relative flex aspect-square flex-col overflow-hidden rounded-xl bg-dc-elevated-solid dc-panel-enter motion-reduce:animate-none">
                <img src={pendingUploadPreview.objectUrl} alt="" className="h-full w-full object-cover" />
                {uploadStage ? <MediaUploadProgressOverlay stage={uploadStage} /> : null}
                <div className="bg-dc-elevated-solid/50 p-2">
                  <p className="truncate text-xs text-dc-muted">
                    {pendingUploadPreview.caption ?? 'Adding…'}
                  </p>
                </div>
              </div>
            : null}
            {photos.map((photo) => {
              const displayUrl = mediaDisplayUrl(photo.url)
              const isPrimary = photo.order === 0
              const canPromote = !isPrimary && !photo.pendingReview && !photo.needsAttestation
              return (
                <div
                  key={photo.id}
                  className="group relative flex aspect-square flex-col overflow-hidden rounded-xl bg-dc-elevated-solid"
                >
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
                    {isPrimary ?
                      <span className="absolute left-2 top-2 z-20 rounded bg-dc-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent-foreground">
                        Profile photo
                      </span>
                    : null}
                    {photo.pendingReview ?
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-dc-surface-muted/90 p-3 text-center">
                        <p className="text-xs font-medium text-amber-100">
                          {PROFILE_PHOTO_PENDING_REVIEW_SHORT}
                        </p>
                        <p className="text-[10px] text-dc-muted">{PROFILE_PHOTO_PENDING_REVIEW_DETAIL}</p>
                      </div>
                    : null}
                    {displayUrl ?
                      <ProfilePhotoImage
                        src={displayUrl}
                        alt={photo.caption ?? 'Profile photo'}
                        displaySettings={photo.displaySettings}
                        className="h-full w-full object-cover"
                      />
                    : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                        <p className="text-[10px] text-dc-muted">Photo unavailable</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-dc-elevated-solid/50 p-2">
                    {editingId === photo.id ?
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
                    : (
                      <>
                        <p className="truncate text-xs text-dc-text-muted">
                          {isPrimary ?
                            'Current profile picture'
                          : photo.caption?.trim() ?
                            photo.caption
                          : 'Add a caption'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {canPromote ?
                            <button
                              type="button"
                              disabled={settingPrimaryId === photo.id}
                              onClick={() => handleSetPrimary(photo.id)}
                              className="inline-flex min-h-9 items-center text-xs font-medium text-dc-accent hover:underline disabled:opacity-60"
                            >
                              {settingPrimaryId === photo.id ? 'Setting…' : 'Set as profile picture'}
                            </button>
                          : null}
                          <button
                            type="button"
                            onClick={() => startEditCaption(photo.id)}
                            className="inline-flex min-h-9 items-center text-xs font-medium text-dc-text-muted hover:text-dc-text hover:underline"
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
                  {deleteConfirmId === photo.id ?
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
                  : null}
                </div>
              )
            })}
          </div>
        : null}
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
