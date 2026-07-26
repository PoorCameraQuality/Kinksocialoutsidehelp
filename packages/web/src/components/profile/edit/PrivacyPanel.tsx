import { Link } from 'react-router-dom'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { profileStudioNestedRowClass } from '@/components/profile/studio/profile-studio-classes'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'
import {
  ADULT_CONTENT_PREFERENCE_OPTIONS,
  useAdultContentPreference,
} from '@/hooks/useAdultContentPreference'
import { settingsSelectClass } from '@/lib/settingsFormClasses'

const VISIBILITY_TOPICS = [
  {
    title: 'Location',
    copy: 'Choose whether your city/region appears on your public profile and in regional suggestions.',
  },
  {
    title: 'Roles & identity fields',
    copy: 'Gender, age, orientations, pronouns, and location each have their own visibility in Settings. Roles and experience level follow your overall profile visibility.',
  },
  {
    title: 'Interests',
    copy: 'Only Into and Curious tags appear on public profiles. Limits stay private.',
  },
  {
    title: 'Who can message you',
    copy: 'Control inbox requests and who can start a conversation with you.',
  },
  {
    title: 'People search',
    copy: 'Decide if you appear in the People directory and regional discovery.',
  },
] as const

export default function PrivacyPanel() {
  const { preference, setPreference, loaded, saving, error } = useAdultContentPreference(true)

  return (
    <ProfileStudioSectionCard
      title="Privacy & Visibility"
      description="Adult community profiles need flexible privacy. Choose what helps people connect while keeping sensitive details controlled."
      icon={<IconUser />}
    >
    <div className="space-y-6">
      <ProfileStudioInsetCard className="space-y-4">
        <div>
          <label htmlFor="adult-content-preference" className="mb-1 block text-sm font-medium text-dc-text">
            Adult content
          </label>
          <p className="mb-2 text-xs text-dc-muted leading-relaxed">
            Choose how adult-tagged media appears in your feed and across Kink Social. New accounts default to blur.
          </p>
          <select
            id="adult-content-preference"
            className={settingsSelectClass}
            value={preference}
            disabled={!loaded || saving}
            onChange={(e) => setPreference(e.target.value as typeof preference)}
          >
            {ADULT_CONTENT_PREFERENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      </ProfileStudioInsetCard>
      <div className="space-y-4">
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Field-level visibility for gender, age, orientations, pronouns, and location is managed in account settings.
          Messaging, discovery, and adult content preferences are there too.
        </p>
        <ul className="space-y-4">
          {VISIBILITY_TOPICS.map((topic) => (
            <li key={topic.title} className={profileStudioNestedRowClass}>
              <p className="text-sm font-medium text-dc-text">{topic.title}</p>
              <p className="mt-1 text-xs text-dc-muted leading-relaxed">{topic.copy}</p>
            </li>
          ))}
        </ul>
        <Link
          to="/settings/privacy"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Open privacy settings
        </Link>
        <p className="text-xs text-dc-muted">
          <Link to="/guidelines" className="text-dc-accent hover:underline">
            Learn more about privacy on Kink Social
          </Link>
        </p>
      </div>
    </div>
    </ProfileStudioSectionCard>
  )
}
