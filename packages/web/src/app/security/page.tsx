import PolicyStandardPage from '@/components/ui/PolicyStandardPage'
import { KINK_SOCIAL_SECURITY_TXT_CONTACT } from '@c2k/shared'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 27, 2026' : undefined
const securityMailto = KINK_SOCIAL_SECURITY_TXT_CONTACT.replace(/^mailto:/, '')

export default function SecurityDisclosurePage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Security vulnerability disclosure"
      intro="Kink Social is an early-stage community platform. We welcome good-faith security reports and will work to fix validated issues, but we do not operate a paid bug bounty program and cannot offer monetary rewards at this time."
      relatedLinks={[
        { label: 'security.txt', href: '/.well-known/security.txt' },
        { label: 'CSAF provider metadata', href: '/.well-known/csaf/provider-metadata.json' },
        { label: 'Privacy policy', href: '/privacy' },
        { label: 'Law enforcement requests', href: '/law-enforcement' },
        { label: 'Member support', href: '/support' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              This page describes how security researchers should report technical vulnerabilities in Kink Social
              services. It supplements our machine-readable{' '}
              <a href="/.well-known/security.txt">security.txt</a> file (RFC 9116).
            </p>
            <p className="mt-2">
              <strong className="text-dc-text">Not a bug bounty.</strong> We have no budget for cash rewards,
              swag programs, or paid retainer today. Good-faith reports may receive public thanks with your permission
              once a fix ships.
            </p>
            <p className="mt-2">
              <strong className="text-dc-text">Not authorization to attack members.</strong> Testing must not degrade
              service for real users, exfiltrate member data beyond the minimum proof needed, or target third parties.
            </p>
          </>
        ),
        allowed: (
          <ul>
            <li>
              Reporting issues in <strong className="text-dc-text">kink.social</strong> web properties and{' '}
              <strong className="text-dc-text">/api</strong> endpoints you can reach without bypassing authentication
              you do not own.
            </li>
            <li>Minimal proof-of-concept steps that demonstrate impact without harming members or the platform.</li>
            <li>Encrypted email if you prefer (optional PGP — ask in your first message).</li>
            <li>Reasonable coordinated disclosure after we acknowledge receipt.</li>
          </ul>
        ),
        notAllowed: (
          <ul>
            <li>
              <strong className="text-dc-text">Denial-of-service, load, stress, or volumetric testing</strong> against
              production — including slowloris, application-layer floods, or &quot;see how much traffic it takes to
              fall over&quot; experiments.
            </li>
            <li>Automated scanning that generates high request volume or triggers mass account lockouts.</li>
            <li>Accessing, downloading, or retaining another member&apos;s private messages, media, or PII.</li>
            <li>Social engineering of staff, moderators, organizers, or members.</li>
            <li>Physical attacks, spam campaigns, or extortion.</li>
            <li>Testing third-party services (hosting, email, payment processors) except to report misconfiguration
              clearly tied to our deployment.</li>
          </ul>
        ),
        howToReport: (
          <>
            <p>
              Email <a href={KINK_SOCIAL_SECURITY_TXT_CONTACT}>{securityMailto}</a> with:
            </p>
            <ul>
              <li>A clear description and impact assessment.</li>
              <li>Step-by-step reproduction (URLs, request samples, screenshots).</li>
              <li>Your preferred contact for follow-up.</li>
              <li>Whether you want public acknowledgment if we publish a fix.</li>
            </ul>
            <p className="mt-2">
              We use email intentionally — there is no public vulnerability submission form to abuse. Do not open
              GitHub issues or social-media threads with exploit details; that puts members at risk.
            </p>
            <p className="mt-2">
              For member abuse, spam, or content violations, use{' '}
              <a href="/support">Help &amp; support</a> instead — those reports go to moderation, not this channel.
            </p>
          </>
        ),
        whoCanReport: (
          <p>
            Security researchers, members who discover a flaw in their own account, and vendors with a technical
            relationship to Kink Social may use this channel. Law enforcement and civil legal process should follow{' '}
            <a href="/law-enforcement">Law Enforcement &amp; Legal Requests</a>.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>
              We triage on a best-effort basis during business hours. Beta-stage staffing means response can take up
              to <strong className="text-dc-text">90 days</strong>; critical active exploitation may be prioritized
              sooner.
            </p>
            <p className="mt-2">
              If we confirm a valid issue, we will work on a fix, notify you when it is deployed, and may publish a
              CSAF advisory at <code className="text-xs bg-dc-surface-muted px-1 rounded">/.well-known/csaf/</code>{' '}
              when public disclosure is appropriate.
            </p>
          </>
        ),
        escalation: (
          <p>
            If you believe a report involves imminent harm to a member (e.g., active account takeover at scale), say so
            in the subject line. We may ask you to pause further testing while we investigate.
          </p>
        ),
        additionalSections: [
          {
            id: 'safe-harbor',
            title: 'Safe harbor (good-faith research)',
            body: (
              <p>
                If you follow this policy — including the prohibitions on DoS, member-data harvesting, and
                social engineering — Kink Social will not pursue legal action against you for activities that were
                necessary to demonstrate the vulnerability. We cannot speak for third parties. If you are unsure
                whether a test is in scope, email us before running it.
              </p>
            ),
          },
          {
            id: 'acknowledgments',
            title: 'Acknowledgments',
            body: (
              <p>
                With your permission, we may thank researchers who report valid, previously unknown issues after a fix
                is released. We do not maintain a public hall of fame while the program is pre-revenue; opt in via
                email when you report.
              </p>
            ),
          },
        ],
      }}
    />
  )
}
