import {
  PROFILE_GENDER_MAX,
  PROFILE_GENDER_OPTIONS,
  PROFILE_ORIENTATION_MAX,
  PROFILE_ROLE_MAX,
  PROFILE_ROLE_OPTIONS,
  PROFILE_SEXUAL_ORIENTATION_GROUPS,
  profileOptionGroupsForTags,
} from '@c2k/shared'
import { useState } from 'react'
import { WizardStepHeader } from '@/components/ui/primitives'
import TagMultiSelect from '@/components/ui/TagMultiSelect'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const DetailsIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h10M4 18h14" />
  </svg>
)

const GENDER_GROUPS = profileOptionGroupsForTags(PROFILE_GENDER_OPTIONS)
const SEXUAL_GROUPS = profileOptionGroupsForTags(PROFILE_SEXUAL_ORIENTATION_GROUPS)
const ROLE_GROUPS = profileOptionGroupsForTags(PROFILE_ROLE_OPTIONS)

type Props = {
  genders: string[]
  onGendersChange: (v: string[]) => void
  orientations: string[]
  onOrientationsChange: (v: string[]) => void
  roles: string[]
  onRolesChange: (v: string[]) => void
}

export default function DetailsStep({
  genders,
  onGendersChange,
  orientations,
  onOrientationsChange,
  roles,
  onRolesChange,
}: Props) {
  const [activeBrowseId, setActiveBrowseId] = useState<string | null>(null)

  return (
    <OnboardingStepLayout
      tipsTitle="Almost done!"
      tips={[
        { title: 'Be open', body: 'More options can mean more relevant connections.' },
        { title: 'Editable later', body: 'Everything here can be changed in Profile Studio.' },
      ]}
    >
      <WizardStepHeader
        icon={DetailsIcon}
        eyebrow="Your details"
        title="Help others get to know you"
        description="Optional tags for identity and roles. Skip anything you are not ready to share."
      />
      <div className="space-y-6">
        <TagMultiSelect
          label="I am / We are"
          browseId="onb-gender"
          activeBrowseId={activeBrowseId}
          onActiveBrowseIdChange={setActiveBrowseId}
          values={genders}
          onChange={(v) => onGendersChange(v.slice(0, PROFILE_GENDER_MAX))}
          suggestionGroups={GENDER_GROUPS}
          maxCount={PROFILE_GENDER_MAX}
        />
        <TagMultiSelect
          label="Sexual orientation"
          browseId="onb-sexual"
          activeBrowseId={activeBrowseId}
          onActiveBrowseIdChange={setActiveBrowseId}
          values={orientations}
          onChange={(v) => onOrientationsChange(v.slice(0, PROFILE_ORIENTATION_MAX))}
          suggestionGroups={SEXUAL_GROUPS}
          maxCount={PROFILE_ORIENTATION_MAX}
        />
        <TagMultiSelect
          label="Role"
          browseId="onb-roles"
          activeBrowseId={activeBrowseId}
          onActiveBrowseIdChange={setActiveBrowseId}
          values={roles}
          onChange={(v) => onRolesChange(v.slice(0, PROFILE_ROLE_MAX))}
          suggestionGroups={ROLE_GROUPS}
          maxCount={PROFILE_ROLE_MAX}
        />
      </div>
    </OnboardingStepLayout>
  )
}
