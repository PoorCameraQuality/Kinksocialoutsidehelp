import { Link } from 'react-router-dom'
import DmcaIntakeForm from '@/components/contact/DmcaIntakeForm'
import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function DmcaPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="DMCA & Copyright"
      intro="Kink Social respects intellectual property rights. This page explains how to submit DMCA takedown notices and counter-notices, how we process them, and our repeat-infringer approach."
      relatedLinks={[
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Contact', href: '/contact' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              Copyright owners may request removal of material they believe infringes their rights. Uploaders may respond
              with a counter-notice if they believe removal was mistaken. Kink Social tracks cases in our moderation systems and
              may disable or restore content accordingly.
            </p>
            <p className="mt-2">
              <strong className="text-dc-text">Not the same as consent or NCII reports:</strong> If you appear in a photo
              or video without consent, or want a depiction removed for privacy (not copyright), use in-product reporting
              or our{' '}
              <Link to="/ncii" className="text-dc-accent hover:underline">
                NCII policy
              </Link>
              . Only copyright owners or their authorized agents should use formal DMCA intake.
            </p>
          </>
        ),
        notAllowed: (
          <ul>
            <li>Submitting false or bad-faith takedown notices.</li>
            <li>Re-uploading material after a valid takedown without legal right or counter-notice process.</li>
            <li>Using copyright claims to harass or silence unrelated speech.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Good-faith takedown notices with required elements under the DMCA.</li>
            <li>Counter-notices when you have a lawful basis to restore material.</li>
            <li>Linking to licensed or original works you own or have permission to share.</li>
          </ul>
        ),
        howToReport: (
          <>
            <p>To submit a takedown notice, provide:</p>
            <ul>
              <li>Your name and contact email</li>
              <li>Identification of the copyrighted work</li>
              <li>URL or location of the allegedly infringing material on Kink Social</li>
              <li>A statement of good-faith belief that use is not authorized</li>
              <li>A statement under penalty of perjury that the information is accurate</li>
              <li>Your physical or electronic signature</li>
            </ul>
            <p>Use the form below or send a counter-notice through our <Link to="/contact?topic=dmca" className="text-dc-accent hover:underline">Contact page</Link> with topic Copyright / DMCA.</p>
            <DmcaIntakeForm className="mt-4" />
          </>
        ),
        whoCanReport: (
          <p>
            Copyright owners, authorized agents, or their legal representatives may file takedown notices. Affected uploaders
            may file counter-notices for material they posted.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>
              We review intake for completeness, create a DMCA case, and may disable access to identified material while
              the claim is processed. Counter-notices are forwarded to the original claimant when appropriate. Admins use{' '}
              <code className="text-xs bg-dc-surface-muted px-1 rounded">/moderation/dmca</code> to disable or restore
              content tied to a case.
            </p>
            <p className="mt-2">
              <strong className="text-dc-text">Counter-notice:</strong> Include your contact information, identification of
              removed material, a statement under penalty of perjury that removal was mistaken, and consent to jurisdiction
              where required. After we receive a valid counter-notice, we forward it to the original claimant. Unless the
              claimant notifies us they have filed a court action seeking to restrain the allegedly infringing activity, we
              may restore access to the removed material within{' '}
              <strong>10–14 business days</strong> (not less than 10 nor more than 14 business days) after receipt of the
              valid counter-notice, consistent with 17 U.S.C. § 512(g)(2)(E).
            </p>
            <p className="mt-2 text-sm text-dc-text-muted">
              Information in DMCA notices and counter-notices may be shared with affected parties as part of the statutory
              process. Kink Social does not provide legal advice. Consult counsel if you are unsure which process applies.
            </p>
          </>
        ),
        escalation: (
          <p>
            Repeat infringers may face account suspension or termination consistent with our Terms. Disputes unresolved through
            DMCA process may require court action. Kink Social does not adjudicate copyright ownership.
          </p>
        ),
        additionalSections: [
          {
            id: 'repeat-infringer',
            title: 'Repeat infringer policy',
            body: (
              <p>
                We may suspend or terminate accounts of users who are repeat copyright infringers in appropriate
                circumstances and consistent with our Terms of Service. This repeat infringer policy applies after
                documented DMCA cases.
              </p>
            ),
          },
          {
            id: 'designated-agent',
            title: 'Designated agent',
            body: (
              <>
                <p>
                  Copyright-related inquiries and counter-notices: use our{' '}
                  <Link to="/contact?topic=dmca" className="text-dc-accent hover:underline">
                    Contact form
                  </Link>{' '}
                  or the takedown form on this page.
                </p>
                <p className="mt-2 text-sm">
                  <strong className="text-dc-text">Beta placeholder:</strong> Designated agent name and address for U.S.
                  Copyright Office registration will be published here before public launch if required. Do not send physical
                  mail until those details are posted.
                </p>
              </>
            ),
          },
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: <p>This policy is a draft for beta and may be revised after counsel review.</p>,
          },
        ],
      }}
    />
  )
}
