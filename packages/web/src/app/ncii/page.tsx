import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function NciiPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Non-Consensual Intimate Imagery (NCII)"
      intro="Kink Social prohibits non-consensual intimate imagery (NCII), including deepfakes shared without consent. We prioritize victim safety and human review."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Adult content & consent', href: '/adult-content-consent' },
        { label: 'Report via Support', href: '/support' },
      ]}
      content={{
        whatThisMeans: (
          <p>
            Intimate images or videos, including AI-generated deepfakes, must not be shared without the depicted
            person&apos;s consent. Threatening to share such material is also prohibited.
          </p>
        ),
        notAllowed: (
          <ul>
            <li>Uploading, sharing, or threatening to share intimate images without consent.</li>
            <li>AI-generated deepfake NCII.</li>
            <li>Re-sharing material removed as NCII.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Content you created or have documented consent to share, subject to Community Guidelines.</li>
            <li>Reporting NCII on behalf of a victim with their permission.</li>
          </ul>
        ),
        howToReport: (
          <ul>
            <li>Use in-product reporting on the profile, post, or media item.</li>
            <li>Contact <a href="/support">Support</a> with URLs and context if you cannot report in-app.</li>
            <li>For imminent harm, contact local emergency services first.</li>
          </ul>
        ),
        whoCanReport: (
          <p>Victims, witnesses, and authorized representatives may report NCII. Moderators must escalate confirmed cases.</p>
        ),
        whatHappensNext: (
          <>
            <p>
              Trained human moderators review reports. Automated scanners may flag content, but humans decide outcomes. We
              aim to remove confirmed NCII quickly and prevent re-upload via hash matching where available.
            </p>
            <p className="mt-2 text-sm">
              Kink Social does not integrate with third-party NCII takedown services (e.g. StopNCII, Take It Down) in beta. We
              are evaluating options for post-beta phases.
            </p>
          </>
        ),
        escalation: (
          <p>
            Victims may also contact local law enforcement or legal counsel. See{' '}
            <a href="/policies/appeals">Appeals</a> if you believe action on your account was mistaken.
          </p>
        ),
        additionalSections: [
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: <p>This page is not legal advice.</p>,
          },
        ],
      }}
    />
  )
}
