import { useMemo, useState } from 'react'
import { pickPrimaryProfilePhoto } from '@c2k/shared'
import ProfilePhotoManager from '@/components/profile/ProfilePhotoManager'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { IconCamera } from '@/components/profile/story/ProfileStoryIcons'
import { useProfilePhotos } from '@/hooks/useProfilePhotos'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Profile Studio → Photos: current profile picture + gallery management.
 */
export default function PhotosStudioPanel() {
  const { isAuthenticated } = useAuth()
  const {
    photos,
    loading,
    setPrimary,
    settingPrimaryId,
    reload,
  } = useProfilePhotos({ apiBacked: isAuthenticated })

  const [confirmPrimaryId, setConfirmPrimaryId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const primary = useMemo(() => pickPrimaryProfilePhoto(photos), [photos])
  const primaryUrl = primary ? mediaDisplayUrl(primary.url) : null

  async function confirmSetPrimary() {
    if (!confirmPrimaryId) return
    setBusy(true)
    try {
      const ok = await setPrimary(confirmPrimaryId)
      if (ok) setConfirmPrimaryId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <ProfileStudioSectionCard
        title="Profile picture"
        description="This is shown on your profile, posts, messages, and community listings."
        icon={<IconCamera />}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-dc-border-subtle bg-dc-surface-muted sm:h-48 sm:w-36">
            {loading ?
              <div className="h-full w-full animate-pulse bg-dc-elevated-muted" />
            : primaryUrl ?
              <ProfilePhotoImage
                src={primaryUrl}
                alt="Current profile picture"
                displaySettings={primary?.displaySettings}
                className="h-full w-full object-cover"
              />
            : (
              <div className="flex h-full w-full items-center justify-center text-xs text-dc-text-muted">
                No photo yet
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm leading-relaxed text-dc-text-muted">
              Choose an existing gallery photo below, or upload new ones. Uploads append to your gallery
              unless you opt in to make them your profile picture.
            </p>
          </div>
        </div>
      </ProfileStudioSectionCard>

      <ProfileStudioSectionCard
        title="Your photos"
        description="Manage your curated profile gallery. Set any eligible photo as your profile picture without re-uploading."
        icon={<IconCamera />}
      >
        <ProfilePhotoManager
          apiBacked={isAuthenticated}
          embedded
          autoOpenUploadWhenEmpty={false}
          onPhotosChanged={() => void reload()}
          studioMode
          onRequestSetPrimary={(id) => setConfirmPrimaryId(id)}
          settingPrimaryId={settingPrimaryId}
        />
      </ProfileStudioSectionCard>

      {confirmPrimaryId ?
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="set-primary-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-dc-border-subtle bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-panel)]">
            <h2 id="set-primary-title" className="text-lg font-semibold text-dc-text">
              Set as profile picture
            </h2>
            <p className="mt-2 text-sm text-dc-text-muted">
              This photo will appear on your profile, posts, and navigation. No re-upload needed.
            </p>
            {(() => {
              const candidate = photos.find((p) => p.id === confirmPrimaryId)
              const url = candidate ? mediaDisplayUrl(candidate.url) : null
              return url ?
                  <div className="mt-4 mx-auto h-48 w-36 overflow-hidden rounded-xl border border-dc-border-subtle">
                    <ProfilePhotoImage
                      src={url}
                      alt=""
                      displaySettings={candidate?.displaySettings}
                      className="h-full w-full object-cover"
                    />
                  </div>
                : null
            })()}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmPrimaryId(null)}
                className="min-h-10 rounded-lg border border-dc-border-subtle px-4 text-sm text-dc-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmSetPrimary()}
                className="min-h-10 rounded-lg bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
              >
                {busy ? 'Updating…' : 'Use this photo'}
              </button>
            </div>
          </div>
        </div>
      : null}
    </div>
  )
}
