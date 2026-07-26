import type { ReactNode } from 'react'
import type { UserSettingsBundle, ProfileFieldVisibilityLevel } from '@c2k/shared'
import {
  profileFieldVisibilityControlLabel,
  USER_AUTO_DELETE_SELECT_OPTIONS,
  parseUserAutoDeleteSelectValue,
  DM_RETENTION_SELECT_OPTIONS,
  parseDmRetentionSelectValue,
} from '@c2k/shared'
import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import Button from '@/components/ui/Button'
import SectionHeader from '@/components/ui/SectionHeader'
import StatusBanner from '@/components/ui/StatusBanner'
import SettingsMessagingPresets from '@/components/settings/SettingsMessagingPresets'
import { SETTINGS_INBOX_EXPLAINER } from '@/lib/messaging-copy'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import { settingsCheckboxClass, settingsHintClass, settingsLabelClass, settingsSelectClass } from '@/lib/settingsFormClasses'

const FIELD_VISIBILITY_OPTIONS: { value: ProfileFieldVisibilityLevel; label: string }[] = [
  { value: 'public', label: 'Everyone on Kink Social' },
  { value: 'friends', label: 'Connections only' },
  { value: 'hidden', label: 'Hidden on profile' },
]

function FieldVisibilitySelect({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: ProfileFieldVisibilityLevel
  onChange: (value: ProfileFieldVisibilityLevel) => void
  hint?: ReactNode
}) {
  return (
    <div>
      <label className={settingsLabelClass}>{label}</label>
      {hint ? <div className={settingsHintClass}>{hint}</div> : null}
      <select className={settingsSelectClass} value={value} onChange={(e) => onChange(e.target.value as ProfileFieldVisibilityLevel)}>
        {FIELD_VISIBILITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function PrivacySelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <div>
      <label className={settingsLabelClass}>{label}</label>
      {hint ? <p className={settingsHintClass}>{hint}</p> : null}
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

function locationPreviewText(level: ProfileFieldVisibilityLevel, locationLabel: string | null): string {
  if (level === 'hidden') return 'Location hidden'
  return locationLabel?.trim() || 'Set location in Edit profile'
}

type PrivacyProps = {
  privacy: UserSettingsBundle['privacy']
  onPrivacyChange: (next: UserSettingsBundle['privacy']) => void
}

export function SettingsFollowingPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel id="privacy" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Privacy"
        title="Following & discovery"
        description="Control follows and whether you appear in regional People suggestions."
      />
      <div className="mt-4 space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-dc-text-muted">Allow members to follow me</span>
          <input
            type="checkbox"
            className={settingsCheckboxClass}
            checked={privacy.allowFollow}
            onChange={(e) => onPrivacyChange({ ...privacy, allowFollow: e.target.checked })}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <span className="block text-sm text-dc-text-muted">New followers must be approved first</span>
            <span className="text-xs text-dc-muted">When enabled, follows stay pending until you accept them.</span>
          </div>
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} shrink-0`}
            checked={privacy.requireFollowApproval}
            onChange={(e) => onPrivacyChange({ ...privacy, requireFollowApproval: e.target.checked })}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <span className="block text-sm text-dc-text-muted">Allow being recommended in regional People</span>
            <span className="text-xs text-dc-muted">
              When off, you will not appear in People suggestions for your region.{' '}
              <Link to="/profile/edit#profile-location" className="text-dc-accent hover:underline">
                Set ZIP or region in Edit profile
              </Link>
              .
            </span>
          </div>
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} shrink-0`}
            checked={privacy.appearInRegionalPeopleSuggestions}
            onChange={(e) =>
              onPrivacyChange({ ...privacy, appearInRegionalPeopleSuggestions: e.target.checked })
            }
          />
        </label>
      </div>
    </Panel>
  )
}

export function SettingsRequestsPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Requests & invitations"
        description="Who can connect with you or pull you into events and groups."
      />
      <div className="mt-4 space-y-5">
        <PrivacySelect
          label="Who can send you a connection request?"
          value={privacy.whoCanSendConnectionRequest}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              whoCanSendConnectionRequest: value as UserSettingsBundle['privacy']['whoCanSendConnectionRequest'],
            })
          }
          options={[
            { value: 'open', label: 'Anyone on Kink Social' },
            { value: 'connections_only', label: 'Connections of my connections' },
            { value: 'nobody', label: 'No one (hide request button)' },
          ]}
        />
        <PrivacySelect
          label="Who can invite you to an event?"
          value={privacy.whoCanInviteToEvent}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              whoCanInviteToEvent: value as UserSettingsBundle['privacy']['whoCanInviteToEvent'],
            })
          }
          hint="Organizers you registered with can always reach you about that event."
          options={[
            { value: 'open', label: 'Anyone on Kink Social' },
            { value: 'connections', label: 'Connections only' },
            { value: 'organizers_i_follow', label: 'Organizers I follow' },
          ]}
        />
        <PrivacySelect
          label="Who can invite you to a group?"
          value={privacy.whoCanInviteToGroup}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              whoCanInviteToGroup: value as UserSettingsBundle['privacy']['whoCanInviteToGroup'],
            })
          }
          hint="Group leaders you are connected with can always invite you to groups they manage."
          options={[
            { value: 'open', label: 'Anyone on Kink Social' },
            { value: 'connections', label: 'Connections only' },
            { value: 'group_leaders_i_know', label: 'Group leaders I know' },
          ]}
        />
        <p className="text-xs text-dc-muted rounded-xl border border-dashed border-dc-border px-3 py-2">
          Profile relationship links require a mutual connection and partner approval. See{' '}
          <Link to="/profile/edit/relationships" className="text-dc-accent hover:underline">
            Edit profile → Relationships
          </Link>
          .
        </p>
      </div>
    </Panel>
  )
}

type SearchDiscoveryProps = {
  privacy: UserSettingsBundle['privacy']
  onPrivacyChange: (next: UserSettingsBundle['privacy']) => void
  profDiscoverable: boolean
  onProfDiscoverableChange: (value: boolean) => void
  profVisibility: 'PUBLIC' | 'MEMBERS' | 'PRIVATE'
  onProfVisibilityChange: (value: 'PUBLIC' | 'MEMBERS' | 'PRIVATE') => void
  profSectionLoading: boolean
}

export function SettingsSearchDiscoveryPanel({
  privacy,
  onPrivacyChange,
  profDiscoverable,
  onProfDiscoverableChange,
  profVisibility,
  onProfVisibilityChange,
  profSectionLoading,
}: SearchDiscoveryProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Search & directories"
        description="Control whether strangers can find you in People search and regional Places browse."
      />
      {profSectionLoading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="profile-overall-visibility" className="block text-sm font-medium text-dc-text mb-1">
              Overall profile visibility
            </label>
            <p className="text-xs text-dc-muted mb-2">
              Controls who can open your profile page. Field-level visibility below still applies to individual details.
            </p>
            <select
              id="profile-overall-visibility"
              className={settingsSelectClass}
              value={profVisibility}
              onChange={(e) =>
                onProfVisibilityChange(e.target.value as 'PUBLIC' | 'MEMBERS' | 'PRIVATE')
              }
            >
              <option value="PUBLIC">Public — anyone can view</option>
              <option value="MEMBERS">Members — signed-in members only</option>
              <option value="PRIVATE">Private — only you</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-sm text-dc-text-muted">Appear in Find people search</span>
              <span className="text-xs text-dc-muted">
                When off, your profile is only reachable by direct link or existing connections.
              </span>
            </div>
            <input
              type="checkbox"
              className={`${settingsCheckboxClass} shrink-0`}
              checked={profDiscoverable}
              onChange={(e) => onProfDiscoverableChange(e.target.checked)}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-sm text-dc-text-muted">Don&apos;t display my profile in Places browse</span>
              <span className="text-xs text-dc-muted">
                Overrides location visibility for the Places directory. Your city will not list you as a member there.
              </span>
            </div>
            <input
              type="checkbox"
              className={`${settingsCheckboxClass} shrink-0`}
              checked={privacy.hideFromPlacesDirectory}
              onChange={(e) => onPrivacyChange({ ...privacy, hideFromPlacesDirectory: e.target.checked })}
            />
          </label>
        </div>
      }
    </Panel>
  )
}

type LocationProps = {
  fvLocation: ProfileFieldVisibilityLevel
  onFvLocationChange: (value: ProfileFieldVisibilityLevel) => void
  locationLabel: string | null
  displayName: string | null
  username: string | null
  profSectionLoading: boolean
}

export function SettingsLocationVisibilityPanel({
  fvLocation,
  onFvLocationChange,
  locationLabel,
  displayName,
  username,
  profSectionLoading,
}: LocationProps) {
  const preview = locationPreviewText(fvLocation, locationLabel)

  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Location visibility"
        description="Who can see where you live on your profile and member cards. Kink Social uses ZIP-first location. Exact street address is never shown."
      />
      {profSectionLoading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : <div className="mt-4 space-y-4">
          <FieldVisibilitySelect
            label="Location on profile & cards"
            value={fvLocation}
            onChange={onFvLocationChange}
            hint={
              <>
                Set or change location in{' '}
                <Link to="/profile/edit#profile-location" className="text-dc-accent hover:underline">
                  Edit profile → Profile basics
                </Link>
                .
              </>
            }
          />
          <div className="rounded-xl border border-dc-border bg-dc-elevated/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">Preview</p>
            <p className="mt-1 text-xs text-dc-muted">What others see on your member card when location is visible:</p>
            <div className="mt-3 rounded-lg border border-dc-border bg-dc-surface px-3 py-2">
              <p className="text-sm font-medium text-dc-text">{displayName ?? username ?? 'You'}</p>
              <p className="text-xs text-dc-muted mt-0.5">{preview}</p>
            </div>
          </div>
        </div>
      }
    </Panel>
  )
}

export function SettingsEventHistoryPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Events on your profile"
        description="Who can see conventions and events you have attended on your capability profile."
      />
      <div className="mt-4 space-y-4">
        <PrivacySelect
          label="Event participation history on my profile"
          value={privacy.activityHistoryVisibility}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              activityHistoryVisibility: value as UserSettingsBundle['privacy']['activityHistoryVisibility'],
            })
          }
          hint="This hides attendance lists on your profile and feed. Organizers still see you on their event roster, and your name may appear on public event pages you RSVP'd to."
          options={[
            { value: 'public', label: 'Anyone (including signed-out visitors where allowed)' },
            { value: 'members', label: 'Signed-in members only' },
            { value: 'hidden', label: 'Only me and platform moderators' },
          ]}
        />
      </div>
    </Panel>
  )
}

export function SettingsConnectionsListPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Connections list on your profile"
        description="Control who can browse your accepted connections from your public profile."
      />
      <div className="mt-4 space-y-4">
        <PrivacySelect
          label="Who can see my connections list?"
          value={privacy.connectionsListVisibility}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              connectionsListVisibility: value as UserSettingsBundle['privacy']['connectionsListVisibility'],
            })
          }
          hint="Your profile can still show Connected when someone is connected to you. This setting only controls the browsable list on your profile."
          options={[
            { value: 'hidden', label: 'Hidden — only me (recommended)' },
            { value: 'connections_only', label: 'My connections only' },
            { value: 'members', label: 'Any signed-in member' },
            { value: 'public', label: 'Anyone who can view my profile' },
          ]}
        />
      </div>
    </Panel>
  )
}

export function SettingsInboxPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Inbox"
        description="Choose how open your direct messages are. Event organizers and door staff can still contact you about events you are registered for."
      />
      <div className="mt-4 space-y-5">
        <SettingsMessagingPresets
          active={privacy.whoCanMessage}
          onSelect={(preset) => onPrivacyChange({ ...privacy, whoCanMessage: preset })}
        />
        <p className="text-xs leading-relaxed text-dc-text-muted">{SETTINGS_INBOX_EXPLAINER}</p>
        <div className="rounded-xl border border-dashed border-dc-border bg-dc-elevated/30 px-4 py-3">
          <p className="text-sm font-medium text-dc-text-muted">Filters for new accounts &amp; unverified members</p>
          <p className="mt-1 text-xs text-dc-muted">
            Per-category inbox rules (no avatar, unverified email, etc.) are on the roadmap. Use messaging presets above
            or{' '}
            <Link to="/settings/blocked" className="text-dc-accent hover:underline">
              Blocked members
            </Link>{' '}
            for now.
          </p>
        </div>
        <PrivacySelect
            label="Receive pictures in DMs"
            value={privacy.allowImagesInDirectMessages}
            onChange={(value) =>
              onPrivacyChange({
                ...privacy,
                allowImagesInDirectMessages: value as UserSettingsBundle['privacy']['allowImagesInDirectMessages'],
              })
            }
            options={[
              { value: 'open', label: 'Anyone on Kink Social' },
              { value: 'connections_only', label: 'Connections only' },
              { value: 'nobody', label: 'No one' },
            ]}
            hint="Images you receive appear blurred until you choose to view them."
          />
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <span className="block text-sm text-dc-text-muted">Show typing indicators</span>
            <span className="text-xs text-dc-muted">Let others see when you are typing, and see when they are typing to you.</span>
          </div>
          <input
            type="checkbox"
            className={`${settingsCheckboxClass} shrink-0`}
            checked={privacy.showTypingInMessages}
            onChange={(e) => onPrivacyChange({ ...privacy, showTypingInMessages: e.target.checked })}
          />
        </label>
      </div>
    </Panel>
  )
}

function autoDeleteSelectValue(days: number | null): string {
  return days === null ? '' : String(days)
}

function dmRetentionSelectValue(days: number | null | undefined): string {
  if (days === null) return ''
  if (days === undefined) return '365'
  return String(days)
}

export function SettingsDataRetentionPanel({ privacy, onPrivacyChange }: PrivacyProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Privacy"
        title="Data retention"
        description="Control how long your direct messages are kept and optionally auto-shred content you send. Legal holds and safety investigations can pause deletion."
      />
      <div className="mt-4 space-y-5">
        <PrivacySelect
          label="Direct message retention"
          value={dmRetentionSelectValue(privacy.dmRetentionDays)}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              dmRetentionDays: parseDmRetentionSelectValue(value),
            })
          }
          options={DM_RETENTION_SELECT_OPTIONS}
          hint="Platform default is 12 months. Choose a shorter or longer window, or keep messages until you delete them. Reported messages may be preserved as case evidence."
        />
        <PrivacySelect
          label="Auto-shred: direct messages you send"
          value={autoDeleteSelectValue(privacy.directMessageAutoDeleteDays)}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              directMessageAutoDeleteDays: parseUserAutoDeleteSelectValue(value),
            })
          }
          options={USER_AUTO_DELETE_SELECT_OPTIONS}
          hint="Only messages you sent are removed. Recipients may still have a copy in their inbox until they delete or shred theirs."
        />
        <PrivacySelect
          label="Convention hub chat you send"
          value={autoDeleteSelectValue(privacy.hubChatAutoDeleteDays)}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              hubChatAutoDeleteDays: parseUserAutoDeleteSelectValue(value),
            })
          }
          options={USER_AUTO_DELETE_SELECT_OPTIONS}
          hint="Applies to chat messages you post in pinned convention hubs. Organizer records may follow separate event rules."
        />
        <PrivacySelect
          label="Your feed activity"
          value={autoDeleteSelectValue(privacy.activityAutoDeleteDays)}
          onChange={(value) =>
            onPrivacyChange({
              ...privacy,
              activityAutoDeleteDays: parseUserAutoDeleteSelectValue(value),
            })
          }
          options={USER_AUTO_DELETE_SELECT_OPTIONS}
          hint="Removes your activity rows from the Following feed after the window expires."
        />
        <p className="text-xs text-dc-muted">
          Erasure runs on a schedule (not instant). Deleted content is overwritten and removed from active systems. See
          our{' '}
          <Link to="/privacy#retention" className="text-dc-accent hover:underline">
            Privacy Policy
          </Link>{' '}
          for platform retention and legal-minimum exceptions.
        </p>
      </div>
    </Panel>
  )
}

type ProfileFieldsProps = {
  profSectionLoading: boolean
  fvGender: ProfileFieldVisibilityLevel
  onFvGenderChange: (value: ProfileFieldVisibilityLevel) => void
  fvAge: ProfileFieldVisibilityLevel
  onFvAgeChange: (value: ProfileFieldVisibilityLevel) => void
  fvSexuality: ProfileFieldVisibilityLevel
  onFvSexualityChange: (value: ProfileFieldVisibilityLevel) => void
  fvPronouns: ProfileFieldVisibilityLevel
  onFvPronounsChange: (value: ProfileFieldVisibilityLevel) => void
  profPrivacyError: string | null
  profPrivacySaved: boolean
  profPrivacySaving: boolean
  onSaveProfilePrivacy: () => void
}

export function SettingsProfileFieldsPanel({
  profSectionLoading,
  fvGender,
  onFvGenderChange,
  fvAge,
  onFvAgeChange,
  fvSexuality,
  onFvSexualityChange,
  fvPronouns,
  onFvPronounsChange,
  profPrivacyError,
  profPrivacySaved,
  profPrivacySaving,
  onSaveProfilePrivacy,
}: ProfileFieldsProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Profile"
        title="Profile field visibility"
        description='Who can see optional fields on your profile. "Connections only" means people you have mutually accepted. Location visibility is configured above; both are saved together.'
      />
      {profSectionLoading ?
        <div className="mt-4">
          <p className="mb-3 text-sm text-dc-muted">Loading profile…</p>
          <DancecardPanelSkeleton lines={3} />
        </div>
      : <div className="mt-4 space-y-4">
          <p className="text-xs text-dc-muted">
            Edit gender, orientation, roles, and pronouns in{' '}
            <Link to="/profile/edit" className="text-dc-accent hover:underline">
              Edit profile → Profile basics
            </Link>
            . Use the controls below for visibility only.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldVisibilitySelect
              label={profileFieldVisibilityControlLabel('gender')}
              value={fvGender}
              onChange={onFvGenderChange}
            />
            <FieldVisibilitySelect
              label={profileFieldVisibilityControlLabel('age')}
              value={fvAge}
              onChange={onFvAgeChange}
            />
            <FieldVisibilitySelect
              label={profileFieldVisibilityControlLabel('sexuality')}
              value={fvSexuality}
              onChange={onFvSexualityChange}
              hint="Sexual and romantic orientation tags from Edit profile."
            />
            <FieldVisibilitySelect
              label={profileFieldVisibilityControlLabel('pronouns')}
              value={fvPronouns}
              onChange={onFvPronounsChange}
            />
          </div>
          {profPrivacyError ? <StatusBanner tone="error">{profPrivacyError}</StatusBanner> : null}
          {profPrivacySaved ? <StatusBanner tone="success">Profile privacy saved.</StatusBanner> : null}
          <Button type="button" variant="secondary" disabled={profPrivacySaving} onClick={onSaveProfilePrivacy}>
            {profPrivacySaving ? 'Saving…' : 'Save profile field visibility'}
          </Button>
          <p className="text-xs text-dc-muted">
            Or use <strong className="font-medium text-dc-text-muted">Save settings</strong> at the bottom of this page to save everything at once.
          </p>
        </div>
      }
    </Panel>
  )
}
