import { StepNav } from './OnboardingShell'

type Props = {
  visibility: 'PUBLIC' | 'UNLISTED'
  onVisibility: (v: 'PUBLIC' | 'UNLISTED') => void
  onBack: () => void
  onContinue: () => void
  saving?: boolean
}

export default function VisibilityStep({ visibility, onVisibility, onBack, onContinue, saving }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-dc-text">Directory visibility</h2>
      <p className="text-sm text-dc-text-muted">
        Choose whether this profile appears in the relevant directory and eligible search.
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Directory visibility">
        <label
          className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${visibility === 'PUBLIC' ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border'}`}
        >
          <input
            type="radio"
            name="visibility"
            checked={visibility === 'PUBLIC'}
            onChange={() => onVisibility('PUBLIC')}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-dc-text">Public</span>
            <span className="text-sm text-dc-text-muted">
              Show this profile in the relevant directory and eligible search.
            </span>
          </span>
        </label>
        <label
          className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${visibility === 'UNLISTED' ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border'}`}
        >
          <input
            type="radio"
            name="visibility"
            checked={visibility === 'UNLISTED'}
            onChange={() => onVisibility('UNLISTED')}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-dc-text">Unlisted</span>
            <span className="text-sm text-dc-text-muted">
              Unlisted profiles do not appear in the presenter directory or people search, but anyone with the direct
              link may still be able to view the public version of the profile.
            </span>
          </span>
        </label>
      </div>
      {visibility === 'UNLISTED' ?
        <p className="text-xs text-dc-text-muted">
          You can switch to Public anytime in settings. Unlisted pages are marked noindex for search engines.
        </p>
      : null}
      <StepNav onBack={onBack} onNext={onContinue} saving={saving} />
    </div>
  )
}
