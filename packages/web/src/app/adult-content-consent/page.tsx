import LegalDraftPage from '@/components/ui/LegalDraftPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'

export default function AdultContentConsentPage() {
  return (
    <LegalDraftPage
      published={legalPublished}
      effectiveDate={legalPublished ? 'June 5, 2026' : undefined}
      title="Adult Content & Consent"
      intro="Kink Social is an adults-only community. Explicit media is not public and is not enabled in beta. This page describes how we handle adult-oriented content and consent attestation."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Privacy policy', href: '/privacy' },
        { label: 'NCII policy', href: '/ncii' },
      ]}
      sections={[
        {
          id: 'adults-only',
          title: 'Adults only (18+)',
          body: (
            <p>
              You must be at least 18 years old to use Kink Social. We do not collect government IDs or date of birth during
              signup; you self-attest that you meet the age requirement.
            </p>
          ),
        },
        {
          id: 'ugc-platform',
          title: 'User-generated content',
          body: (
            <p>
              Kink Social is a user-generated content platform. You upload your own personal and community material. We host and
              moderate it, similar in model to mainstream social networks. We are not a commercial producer of explicit
              media and do not collect government IDs from members for producer-style record-keeping. See our{' '}
              <a href="/policies/adult-content-records">User-Generated Content</a> policy for how we describe that role.
            </p>
          ),
        },
        {
          id: 'beta-posture',
          title: 'Beta content posture',
          body: (
            <>
              <p>
                During beta, explicit media uploads and public explicit previews are <strong>disabled</strong>. Content
                scanners run as safety signals. Human moderators make final decisions.
              </p>
              <p>
                If upload features expand later, uploaders remain responsible for consent, age of depicted persons, and
                rights to share. Kink Social will publish any updated requirements before enabling new media capabilities.
              </p>
            </>
          ),
        },
        {
          id: 'consent',
          title: 'Consent & depicted people',
          body: (
            <ul>
              <li>Do not upload content involving people who have not consented to be depicted.</li>
              <li>Do not upload hidden-camera, voyeur, or non-consensual intimate imagery.</li>
              <li>
                Any identifiable person shown in a photo or video may request removal if they did not consent to being
                depicted, or if they withdraw consent later. This is not the same as a copyright (DMCA) claim. Use
                in-product reporting or our NCII policy page.
              </li>
              <li>
                AI-generated, CGI, or deepfake-like depictions of identifiable people without consent are treated as
                consent violations, not copyright disputes.
              </li>
            </ul>
          ),
        },
        {
          id: 'not-legal-advice',
          title: 'Not legal advice',
          body: (
            <p>
              This page describes platform rules, not legal advice. Policies may be updated after counsel review.
            </p>
          ),
        },
      ]}
    />
  )
}
