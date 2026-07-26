import { MAX_MEDIA_ITEM_TAGS } from '@c2k/shared'
import { settingsCheckboxClass } from '@/lib/settingsFormClasses'

type Props = {
  caption: string
  tags: string
  postToFeed: boolean
  useAsAvatar: boolean
  pinnedToProfile: boolean
  showAvatarOption: boolean
  onCaptionChange: (value: string) => void
  onTagsChange: (value: string) => void
  onPostToFeedChange: (value: boolean) => void
  onUseAsAvatarChange: (value: boolean) => void
  onPinnedToProfileChange: (value: boolean) => void
  disabled?: boolean
}

export default function MediaUploadMetadataForm({
  caption,
  tags,
  postToFeed,
  useAsAvatar,
  pinnedToProfile,
  showAvatarOption,
  onCaptionChange,
  onTagsChange,
  onPostToFeedChange,
  onUseAsAvatarChange,
  onPinnedToProfileChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="media-upload-caption" className="mb-1 block text-sm font-medium text-dc-text-muted">
          Caption
        </label>
        <textarea
          id="media-upload-caption"
          rows={3}
          value={caption}
          disabled={disabled}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Describe your upload (optional)"
          className="w-full resize-none rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
        />
      </div>

      <div>
        <label htmlFor="media-upload-tags" className="mb-1 block text-sm font-medium text-dc-text-muted">
          Tags
        </label>
        <input
          id="media-upload-tags"
          type="text"
          value={tags}
          disabled={disabled}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder={`Comma-separated, up to ${MAX_MEDIA_ITEM_TAGS}`}
          className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className={settingsCheckboxClass}
            checked={postToFeed}
            disabled={disabled}
            onChange={(e) => onPostToFeedChange(e.target.checked)}
          />
          <span className="text-sm text-dc-text-muted">Post to my feed</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className={settingsCheckboxClass}
            checked={pinnedToProfile}
            disabled={disabled}
            onChange={(e) => onPinnedToProfileChange(e.target.checked)}
          />
          <span className="text-sm text-dc-text-muted">Pin to profile</span>
        </label>
        {showAvatarOption ?
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className={settingsCheckboxClass}
              checked={useAsAvatar}
              disabled={disabled}
              onChange={(e) => onUseAsAvatarChange(e.target.checked)}
            />
            <span className="text-sm text-dc-text-muted">Use as profile photo</span>
          </label>
        : null}
      </div>
    </div>
  )
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_MEDIA_ITEM_TAGS)
}
