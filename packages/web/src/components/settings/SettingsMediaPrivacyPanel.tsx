import type { UserSettingsBundle } from '@c2k/shared'
import {
  ALLOW_PEOPLE_TO_TAG_ME_OPTIONS,
  DEFAULT_POST_UPLOADS_TO_FEED_OPTIONS,
  MEDIA_COMMENT_POLICIES,
  MEDIA_VISIBILITIES,
  MEDIA_VISIBILITY_LABELS,
  MEDIA_VISIBILITY_VALUES,
  SHOW_TAGGED_MEDIA_OPTIONS,
  type AllowPeopleToTagMe,
  type DefaultPostUploadsToFeed,
  type MediaCommentPolicy,
  type MediaVisibility,
  type ShowTaggedMediaOnProfile,
} from '@c2k/shared'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { settingsCheckboxClass, settingsSelectClass } from '@/lib/settingsFormClasses'

type Props = {
  privacy: UserSettingsBundle['privacy']
  onPrivacyChange: (next: UserSettingsBundle['privacy']) => void
}

const COMMENT_POLICY_LABELS: Record<MediaCommentPolicy, string> = {
  everyone_allowed_by_visibility: 'Everyone allowed by visibility',
  connections: 'Connections only',
  no_one: 'No one',
}

const TAG_ME_LABELS: Record<AllowPeopleToTagMe, string> = {
  yes: 'Yes — anyone can tag me',
  approval_required: 'Approval required (recommended)',
  no: 'No one can tag me',
}

const POST_TO_FEED_LABELS: Record<DefaultPostUploadsToFeed, string> = {
  true: 'Always post uploads to feed',
  false: 'Never post uploads to feed',
  ask: 'Ask each time',
}

const TAGGED_MEDIA_LABELS: Record<ShowTaggedMediaOnProfile, string> = {
  approved_only: 'Approved tags only',
  no: 'Do not show tagged media',
}

const MEMBER_VISIBILITY_OPTIONS = MEDIA_VISIBILITY_VALUES.filter(
  (v) =>
    v === MEDIA_VISIBILITIES.publicPreview ||
    v === MEDIA_VISIBILITIES.loggedIn ||
    v === MEDIA_VISIBILITIES.followers ||
    v === MEDIA_VISIBILITIES.privateProfile,
)

/** Default privacy for new media uploads, albums, and tagging. */
export default function SettingsMediaPrivacyPanel({ privacy, onPrivacyChange }: Props) {
  const media = privacy.mediaSettings

  const patchMedia = (next: Partial<typeof media>) => {
    onPrivacyChange({
      ...privacy,
      mediaSettings: { ...media, ...next },
    })
  }

  return (
    <Panel id="media-privacy" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Privacy"
        title="Media and albums"
        description="Defaults for uploads, albums, tagging, and how media activity appears."
      />

      <div className="mt-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-dc-text-muted">Default upload visibility</label>
            <select
              className={settingsSelectClass}
              value={media.defaultMediaVisibility}
              onChange={(e) => patchMedia({ defaultMediaVisibility: e.target.value as MediaVisibility })}
            >
              {MEMBER_VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {MEDIA_VISIBILITY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-dc-text-muted">Default comment policy</label>
            <select
              className={settingsSelectClass}
              value={media.defaultMediaCommentPolicy}
              onChange={(e) => patchMedia({ defaultMediaCommentPolicy: e.target.value as MediaCommentPolicy })}
            >
              {MEDIA_COMMENT_POLICIES.map((option) => (
                <option key={option} value={option}>
                  {COMMENT_POLICY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Post new uploads to feed</label>
          <select
            className={settingsSelectClass}
            value={media.defaultPostUploadsToFeed}
            onChange={(e) => patchMedia({ defaultPostUploadsToFeed: e.target.value as DefaultPostUploadsToFeed })}
          >
            {DEFAULT_POST_UPLOADS_TO_FEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {POST_TO_FEED_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Who can tag me in media</label>
          <select
            className={settingsSelectClass}
            value={media.allowPeopleToTagMe}
            onChange={(e) => patchMedia({ allowPeopleToTagMe: e.target.value as AllowPeopleToTagMe })}
          >
            {ALLOW_PEOPLE_TO_TAG_ME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {TAG_ME_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Tagged media on profile</label>
          <select
            className={settingsSelectClass}
            value={media.showTaggedMediaOnProfile}
            onChange={(e) => patchMedia({ showTaggedMediaOnProfile: e.target.value as ShowTaggedMediaOnProfile })}
          >
            {SHOW_TAGGED_MEDIA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {TAGGED_MEDIA_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
            checked={media.showMediaTabOnProfile}
            onChange={(e) => patchMedia({ showMediaTabOnProfile: e.target.checked })}
          />
          <span className="text-sm text-dc-text-muted">Show media tab on my profile</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
            checked={media.showAlbumsOnProfile}
            onChange={(e) => patchMedia({ showAlbumsOnProfile: e.target.checked })}
          />
          <span className="text-sm text-dc-text-muted">Show albums on my profile</span>
        </label>
      </div>
    </Panel>
  )
}
