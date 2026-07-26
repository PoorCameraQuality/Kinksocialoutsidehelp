import { Link } from 'react-router-dom'

export default function OrganizerStripeSetupPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <p className="text-sm text-dc-text-muted">
        <Link to="/organizer" className="text-dc-accent hover:underline">
          ← Organizer
        </Link>
      </p>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-dc-text">Stripe setup for organizations</h1>
        <p className="text-dc-text-muted">
          Each organization connects <strong className="text-dc-text">its own</strong> Stripe account. Ticket and
          membership money settles to that account. Kink Social provides the UI and webhooks only.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
        <h2 className="text-lg font-semibold text-dc-text">1. Platform (Kink Social ops)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-dc-text-muted">
          <li>Create a Stripe account and enable Connect (SaaS / platform profile).</li>
          <li>
            Put keys only in gitignored env files (<code className="text-dc-text">.env.local</code> or{' '}
            <code className="text-dc-text">.env.development.local</code>):{' '}
            <code className="text-dc-text">STRIPE_SECRET_KEY</code>,{' '}
            <code className="text-dc-text">STRIPE_PUBLISHABLE_KEY</code>,{' '}
            <code className="text-dc-text">STRIPE_WEBHOOK_SECRET</code>, and{' '}
            <code className="text-dc-text">VITE_STRIPE_PUBLISHABLE_KEY</code>. Never commit secrets.
          </li>
          <li>
            Point a webhook to <code className="text-dc-text">https://your-host/api/v1/webhooks/stripe</code>{' '}
            for <code className="text-dc-text">checkout.session.completed</code>,{' '}
            <code className="text-dc-text">account.updated</code>, and subscription events. Enable events from
            connected accounts.
          </li>
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
        <h2 className="text-lg font-semibold text-dc-text">2. Organization owner</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-dc-text-muted">
          <li>
            Open Organizer → your org → left rail <strong className="text-dc-text">Payments</strong> (or{' '}
            <strong className="text-dc-text">Payments setup</strong>).
          </li>
          <li>
            Create a <strong className="text-dc-text">payments password</strong> (separate from login), then
            unlock that area.
          </li>
          <li>
            Choose a processor: <strong className="text-dc-text">Stripe Connect</strong>,{' '}
            <strong className="text-dc-text">External</strong> (Eventbrite / PayPal / etc.), or{' '}
            <strong className="text-dc-text">Cash / manual</strong>.
          </li>
          <li>
            For Stripe: click Connect with Stripe and finish identity / business verification. Wait until
            status shows <strong className="text-dc-text">Ready for checkout</strong>.
          </li>
          <li>
            Optional: grant payment management to a trusted member, or create membership / dues plans
            (Stripe only).
          </li>
        </ol>
        <p className="text-sm text-dc-text-muted">
          You do <strong className="text-dc-text">not</strong> paste your Stripe secret keys into Kink
          Social. Connect links your account; platform keys stay on the server.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/50 p-5">
        <h2 className="text-lg font-semibold text-dc-text">3. Attendees</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
          <li>Must have a Kink Social account (no guest checkout).</li>
          <li>Register for the convention, then use Pay with Stripe when the category has a price.</li>
          <li>Successful Checkout sets paid access via webhook (organizers can still mark paid manually).</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-dc-accent-border/40 bg-dc-accent/10 p-5">
        <h2 className="text-lg font-semibold text-dc-text">Adult industry note</h2>
        <p className="text-sm text-dc-text-muted">
          Stripe may restrict or review accounts that process adult content. Each org owns that risk for their
          connected account. Have a backup (cash, external tickets) and keep external ticket URLs available.
        </p>
      </section>
    </div>
  )
}
