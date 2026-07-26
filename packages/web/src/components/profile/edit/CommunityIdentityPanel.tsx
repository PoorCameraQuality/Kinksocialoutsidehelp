import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LIFESTYLE_ACTIVITY_OPTIONS,
  PROFILE_GENDER_MAX,
  PROFILE_GENDER_OPTIONS,
  PROFILE_ORIENTATION_MAX,
  PROFILE_ROLE_MAX,
  PROFILE_ROLE_OPTIONS,
  PROFILE_ROMANTIC_ORIENTATION_GROUPS,
  PROFILE_SEXUAL_ORIENTATION_GROUPS,
  profileOptionGroupsForTags,
} from '@c2k/shared'
import TagMultiSelect from '@/components/ui/TagMultiSelect'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

const GENDER_GROUPS = profileOptionGroupsForTags(PROFILE_GENDER_OPTIONS)
const SEXUAL_GROUPS = profileOptionGroupsForTags(PROFILE_SEXUAL_ORIENTATION_GROUPS)
const ROMANTIC_GROUPS = profileOptionGroupsForTags(PROFILE_ROMANTIC_ORIENTATION_GROUPS)
const ROLE_GROUPS = profileOptionGroupsForTags(PROFILE_ROLE_OPTIONS)

function PrivacyNote() {
  return (
    <p className="text-[11px] text-dc-muted leading-relaxed">
      Only shown where your{' '}
      <Link to="/profile/edit/privacy" className="text-dc-accent hover:underline">
        privacy settings
      </Link>{' '}
      allow.
    </p>
  )
}

export default function CommunityIdentityPanel() {
  const ctx = useProfileEdit()
  const [activeBrowseId, setActiveBrowseId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <ProfileStudioSectionCard
        title="Identity & Community"
        description="Optional fields that help people understand who you are. Your role headline on the public profile comes from Roles and Experience level below."
        icon={<IconUser />}
      >
        <p className="text-xs text-dc-muted mb-4 leading-relaxed">
          Saved identity fields may be hidden on your public profile depending on{' '}
          <Link to="/profile/edit/privacy" className="text-dc-accent hover:underline">
            privacy settings
          </Link>
          . Do not feel pressure to fill every label — share what helps you connect.
        </p>

        <div className="space-y-4">
          <ProfileStudioInsetCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-dc-text">Identity</h3>
              <p className="text-xs text-dc-muted mt-1">How you describe your gender.</p>
            </div>
            <TagMultiSelect
              label="Gender"
              browseId="gender"
              activeBrowseId={activeBrowseId}
              onActiveBrowseIdChange={setActiveBrowseId}
              values={ctx.genders}
              onChange={ctx.setGenders}
              suggestions={ctx.genderSuggestions}
              suggestionGroups={GENDER_GROUPS}
              maxCount={PROFILE_GENDER_MAX}
            />
            <PrivacyNote />
          </ProfileStudioInsetCard>

          <ProfileStudioInsetCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-dc-text">Orientation</h3>
              <p className="text-xs text-dc-muted mt-1">Sexual and romantic orientation, if you want to share them.</p>
            </div>
            <TagMultiSelect
              label="Sexual orientation"
              browseId="sexual"
              activeBrowseId={activeBrowseId}
              onActiveBrowseIdChange={setActiveBrowseId}
              values={ctx.sexualOrientations}
              onChange={ctx.setSexualOrientations}
              suggestions={ctx.sexualSuggestions}
              suggestionGroups={SEXUAL_GROUPS}
              maxCount={PROFILE_ORIENTATION_MAX}
            />
            <TagMultiSelect
              label="Romantic orientation"
              hint="Optional — e.g. aromantic, biromantic."
              browseId="romantic"
              activeBrowseId={activeBrowseId}
              onActiveBrowseIdChange={setActiveBrowseId}
              values={ctx.romanticOrientations}
              onChange={ctx.setRomanticOrientations}
              suggestions={ctx.romanticSuggestions}
              suggestionGroups={ROMANTIC_GROUPS}
              maxCount={PROFILE_ORIENTATION_MAX}
            />
            <PrivacyNote />
          </ProfileStudioInsetCard>

          <ProfileStudioInsetCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-dc-text">Roles</h3>
              <p className="text-xs text-dc-muted mt-1">Your first role appears next to your name on your profile.</p>
            </div>
            <TagMultiSelect
              label="Roles"
              browseId="roles"
              activeBrowseId={activeBrowseId}
              onActiveBrowseIdChange={setActiveBrowseId}
              values={ctx.roles}
              onChange={(v) => ctx.setRoles(v.slice(0, PROFILE_ROLE_MAX))}
              suggestions={ctx.roleSuggestions}
              suggestionGroups={ROLE_GROUPS}
              maxCount={PROFILE_ROLE_MAX}
            />
            <div>
              <label htmlFor="lifestyle-activity" className="block text-sm font-medium text-dc-text mb-1">
                Experience level
              </label>
              <p className="text-xs text-dc-muted mb-2">How active you are in events and scenes.</p>
              <select
                id="lifestyle-activity"
                value={ctx.lifestyleActivity}
                onChange={(e) => ctx.setLifestyleActivity(e.target.value)}
                className="w-full max-w-md px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"
              >
                <option value="">Select…</option>
                {LIFESTYLE_ACTIVITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </ProfileStudioInsetCard>

          <ProfileStudioInsetCard variant="accent" className="space-y-3">
            <h3 className="text-sm font-semibold text-dc-text">Visibility</h3>
            <p className="text-xs text-dc-muted leading-relaxed">
              Gender, orientation, pronouns, and location follow per-field privacy rules. Roles and experience level
              appear on your profile when set.{' '}
              <Link to="/profile/edit/privacy" className="text-dc-accent hover:underline">
                Manage privacy & visibility
              </Link>
            </p>
            <p className="text-xs text-dc-muted">
              <Link to="/profile/edit/interests" className="font-medium text-dc-accent hover:underline">
                Interests
              </Link>{' '}
              live on their own tab and are hidden by default until you choose visibility.
            </p>
          </ProfileStudioInsetCard>
        </div>
      </ProfileStudioSectionCard>
    </div>
  )
}
