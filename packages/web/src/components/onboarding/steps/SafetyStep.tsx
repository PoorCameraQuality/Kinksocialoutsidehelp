import { Link } from 'react-router-dom'
import { EncryptionNoticeCard, WizardStepHeader } from '@/components/ui/primitives'

const ShieldIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4" />
  </svg>
)

type SafetyStepProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Step 2 — consent, privacy, and community safety. The agreement gate stays distinct. */
export default function SafetyStep({ checked, onCheckedChange }: SafetyStepProps) {
  return (
    <div>
      <WizardStepHeader
        icon={ShieldIcon}
        eyebrow="Safety"
        title="Consent, privacy, and community safety"
        description="Before you continue, please review the basics that keep kink.social safer for everyone. These rules protect consent, privacy, and community trust."
      />

      <div className="space-y-6">
        <section className="space-y-3" aria-labelledby="community-expectations-heading">
          <h3 id="community-expectations-heading" className="text-sm font-semibold text-dc-text">
            Community expectations
          </h3>
          <p className="max-w-prose text-sm font-medium text-dc-text">kink.social is for adults only.</p>
          <ul className="max-w-prose list-disc space-y-2 pl-5 text-sm leading-relaxed text-dc-text-muted">
            <li>You are 18 or older.</li>
            <li>Consent comes first, always.</li>
            <li>Harassment, threats, abuse, coercion, and outing are not allowed.</li>
            <li>You will respect people&apos;s privacy, boundaries, identities, and relationships.</li>
            <li>You will report safety concerns, suspicious behavior, or rule violations when you see them.</li>
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="privacy-notice-heading">
          <h3 id="privacy-notice-heading" className="text-sm font-semibold text-dc-text">
            Privacy notice
          </h3>
          <EncryptionNoticeCard />
        </section>

        <div className="space-y-4 border-t border-dc-border pt-6">
          <label htmlFor="safety-ack-checkbox" className="flex items-start gap-3 text-sm text-dc-text">
            <input
              id="safety-ack-checkbox"
              type="checkbox"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-dc-border"
            />
            <span>I am 18 or older and agree to follow these community expectations.</span>
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/guidelines" className="text-dc-accent hover:underline">
              Community guidelines
            </Link>
            <Link to="/privacy" className="text-dc-accent hover:underline">
              Privacy policy
            </Link>
            <Link to="/support" className="text-dc-accent hover:underline">
              Beta feedback and reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
