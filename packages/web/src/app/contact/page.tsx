import { Link } from 'react-router-dom'
import ContactForm from '@/components/contact/ContactForm'

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dc-text mb-3">Contact</h1>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Use this form for legal, privacy, accessibility, and platform policy questions. For harassment, abuse, or
          safety reports, use{' '}
          <Link to="/support" className="text-dc-accent hover:underline">
            Help &amp; support
          </Link>{' '}
          so your report is tracked in moderation.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text mb-4">Send a message</h2>
        <ContactForm />
      </section>

      <div className="space-y-6 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
        <div>
          <h2 className="text-base font-semibold text-dc-text mb-1">Safety and abuse</h2>
          <p>
            <Link to="/support" className="text-dc-accent hover:underline">
              Help &amp; support
            </Link>
            . Submit a report and view your report history under Settings.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-dc-text mb-1">Events and organizations</h2>
          <p>
            Contact the host from the event or{' '}
            <Link to="/orgs" className="text-dc-accent hover:underline">
              organization
            </Link>{' '}
            page. Organizers handle registration, door policy, and event-specific questions.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-dc-text mb-1">Vendors and educators</h2>
          <p>
            Use profile or shop links on{' '}
            <Link to="/vendors" className="text-dc-accent hover:underline">
              vendor
            </Link>{' '}
            and{' '}
            <Link to="/education" className="text-dc-accent hover:underline">
              education
            </Link>{' '}
            listings for business inquiries.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Link
          to="/home"
          className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
