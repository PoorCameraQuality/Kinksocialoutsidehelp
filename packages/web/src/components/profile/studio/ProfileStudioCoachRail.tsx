import ProfileStudioLivePreview, { type ProfileStudioPreviewDraft } from './ProfileStudioLivePreview'
import ProfileStudioVisitorReadout from './ProfileStudioVisitorReadout'
import type { MediaUploadStage } from '@/components/media/MediaUploadProgress'

type Props = {
  draft: ProfileStudioPreviewDraft
  publicProfileHref: string | null
  hasUnsavedChanges?: boolean
  photoUploadStage?: MediaUploadStage | null
  visitorReadout: string
}

export default function ProfileStudioCoachRail({
  draft,
  publicProfileHref,
  hasUnsavedChanges,
  photoUploadStage = null,
  visitorReadout,
}: Props) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
      <ProfileStudioLivePreview
        draft={draft}
        publicProfileHref={publicProfileHref}
        hasUnsavedChanges={hasUnsavedChanges}
        photoUploadStage={photoUploadStage}
      />
      <ProfileStudioVisitorReadout readout={visitorReadout} />
    </div>
  )
}
