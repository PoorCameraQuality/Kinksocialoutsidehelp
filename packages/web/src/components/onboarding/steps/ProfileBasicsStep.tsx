import {
  PROFILE_GENDER_MAX,
  PROFILE_GENDER_VALUES,
  PROFILE_PRONOUN_MAX,
  PROFILE_PHOTO_GUIDELINES,
} from '@c2k/shared'
import { FormStatusMessage, WizardField, WizardStepHeader, WizardTextarea } from '@/components/ui/primitives'
import Button from '@/components/ui/Button'
import TagMultiSelect from '@/components/ui/TagMultiSelect'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import ZipLocationCandidatePicker from '@/components/profile/ZipLocationCandidatePicker'
import type { ZipPlaceCandidate } from '@/lib/profile-edit-location'

const PRONOUN_PRESETS = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Any pronouns', 'Ask me']

const UserIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

export type ProfileBasicsStepProps = {
  displayName: string
  onDisplayNameChange: (value: string) => void
  bio: string
  onBioChange: (value: string) => void
  homeZip: string
  onHomeZipChange: (value: string) => void
  onHomeZipBlur: () => void
  onLookupZip: () => void
  zipError: string | null
  zipCandidates: ZipPlaceCandidate[]
  zipLocality: string | null
  placeId: string | null
  onSelectZipCandidate: (placeId: string) => void
  locationDisplay: string
  birthDate: string
  onBirthDateChange: (value: string) => void
  birthDateBounds: { min: string; max: string }
  genders: string[]
  onGendersChange: (values: string[]) => void
  pronounTags: string[]
  onPronounTagsChange: (values: string[]) => void
  photoUploading: boolean
  photoMessage: string | null
  onPhotoChange: (file: File | null) => void
}

/** Step 3 — profile basics, grouped to reduce the wall-of-fields feel. */
export default function ProfileBasicsStep(props: ProfileBasicsStepProps) {
  return (
    <div>
      <WizardStepHeader
        icon={UserIcon}
        eyebrow="Your profile"
        title="Profile basics"
        description="Share what you are comfortable with now. Sensitive fields stay private until you choose otherwise on the next step."
      />

      <div className="space-y-6">
        <WizardField
          name="onboarding-display-name"
          label="Display name"
          hint="How you appear on your profile and in the community."
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-dc-text">
            Location <span className="font-normal text-dc-text-muted">(optional)</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
            Your ZIP helps with nearby events and groups. You control who sees it.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="ZIP code"
              value={props.homeZip}
              onChange={(e) => props.onHomeZipChange(e.target.value)}
              onBlur={props.onHomeZipBlur}
              className="w-32 rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-base text-dc-text sm:text-sm"
            />
            <Button type="button" variant="secondary" onClick={props.onLookupZip}>
              Look up
            </Button>
          </div>
          {props.zipError ? <FormStatusMessage tone="error">{props.zipError}</FormStatusMessage> : null}
          {props.zipCandidates.length > 0 ? (
            <ZipLocationCandidatePicker
              candidates={props.zipCandidates}
              selectedPlaceId={props.placeId}
              onSelect={props.onSelectZipCandidate}
              zipLocality={props.zipLocality}
            />
          ) : props.locationDisplay ? (
            <p className="mt-2 rounded-lg border border-dc-border px-3 py-2 text-sm text-dc-text-muted">
              {props.locationDisplay}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium text-dc-text">
            Date of birth{' '}
            <span className="font-normal text-dc-text-muted">(optional)</span>
          </p>
          <p id="onboarding-birth-date-hint" className="mt-1 text-xs leading-relaxed text-dc-text-muted">
            Stored privately for eligibility checks. Never shown on your public profile.
          </p>
          <ProfileBirthDateField
            id="onboarding-birth-date"
            value={props.birthDate}
            bounds={props.birthDateBounds}
            onChange={props.onBirthDateChange}
            aria-describedby="onboarding-birth-date-hint"
            className="mt-2 max-w-md"
          />
        </div>

        <TagMultiSelect
          label="Gender (optional)"
          values={props.genders}
          onChange={props.onGendersChange}
          suggestions={[...PROFILE_GENDER_VALUES]}
          maxCount={PROFILE_GENDER_MAX}
        />

        <TagMultiSelect
          label="Pronouns (optional)"
          values={props.pronounTags}
          onChange={props.onPronounTagsChange}
          suggestions={PRONOUN_PRESETS}
          maxCount={PROFILE_PRONOUN_MAX}
        />

        <WizardTextarea
          name="onboarding-bio"
          label="Short bio"
          optional
          value={props.bio}
          onChange={(e) => props.onBioChange(e.target.value)}
          rows={3}
          placeholder="How you show up in the community. Events, roles, what you care about."
        />

        <div>
          <p className="text-sm font-medium text-dc-text">
            Profile photo <span className="font-normal text-dc-text-muted">(optional)</span>
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-dc-text-muted">
            {PROFILE_PHOTO_GUIDELINES.map((g, i) => (
              <li key={i}>
                {g.bold ? <strong className="text-dc-text">{g.bold}</strong> : null}
                {g.bold ? ' ' : null}
                {g.text}
              </li>
            ))}
          </ul>
          <input
            type="file"
            accept="image/*"
            disabled={props.photoUploading}
            onChange={(e) => props.onPhotoChange(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-dc-text-muted"
          />
          {props.photoMessage ? <FormStatusMessage tone="info">{props.photoMessage}</FormStatusMessage> : null}
        </div>
      </div>
    </div>
  )
}
