import { PROFILE_PHOTO_GUIDELINES } from '@c2k/shared'
import { FormStatusMessage, WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const CameraIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8h4l2-3h6l2 3h4v11H3V8z" />
    <circle cx="12" cy="13" r="3.5" strokeWidth={1.75} />
  </svg>
)

type Props = {
  photoUploading: boolean
  photoMessage: string | null
  onPhotoChange: (file: File | null) => void
}

export default function PhotoStep({ photoUploading, photoMessage, onPhotoChange }: Props) {
  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Your control', body: 'You can change or hide photos later in Profile Studio.' },
        { title: 'Be you', body: 'A clear face or scene photo helps people recognize you at events.' },
      ]}
    >
      <WizardStepHeader
        icon={CameraIcon}
        eyebrow="Photo"
        title="Add a profile photo"
        description="Optional for now — members with a photo get more recognitions and messages."
      />
      <div className="rounded-2xl border border-dashed border-dc-border bg-dc-elevated/50 px-4 py-8 text-center">
        <label className="inline-flex cursor-pointer flex-col items-center gap-2">
          <span className="text-sm font-semibold text-dc-accent">
            {photoUploading ? 'Uploading…' : 'Click to upload a photo'}
          </span>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-left text-xs text-dc-muted">
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={photoUploading}
            onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {photoMessage ? (
        <div className="mt-4">
          <FormStatusMessage tone="success">{photoMessage}</FormStatusMessage>
        </div>
      ) : null}
    </OnboardingStepLayout>
  )
}
