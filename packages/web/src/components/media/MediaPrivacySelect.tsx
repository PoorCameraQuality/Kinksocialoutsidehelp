import {
  MEDIA_COMMENT_POLICIES,
  MEDIA_VISIBILITIES,
  MEDIA_VISIBILITY_LABELS,
  MEDIA_VISIBILITY_VALUES,
  type MediaCommentPolicy,
  type MediaVisibility,
} from '@c2k/shared'
import { settingsSelectClass } from '@/lib/settingsFormClasses'

const COMMENT_POLICY_LABELS: Record<MediaCommentPolicy, string> = {
  everyone_allowed_by_visibility: 'Everyone allowed by visibility',
  connections: 'Connections only',
  no_one: 'No one',
}

type Props = {
  visibility: MediaVisibility
  commentPolicy: MediaCommentPolicy
  onVisibilityChange: (value: MediaVisibility) => void
  onCommentPolicyChange: (value: MediaCommentPolicy) => void
  visibilityOptions?: MediaVisibility[]
  disabled?: boolean
}

export default function MediaPrivacySelect({
  visibility,
  commentPolicy,
  onVisibilityChange,
  onCommentPolicyChange,
  visibilityOptions = MEDIA_VISIBILITY_VALUES.filter(
    (v) =>
      v === MEDIA_VISIBILITIES.publicPreview ||
      v === MEDIA_VISIBILITIES.loggedIn ||
      v === MEDIA_VISIBILITIES.followers ||
      v === MEDIA_VISIBILITIES.privateProfile,
  ),
  disabled,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="media-visibility" className="mb-1 block text-sm font-medium text-dc-text-muted">
          Who can see this
        </label>
        <select
          id="media-visibility"
          className={settingsSelectClass}
          value={visibility}
          disabled={disabled}
          onChange={(e) => onVisibilityChange(e.target.value as MediaVisibility)}
        >
          {visibilityOptions.map((option) => (
            <option key={option} value={option}>
              {MEDIA_VISIBILITY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="media-comment-policy" className="mb-1 block text-sm font-medium text-dc-text-muted">
          Who can comment
        </label>
        <select
          id="media-comment-policy"
          className={settingsSelectClass}
          value={commentPolicy}
          disabled={disabled}
          onChange={(e) => onCommentPolicyChange(e.target.value as MediaCommentPolicy)}
        >
          {MEDIA_COMMENT_POLICIES.map((option) => (
            <option key={option} value={option}>
              {COMMENT_POLICY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
