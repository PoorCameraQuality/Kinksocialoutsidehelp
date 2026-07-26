import { FieldInput, FieldTextarea, StepNav } from './OnboardingShell'

type Props = {
  headline: string
  bioShort: string
  tagsInput: string
  onHeadline: (v: string) => void
  onBioShort: (v: string) => void
  onTagsInput: (v: string) => void
  identityLabel?: string
  onBack: () => void
  onContinue: () => void
  saving?: boolean
  continueDisabled?: boolean
}

export default function ProfileBasicsStep({
  headline,
  bioShort,
  tagsInput,
  onHeadline,
  onBioShort,
  onTagsInput,
  identityLabel = 'Professional identity',
  onBack,
  onContinue,
  saving,
  continueDisabled,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-dc-text">{identityLabel}</h2>
      <FieldInput
        id="po-headline"
        label="Headline"
        value={headline}
        onChange={onHeadline}
        placeholder="Rope educator · negotiation workshops"
        required
        helper="A short line organizers see first in search and directory cards."
      />
      <FieldTextarea
        id="po-bio-short"
        label="Short bio"
        value={bioShort}
        onChange={onBioShort}
        placeholder="One paragraph for directory cards and your public profile."
        rows={3}
      />
      <FieldInput
        id="po-tags"
        label="Expertise tags"
        value={tagsInput}
        onChange={onTagsInput}
        placeholder="rope, negotiation, consent"
        helper="Comma-separated. You can add more later in settings."
      />
      <StepNav
        onBack={onBack}
        onNext={onContinue}
        nextDisabled={continueDisabled ?? !headline.trim()}
        saving={saving}
      />
    </div>
  )
}
