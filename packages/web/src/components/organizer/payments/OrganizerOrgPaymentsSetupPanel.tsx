import { Link } from 'react-router-dom'
import PaymentsVaultGate from '@/components/organizer/payments/PaymentsVaultGate'

type Props = {
  orgSlug: string
}

/** Vault-gated setup guide for org payments. */
export default function OrganizerOrgPaymentsSetupPanel({ orgSlug }: Props) {
  const paymentsHref = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=payments`

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-dc-text">Payments setup</h1>
        <p className="mt-1 text-sm text-dc-text-muted">
          How org-owned payments work. Unlock with your payments password, then connect under Payments.
        </p>
      </div>
      <PaymentsVaultGate title="Payments setup">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
            <h2 className="text-lg font-semibold text-dc-text">1. Payments password (required first)</h2>
            <p className="text-sm text-dc-text-muted">
              You already unlocked this area. That secondary password protects Stripe status, Connect
              onboarding, and processor changes. It is not your account login password.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
            <h2 className="text-lg font-semibold text-dc-text">2. Choose a processor</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
              <li>
                <strong className="text-dc-text">Stripe Connect</strong> — card checkout in Kink Social;
                money settles to your Stripe account (you never paste secret keys here).
              </li>
              <li>
                <strong className="text-dc-text">External</strong> — Eventbrite, PayPal, Square, etc. via a
                URL; confirm paid access manually.
              </li>
              <li>
                <strong className="text-dc-text">Cash / manual</strong> — no online pay button.
              </li>
            </ul>
            <Link
              to={paymentsHref}
              className="inline-flex min-h-11 items-center rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-on-accent"
            >
              Open Payments →
            </Link>
          </section>

          <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
            <h2 className="text-lg font-semibold text-dc-text">3. Attendees</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
              <li>Must have a Kink Social account (no guest checkout).</li>
              <li>Register, then pay via Stripe or your external link when the category has a fee.</li>
              <li>Organizers can still mark paid manually for cash/comps.</li>
            </ul>
          </section>

          <section className="space-y-3 rounded-2xl border border-dc-accent-border/40 bg-dc-accent/10 p-5">
            <h2 className="text-lg font-semibold text-dc-text">Adult industry note</h2>
            <p className="text-sm text-dc-text-muted">
              Stripe may restrict accounts that process adult content. Each org owns that risk for their
              connected account. Keep an external or cash backup.
            </p>
          </section>
        </div>
      </PaymentsVaultGate>
    </div>
  )
}
