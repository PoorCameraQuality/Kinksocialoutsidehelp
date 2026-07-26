import { FormStatusMessage, WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const GalleryIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

type Props = {
  uploading: boolean
  message: string | null
  onFiles: (files: FileList | null) => void
}

export default function GalleryStep({ uploading, message, onFiles }: Props) {
  return (
    <OnboardingStepLayout
      tipsTitle="Photo tips"
      tips={[
        { title: 'Variety', body: 'Mix angles and settings when you are comfortable.' },
        { title: 'Your control', body: 'Manage visibility of each photo later.' },
        { title: 'More photos', body: 'Galleries with several photos tend to get more views.' },
      ]}
    >
      <WizardStepHeader
        icon={GalleryIcon}
        eyebrow="Gallery"
        title="Add to your gallery"
        description="Optional — upload more photos now, or skip and finish setup."
      />
      <div className="rounded-2xl border border-dashed border-dc-border bg-dc-elevated/50 px-4 py-10 text-center">
        <label className="inline-flex cursor-pointer flex-col items-center gap-2">
          <span className="text-sm font-semibold text-dc-accent">
            {uploading ? 'Uploading…' : 'Click to upload photos'}
          </span>
          <span className="text-xs text-dc-muted">JPEG, PNG, GIF, WEBP. Add as many as you like.</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {message ?
        <div className="mt-4">
          <FormStatusMessage tone="success">{message}</FormStatusMessage>
        </div>
      : null}
    </OnboardingStepLayout>
  )
}
