import { FieldInput, FieldTextarea, StepNav } from './OnboardingShell'

export type OfferingDraft = {
  title: string
  tease: string
  outline: string
  durationMinutes: string
  level: string
  format: string
  tagsInput: string
  isPublic: boolean
}

type Props = {
  heading: string
  intro: string
  titleLabel: string
  draft: OfferingDraft
  onDraft: (patch: Partial<OfferingDraft>) => void
  formatOptions: string[]
  onBack: () => void
  onContinue: () => void
  onSkip?: () => void
  skipLabel?: string
  saving?: boolean
  requireTitle?: boolean
}

export default function OfferingCatalogStep({
  heading,
  intro,
  titleLabel,
  draft,
  onDraft,
  formatOptions,
  onBack,
  onContinue,
  onSkip,
  skipLabel = 'I will add this later in settings',
  saving,
  requireTitle = false,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-dc-text">{heading}</h2>
      <p className="text-sm text-dc-text-muted">{intro}</p>
      <FieldInput
        id="off-title"
        label={titleLabel}
        value={draft.title}
        onChange={(v) => onDraft({ title: v })}
        required={requireTitle}
      />
      <FieldTextarea
        id="off-tease"
        label="Short description"
        value={draft.tease}
        onChange={(v) => onDraft({ tease: v })}
        rows={2}
      />
      <FieldTextarea
        id="off-outline"
        label="Outline or details"
        value={draft.outline}
        onChange={(v) => onDraft({ outline: v })}
        rows={3}
        helper="Include learning goals or session structure here if you do not have a separate field."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldInput
          id="off-duration"
          label="Duration (minutes)"
          value={draft.durationMinutes}
          onChange={(v) => onDraft({ durationMinutes: v })}
          placeholder="90"
        />
        <FieldInput
          id="off-level"
          label="Level"
          value={draft.level}
          onChange={(v) => onDraft({ level: v })}
          placeholder="Beginner"
        />
      </div>
      <div>
        <label htmlFor="off-format" className="block text-sm font-medium text-dc-text">
          Format
        </label>
        <select
          id="off-format"
          value={draft.format}
          onChange={(e) => onDraft({ format: e.target.value })}
          className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text"
        >
          <option value="">Select format</option>
          {formatOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <FieldInput
        id="off-tags"
        label="Tags"
        value={draft.tagsInput}
        onChange={(v) => onDraft({ tagsInput: v })}
        placeholder="negotiation, consent"
      />
      <label className="flex items-center gap-2 text-sm text-dc-text">
        <input
          type="checkbox"
          checked={draft.isPublic}
          onChange={(e) => onDraft({ isPublic: e.target.checked })}
        />
        Show on public profile
      </label>
      <StepNav
        onBack={onBack}
        onNext={onContinue}
        nextDisabled={requireTitle && !draft.title.trim()}
        saving={saving}
        secondaryAction={
          onSkip ?
            <button
              type="button"
              onClick={onSkip}
              className="w-full sm:flex-1 min-h-11 py-3 rounded-xl border border-dc-border text-dc-text-muted hover:text-dc-text font-medium"
            >
              {skipLabel}
            </button>
          : undefined
        }
      />
    </div>
  )
}

export const EDUCATOR_FORMAT_OPTIONS = ['Class', 'Workshop', 'Lab', 'Discussion', 'Demo', 'Other']
export const SPEAKER_FORMAT_OPTIONS = [
  'Talk',
  'Panel',
  'Moderated discussion',
  'Demo',
  'Interview',
  'Q&A',
  'Workshop',
  'Keynote',
  'Other',
]
export const PHOTO_FORMAT_OPTIONS = [
  'Event coverage',
  'Portrait session',
  'Product photography',
  'Class documentation',
  'Photo booth',
  'Media package',
  'Consultation',
  'Other',
]
export const AUTHOR_TALK_FORMATS = [
  'Reading',
  'Lecture',
  'Discussion',
  'Workshop',
  'Author Q&A',
  'Writing class',
  'Other',
]
