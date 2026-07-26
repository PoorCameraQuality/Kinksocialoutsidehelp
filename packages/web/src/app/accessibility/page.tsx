import { Link } from 'react-router-dom'

const LAST_UPDATED = 'May 28, 2026'

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dc-text mb-2">Accessibility</h1>
        <p className="text-xs text-dc-muted mb-2">Last updated {LAST_UPDATED}</p>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Kink Social is committed to making the platform usable for as many people as possible, including people who use
          assistive technologies.
        </p>
      </header>

      <section className="mb-8 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Our commitment</h2>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          We target <strong className="text-dc-text">WCAG 2.1 Level AA</strong> where practical: semantic landmarks, visible focus
          states, sufficient color contrast on primary UI, keyboard-operable controls, and text alternatives for essential imagery.
          Mobile layouts respect safe areas and use touch targets sized for one-handed use.
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Known limitations</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-dc-text-muted">
          <li>Some organizer dashboards are dense; we continue to improve table and form labeling.</li>
          <li>User-uploaded photos and rich text may lack complete alt text until authors add descriptions.</li>
          <li>Third-party embeds (maps, external shop links) follow the accessibility of the host site.</li>
        </ul>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Feedback</h2>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          If you hit a barrier (keyboard trap, unreadable contrast, missing labels), use our{' '}
          <Link to="/contact?topic=accessibility" className="text-dc-accent hover:underline">
            Contact form
          </Link>{' '}
          (topic: Accessibility) or{' '}
          <Link to="/support" className="text-dc-accent hover:underline">
            Help &amp; support
          </Link>
          . Include the page URL, browser, and assistive tech if you can. We prioritize fixes that block core tasks (sign-in,
          registration, messaging, door check-in).
        </p>
      </section>

      <Link
        to="/home"
        className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
      >
        Back to home
      </Link>
    </div>
  )
}
