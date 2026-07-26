import { WizardField, WizardStepHeader, WizardTextarea } from '@/components/ui/primitives'
import Button from '@/components/ui/Button'
import ZipLocationCandidatePicker from '@/components/profile/ZipLocationCandidatePicker'
import type { ZipPlaceCandidate } from '@/lib/profile-edit-location'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const UserIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

export type AboutYouStepProps = {
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
}

export default function AboutYouStep(props: AboutYouStepProps) {
  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Be specific', body: 'Say what excites you. Specifics attract the right people.' },
        { title: 'Stay safe', body: "Don't share contact info in your bio." },
      ]}
    >
      <WizardStepHeader
        icon={UserIcon}
        eyebrow="About you"
        title="Tell us about yourself"
        description="This shows on your profile. Be real, be you. You can skip and edit later."
      />
      <div className="space-y-5">
        <WizardField
          name="onboarding-display-name"
          label="Display name"
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
        />
        <div>
          <WizardTextarea
            name="onboarding-bio"
            label="About me"
            rows={6}
            value={props.bio}
            onChange={(e) => props.onBioChange(e.target.value)}
            hint={`${props.bio.length} characters`}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-dc-text">Location</p>
          <p className="mt-1 text-xs text-dc-text-muted">Start with your ZIP and select a place when options appear.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={props.homeZip}
              onChange={(e) => props.onHomeZipChange(e.target.value)}
              onBlur={props.onHomeZipBlur}
              placeholder="ZIP code"
              className="min-w-[8rem] flex-1 rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-sm text-dc-text"
            />
            <Button type="button" variant="secondary" onClick={props.onLookupZip}>
              Look up
            </Button>
          </div>
          {props.zipError ? <p className="mt-1 text-xs text-red-200">{props.zipError}</p> : null}
          {props.locationDisplay ?
            <p className="mt-2 text-sm text-dc-text-muted">{props.locationDisplay}</p>
          : null}
          <ZipLocationCandidatePicker
            candidates={props.zipCandidates}
            selectedPlaceId={props.placeId}
            zipLocality={props.zipLocality}
            onSelect={props.onSelectZipCandidate}
          />
        </div>
      </div>
    </OnboardingStepLayout>
  )
}
