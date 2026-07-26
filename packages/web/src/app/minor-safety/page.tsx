import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function MinorSafetyPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Minor Safety"
      intro="Kink Social is strictly adults-only. Minors are not permitted on the platform. Suspected minor safety issues are escalated for urgent human review."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Support', href: '/support' },
      ]}
      content={{
        whatThisMeans: (
          <p>
            Every account must belong to someone 18 or older. We suspend accounts suspected of belonging to minors and treat
            content that sexualizes minors as zero-tolerance violations.
          </p>
        ),
        notAllowed: (
          <ul>
            <li>Registering or participating if you are under 18.</li>
            <li>Grooming, soliciting, or sharing content involving minors.</li>
            <li>Uploading or linking to child sexual abuse material (CSAM).</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Reporting profiles you believe belong to minors.</li>
            <li>Age-gated adult events and groups that enforce 18+ at the door and on platform.</li>
          </ul>
        ),
        howToReport: (
          <p>
            Report the profile immediately via in-product reporting or{' '}
            <a href="/support">Support</a>. Include the username and why you believe the account belongs to a minor.
          </p>
        ),
        whoCanReport: (
          <p>Any member, organizer, or moderator who encounters suspected minor participation or CSAM may report.</p>
        ),
        whatHappensNext: (
          <>
            <p>
              Trust &amp; safety staff prioritize minor-related reports. Accounts may be suspended pending review. Suspected
              CSAM is preserved for lawful reporting and removed from member view.
            </p>
            <p className="mt-2 text-sm">
              Automated NCMEC CyberTipline API submission is not enabled in beta. Manual escalation playbooks apply.
            </p>
          </>
        ),
        escalation: (
          <p>
            If you believe a child is in immediate danger, contact local law enforcement first. See{' '}
            <a href="/law-enforcement">Law Enforcement Guidelines</a> for how Kink Social handles preservation requests.
          </p>
        ),
        additionalSections: [
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: <p>This page describes platform practice, not legal obligations in your jurisdiction.</p>,
          },
        ],
      }}
    />
  )
}
