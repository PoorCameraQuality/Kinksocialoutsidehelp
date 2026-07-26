import { Link } from 'react-router-dom'
import PlatformReportForm from '@/components/support/PlatformReportForm'

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dc-text mb-2">Help &amp; support</h1>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Safety resources, beta feedback, reporting, and where to get help on kink.social.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-dc-accent-border/40 bg-dc-accent-muted/20 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Public beta feedback</h2>
        <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
          Testing the beta? Tell us about bugs, confusing flows, privacy concerns, safety issues, or anything else that
          would help us improve before wider launch.
        </p>
        <p className="mt-2 text-sm text-dc-text-muted">
          Use the report form below. Choose the category that fits best. A human moderator reviews every submission.
        </p>
      </section>

      <section className="mb-8 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Safety &amp; community</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-dc-text-muted">
          <li>
            <strong className="text-dc-text">Block and report</strong> from profiles, messages, and org content. Reports go to
            human moderators.
          </li>
          <li>
            <strong className="text-dc-text">Convention safety:</strong> event organizers set door policies and codes of conduct. See
            each event&apos;s guidelines before you attend.
          </li>
          <li>
            <Link to="/guidelines" className="text-dc-accent hover:underline">
              Community guidelines
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-dc-accent hover:underline">
              privacy policy
            </Link>
            .
          </li>
        </ul>
      </section>

      <PlatformReportForm className="mb-8" />

      <section className="mb-8 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
        <h2 className="text-lg font-semibold text-dc-text mb-2">What happens next</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Your report is stored securely and queued for a human moderator.</li>
          <li>We may contact you through in-app notifications if we need more context.</li>
          <li>Automated tools may summarize threads for reviewers. They never auto-close or ban accounts.</li>
          <li>For urgent in-person safety issues at an event, also notify on-site staff or convention safety contacts.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
        <h2 className="text-lg font-semibold text-dc-text mb-2">Your submitted reports</h2>
        <p>
          After you submit a report, track status under{' '}
          <Link to="/settings/ecosystem#support" className="text-dc-accent hover:underline">
            Settings → Roles &amp; tools → Support section
          </Link>
          .
        </p>
      </section>

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
