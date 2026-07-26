import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function AppealsPolicyPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Appeals"
      intro="If you receive a moderation action you believe was mistaken or disproportionate, you may request a human review. Kink Social does not use autonomous systems to finalize bans or content removals."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Moderator code of conduct', href: '/policies/moderator-code-of-conduct' },
      ]}
      content={{
        whatThisMeans: (
          <p>
            A report may become a moderation case with actions such as content removal, feature restrictions, or account
            suspension. An appeal asks a different human reviewer to reconsider that outcome based on policy and context.
          </p>
        ),
        notAllowed: (
          <ul>
            <li>Submitting duplicate appeals to spam reviewers or bypass enforcement.</li>
            <li>Appeals that re-post prohibited content or harass moderators.</li>
            <li>Demanding immediate reinstatement while an urgent safety review is open (e.g. suspected minors or NCII).</li>
            <li>
              Requesting appeal or reinstatement for a permanent ban issued for{' '}
              <strong className="text-dc-text">confirmed moderator or admin power abuse</strong> under the{' '}
              <a href="/policies/moderator-code-of-conduct">Moderator Code of Conduct</a>. That outcome is final.
            </li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>One good-faith appeal per case with new relevant information.</li>
            <li>Asking for clarification of which policy was applied.</li>
            <li>Requesting review when a moderator with a conflict failed to recuse (member sanctions only; see Moderator Code for power-abuse reports).</li>
          </ul>
        ),
        howToReport: (
          <p>
            When available in-product, use the appeal action on the moderation notice or case. Until full UI is shipped,
            contact <a href="/support">Support</a> with your username, case or report reference, and why you believe the
            action was incorrect.
          </p>
        ),
        whoCanReport: (
          <p>
            The affected account holder may appeal actions on their own content or account. Org admins may appeal
            group-scoped actions affecting their community when authorized.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>
              A reviewer who was not the original decision-maker evaluates the appeal when possible. They may uphold,
              modify, or reverse the action. Beta timelines are best-effort. We do not publish fixed SLA hours.
            </p>
            <p className="mt-2 text-sm">
              Appeals data is stored in moderation systems for audit. Automated appeal bots are not used.
            </p>
          </>
        ),
        escalation: (
          <p>
            If you believe an appeal was mishandled, use our{' '}
            <a href="/contact?topic=appeal">Contact form</a> (topic: Appeal escalation). Serious safety matters may be
            escalated to trust &amp; safety leadership regardless of appeal status.
          </p>
        ),
        additionalSections: [
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: <p>This process does not replace court remedies or law enforcement for criminal matters.</p>,
          },
        ],
      }}
    />
  )
}
