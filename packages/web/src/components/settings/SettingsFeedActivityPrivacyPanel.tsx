import type { UserSettingsBundle } from '@c2k/shared'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { settingsCheckboxClass, settingsSelectClass } from '@/lib/settingsFormClasses'

type Props = {
  privacy: UserSettingsBundle['privacy']
  onPrivacyChange: (next: UserSettingsBundle['privacy']) => void
}

const VISIBILITY_OPTIONS = [
  { value: 'on', label: 'On — anyone who can see my feed' },
  { value: 'connections_only', label: 'Connections only (recommended)' },
  { value: 'off', label: 'Off — do not show' },
] as const

const GROUP_JOIN_OPTIONS = [
  { value: 'ask', label: 'Ask every time I join a group' },
  { value: 'on', label: 'On — show when allowed' },
  { value: 'off', label: 'Off — never show group joins' },
] as const

const MEMBER_LIST_DEFAULT_OPTIONS = [
  { value: 'ask', label: 'Ask when joining (recommended)' },
  { value: 'visible', label: 'Show me in member lists by default' },
  { value: 'hidden', label: 'Keep me hidden from member lists by default' },
] as const

function ActivitySelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-dc-text-muted">{label}</label>
      {hint ? <p className="mb-2 text-xs text-dc-muted">{hint}</p> : null}
      <select className={settingsSelectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Controls which of the member's actions appear in other people's activity feeds. */
export default function SettingsFeedActivityPrivacyPanel({ privacy, onPrivacyChange }: Props) {
  const feed = privacy.feedActivityPrivacy

  const patchFeed = (next: Partial<typeof feed>) => {
    onPrivacyChange({
      ...privacy,
      feedActivityPrivacy: { ...feed, ...next },
    })
  }

  return (
    <Panel id="feed-activity-privacy" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Privacy"
        title="Feed and activity privacy"
        description="Control which of your actions can appear in other people's feeds."
      />

      <div className="mt-4 space-y-5">
        <ActivitySelect
          label="Show my reactions and loves in activity feeds"
          value={feed.showReactions}
          onChange={(value) => patchFeed({ showReactions: value as typeof feed.showReactions })}
          options={VISIBILITY_OPTIONS}
        />
        <ActivitySelect
          label="Show my comments in activity feeds"
          value={feed.showComments}
          onChange={(value) => patchFeed({ showComments: value as typeof feed.showComments })}
          options={VISIBILITY_OPTIONS}
        />
        <ActivitySelect
          label="Show when I follow or connect with someone"
          value={feed.showFollows}
          onChange={(value) => patchFeed({ showFollows: value as typeof feed.showFollows })}
          options={VISIBILITY_OPTIONS}
        />
        <ActivitySelect
          label="Show when I RSVP to events"
          value={feed.showEventRsvps}
          onChange={(value) => patchFeed({ showEventRsvps: value as typeof feed.showEventRsvps })}
          options={VISIBILITY_OPTIONS}
          hint="Event organizers may still see your registration for events you attend."
        />
        <ActivitySelect
          label="Show when I join groups in feeds"
          value={feed.showGroupJoins}
          onChange={(value) => patchFeed({ showGroupJoins: value as typeof feed.showGroupJoins })}
          options={GROUP_JOIN_OPTIONS}
        />
        <ActivitySelect
          label="Show my media uploads in activity feeds"
          value={feed.showMediaUploads}
          onChange={(value) => patchFeed({ showMediaUploads: value as typeof feed.showMediaUploads })}
          options={VISIBILITY_OPTIONS}
        />

        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted/40 px-4 py-4">
          <h3 className="text-sm font-semibold text-dc-text">Group membership privacy</h3>
          <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
            Groups can reveal location, interests, or community participation. Choose whether your name appears in each
            group&apos;s member list when you join.
          </p>
          <div className="mt-4 space-y-4">
            <ActivitySelect
              label="Default member list visibility for new groups"
              value={feed.defaultGroupMemberListVisibility}
              onChange={(value) =>
                patchFeed({ defaultGroupMemberListVisibility: value as typeof feed.defaultGroupMemberListVisibility })
              }
              options={MEMBER_LIST_DEFAULT_OPTIONS}
            />
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
                checked={feed.defaultShowGroupsOnProfile}
                onChange={(e) => patchFeed({ defaultShowGroupsOnProfile: e.target.checked })}
              />
              <span className="text-sm text-dc-text-muted">Show groups on my profile by default</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
                checked={feed.defaultAnnounceGroupJoins}
                onChange={(e) => patchFeed({ defaultAnnounceGroupJoins: e.target.checked })}
              />
              <span className="text-sm text-dc-text-muted">
                Allow group joins to appear in feed activity by default
              </span>
            </label>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
            checked={feed.showInConnectionSuggestions}
            onChange={(e) => patchFeed({ showInConnectionSuggestions: e.target.checked })}
          />
          <span className="text-sm text-dc-text-muted">Show me in connection suggestions for other members</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
            checked={feed.showRecentlyActive}
            onChange={(e) => patchFeed({ showRecentlyActive: e.target.checked })}
          />
          <span className="text-sm text-dc-text-muted">Show recently active status to others</span>
        </label>
      </div>
    </Panel>
  )
}
