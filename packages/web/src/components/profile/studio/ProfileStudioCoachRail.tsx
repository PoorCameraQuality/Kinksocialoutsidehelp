import ProfileStudioLivePreview, { type ProfileStudioPreviewDraft } from './ProfileStudioLivePreview'
import type { MediaUploadStage } from '@/components/media/MediaUploadProgress'
import type { ProfileEditTabId } from '@/components/profile/edit/ProfileEditTabNav'
import type { PresenceSectionId } from '@/components/profile/edit/PresencePanel'

type Props = {
  section: ProfileEditTabId
  presenceSubsection?: PresenceSectionId
  draft: ProfileStudioPreviewDraft
  hasUnsavedChanges?: boolean
  photoUploadStage?: MediaUploadStage | null
}

export default function ProfileStudioCoachRail({
  section,
  presenceSubsection,
  draft,
  hasUnsavedChanges,
  photoUploadStage = null,
}: Props) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
      <ProfileStudioLivePreview
        section={section}
        presenceSubsection={presenceSubsection}
        draft={draft}
        hasUnsavedChanges={hasUnsavedChanges}
        photoUploadStage={photoUploadStage}
      />
    </div>
  )
}
