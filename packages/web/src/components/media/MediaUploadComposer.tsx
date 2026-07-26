import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_VISIBILITIES,
  type DepictedPeople,
  type MediaCommentPolicy,
  type MediaContentRating,
  type MediaVisibility,
  type UploaderAttestationField,
} from '@c2k/shared'
import MediaAttestationChecklist, {
  buildUploadAttestation,
  DEFAULT_ATTESTATIONS,
} from '@/components/media/MediaAttestationChecklist'
import MediaDropzone from '@/components/media/MediaDropzone'
import MediaPrivacySelect from '@/components/media/MediaPrivacySelect'
import MediaStagedPreviewGrid, { type StagedMediaFile } from '@/components/media/MediaStagedPreviewGrid'
import MediaUploadMetadataForm, { parseTagsInput } from '@/components/media/MediaUploadMetadataForm'
import {
  MediaUploadProgressOverlay,
  MediaUploadSpinner,
  type MediaUploadStage,
} from '@/components/media/MediaUploadProgress'
import StatusBanner from '@/components/ui/StatusBanner'
import PersonalPhotoQuotaNotice from '@/components/media/PersonalPhotoQuotaNotice'
import { usePersonalPhotoQuota } from '@/hooks/usePersonalPhotoQuota'
import { useApiMediaUpload } from '@/hooks/useApiMedia'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { uploadMediaFile, isStagedUploadResult } from '@/lib/upload-media'
import { PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE } from '@c2k/shared'

type UploadTab = 'picture' | 'video'

function newStagedId() {
  return crypto.randomUUID()
}

export default function MediaUploadComposer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { upload, busy } = useApiMediaUpload()

  const initialTab = searchParams.get('tab') === 'video' ? 'video' : 'picture'
  const [tab, setTab] = useState<UploadTab>(initialTab)
  const { quota, reload: reloadQuota } = usePersonalPhotoQuota(tab === 'picture')

  useEffect(() => {
    setTab(searchParams.get('tab') === 'video' ? 'video' : 'picture')
  }, [searchParams])
  const [staged, setStaged] = useState<StagedMediaFile[]>([])
  const [caption, setCaption] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState<MediaVisibility>(MEDIA_VISIBILITIES.loggedIn)
  const [commentPolicy, setCommentPolicy] = useState<MediaCommentPolicy>('connections')
  const [postToFeed, setPostToFeed] = useState(true)
  const [useAsAvatar, setUseAsAvatar] = useState(false)
  const [pinnedToProfile, setPinnedToProfile] = useState(false)
  const [contentRating, setContentRating] = useState<MediaContentRating>(MEDIA_CONTENT_RATINGS.adultNonExplicit)
  const [depictedPeople, setDepictedPeople] = useState<DepictedPeople>(DEPICTED_PEOPLE.onlyMe)
  const [attestVisibility, setAttestVisibility] = useState<MediaVisibility>(MEDIA_VISIBILITIES.loggedIn)
  const [attestations, setAttestations] = useState(DEFAULT_ATTESTATIONS)
  const [uploadStage, setUploadStage] = useState<MediaUploadStage | null>(null)
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const mediaKind = tab === 'picture' ? 'image' : 'video'
  const accept = tab === 'picture' ? 'image/*' : 'video/*'
  const uploadPurpose = tab === 'picture' ? 'profile_media' : 'feed_video'
  const showAvatarOption = tab === 'picture' && staged.length <= 1

  const addFiles = useCallback(
    (files: File[]) => {
      const next = files.map((file) => ({
        id: newStagedId(),
        file,
        objectUrl: URL.createObjectURL(file),
        mediaKind: mediaKind as StagedMediaFile['mediaKind'],
      }))
      setStaged((prev) => {
        const maxItems = tab === 'picture' ? Math.min(10, quota?.remaining ?? 10) : 1
        const merged = tab === 'picture' ? [...prev, ...next] : next.slice(0, 1)
        return merged.slice(0, maxItems)
      })
      setBanner(null)
    },
    [mediaKind, quota?.remaining, tab],
  )

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.objectUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  const updateCaption = (id: string, value: string) => {
    setStaged((prev) => prev.map((item) => (item.id === id ? { ...item, caption: value } : item)))
  }

  const setAttestation = (field: UploaderAttestationField, checked: boolean) => {
    setAttestations((prev) => ({ ...prev, [field]: checked }))
  }

  const handleSubmit = async () => {
    setBanner(null)
    if (staged.length === 0) {
      setBanner({ tone: 'error', text: 'Add at least one file to upload.' })
      return
    }
    if (tab === 'picture' && quota?.atLimit) {
      setBanner({ tone: 'error', text: PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE })
      return
    }
    if (tab === 'picture' && quota && staged.length > quota.remaining) {
      setBanner({
        tone: 'error',
        text: `You can only add ${quota.remaining} more photo${quota.remaining === 1 ? '' : 's'}.`,
      })
      return
    }
    const attestation = buildUploadAttestation(contentRating, depictedPeople, attestVisibility, attestations)
    if (!attestation) {
      setBanner({ tone: 'error', text: 'Complete all attestation confirmations.' })
      return
    }

    try {
      setUploadStage('uploading')
      const uploadedItems = []
      for (const item of staged) {
        const result = await uploadMediaFile(item.file, uploadPurpose)
        if (!isStagedUploadResult(result.status) || !result.quarantineKey) {
          throw new Error('Upload did not return a staged file key.')
        }
        uploadedItems.push({
          quarantineKey: result.quarantineKey,
          mediaKind: item.mediaKind,
          originalFilename: item.file.name,
          mimeType: result.mimeType ?? item.file.type,
          sizeBytes: result.sizeBytes ?? item.file.size,
          imageWidth: result.width,
          imageHeight: result.height,
          caption: item.caption?.trim() || undefined,
        })
      }

      setUploadStage('processing')
      const data = await upload({
        caption: caption.trim() || undefined,
        items: uploadedItems,
        visibility,
        commentPolicy,
        postToFeed,
        useAsAvatar: showAvatarOption && useAsAvatar ? true : undefined,
        pinnedToProfile,
        tags: parseTagsInput(tagsInput),
        attestation,
      })

      const firstId = data.mediaItemIds?.[0] ?? data.items?.[0]?.id
      setBanner({ tone: 'success', text: 'Upload published.' })
      void reloadQuota()
      staged.forEach((item) => URL.revokeObjectURL(item.objectUrl))
      setStaged([])
      if (firstId) {
        navigate(`/media/item/${firstId}`)
      }
    } catch (err) {
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploadStage(null)
    }
  }

  const disabled = busy || Boolean(uploadStage) || (tab === 'picture' && Boolean(quota?.atLimit))

  return (
    <div className={`${cardSurfaceSolidClass} p-5 sm:p-6`} data-testid="media-upload-composer">
      {tab === 'picture' ? <PersonalPhotoQuotaNotice quota={quota} className="mb-4" /> : null}
      <div className="flex flex-wrap gap-2 border-b border-dc-border/70 pb-4">
        {(
          [
            ['picture', 'Upload picture'],
            ['video', 'Upload video'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            data-testid={`media-upload-tab-${key}`}
            onClick={() => {
              setTab(key)
              staged.forEach((item) => URL.revokeObjectURL(item.objectUrl))
              setStaged([])
              setUseAsAvatar(false)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-dc-accent text-dc-accent-foreground' : 'bg-dc-elevated-muted text-dc-text-muted hover:text-dc-text'
            }`}
          >
            {label}
          </button>
        ))}
        <Link
          to="/education/write"
          className="rounded-lg px-3 py-2 text-sm font-medium text-dc-accent hover:bg-dc-accent/10"
        >
          Write instead
        </Link>
      </div>

      {banner ?
        <StatusBanner tone={banner.tone} className="mt-4">
          {banner.text}
        </StatusBanner>
      : null}

      <div className="relative mt-5 space-y-5">
        {uploadStage ?
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-dc-surface/70">
            <MediaUploadProgressOverlay stage={uploadStage} />
          </div>
        : null}

        <MediaDropzone
          accept={accept}
          multiple={tab === 'picture'}
          disabled={disabled}
          label={tab === 'picture' ? 'Add pictures' : 'Add a video'}
          hint={tab === 'picture' ? 'Up to 10 images per upload batch.' : 'One video per upload.'}
          onFiles={addFiles}
        />

        <MediaStagedPreviewGrid
          items={staged}
          disabled={disabled}
          onRemove={removeStaged}
          onCaptionChange={updateCaption}
        />

        <MediaUploadMetadataForm
          caption={caption}
          tags={tagsInput}
          postToFeed={postToFeed}
          useAsAvatar={useAsAvatar}
          pinnedToProfile={pinnedToProfile}
          showAvatarOption={showAvatarOption}
          disabled={disabled}
          onCaptionChange={setCaption}
          onTagsChange={setTagsInput}
          onPostToFeedChange={setPostToFeed}
          onUseAsAvatarChange={setUseAsAvatar}
          onPinnedToProfileChange={setPinnedToProfile}
        />

        <MediaPrivacySelect
          visibility={visibility}
          commentPolicy={commentPolicy}
          disabled={disabled}
          onVisibilityChange={setVisibility}
          onCommentPolicyChange={setCommentPolicy}
        />

        <MediaAttestationChecklist
          contentRating={contentRating}
          depictedPeople={depictedPeople}
          visibility={attestVisibility}
          attestations={attestations}
          disabled={disabled}
          onContentRatingChange={setContentRating}
          onDepictedPeopleChange={setDepictedPeople}
          onVisibilityChange={setAttestVisibility}
          onAttestationChange={setAttestation}
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={disabled || staged.length === 0}
            data-testid="media-upload-publish"
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground disabled:opacity-50"
          >
            {disabled ?
              <>
                <MediaUploadSpinner size="sm" />
                {uploadStage === 'uploading' ? 'Uploading…' : 'Scanning…'}
              </>
            : 'Publish upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
