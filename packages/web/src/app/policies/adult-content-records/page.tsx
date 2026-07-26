import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function AdultContentRecordsPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="User-Generated Content & Platform Role"
      intro="Kink Social is a user-generated content platform. Members upload their own personal and community content. Kink Social is not a commercial producer of explicit media and does not collect government IDs or maintain producer-style record-keeping for ordinary member uploads."
      relatedLinks={[
        { label: 'Adult content & consent', href: '/adult-content-consent' },
        { label: 'Privacy policy', href: '/privacy' },
        { label: 'Minor safety', href: '/minor-safety' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              Kink Social works like other social platforms: users choose what to post, and the platform provides tools to host,
              share, and moderate that material. We are an intermediary and community operator, not a studio or retailer
              producing content for sale.
            </p>
            <p className="mt-2">
              U.S. federal rules sometimes called &ldquo;2257&rdquo; generally target{' '}
              <strong className="text-dc-text">producers</strong> of certain commercial sexually explicit visual
              depictions. Those obligations are different from the way a user-generated content platform hosts material
              uploaded by its members. Kink Social does not treat every member upload as commercial adult production subject to
              producer record-keeping, and we do not collect government identification from uploaders for that purpose.
            </p>
            <p className="mt-2">
              During beta, explicit visual media uploads are{' '}
              <strong className="text-dc-text">disabled</strong> under our community-only media posture. This page
              describes our platform model, not a promise that no law ever applies to any future feature.
            </p>
          </>
        ),
        notAllowed: (
          <ul>
            <li>Uploading explicit visual content in beta (blocked by platform policy and product gates).</li>
            <li>Uploading content you do not have the right to share or that depicts people without consent.</li>
            <li>Uploading content involving or appearing to involve minors, for any reason.</li>
            <li>Representing that Kink Social has verified your identity, age, or legal right to distribute explicit material when we have not.</li>
            <li>Using Kink Social as a commercial explicit production or distribution business without separate legal review and any required compliance steps.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Non-explicit adult community content permitted under Community Guidelines and current media policy.</li>
            <li>Educational, event, and profile material that follows consent and minor-safety rules.</li>
            <li>Reporting harmful or illegal content through in-product tools or Support.</li>
          </ul>
        ),
        howToReport: (
          <p>
            Report suspected underage depictions, non-consensual imagery, or other violations via in-product reporting or{' '}
            <a href="/support">Support</a> immediately.
          </p>
        ),
        whoCanReport: (
          <p>Any member, depicted person, or rights holder who encounters violating content may report.</p>
        ),
        whatHappensNext: (
          <>
            <p>
              We review reports with human moderators. We may remove content, restrict accounts, and escalate suspected
              child sexual abuse material or other serious harm to appropriate authorities and workflows described in our
              other policies.
            </p>
            <p className="mt-2 text-sm">
              Uploaders remain responsible for what they post. Kink Social may update these practices if product scope or applicable
              law changes after counsel review.
            </p>
          </>
        ),
        escalation: (
          <p>
            Suspected minors or NCII bypass normal queues. See <a href="/minor-safety">Minor Safety</a> and{' '}
            <a href="/ncii">NCII Policy</a>. Copyright concerns follow <a href="/dmca">DMCA &amp; Copyright</a>.
          </p>
        ),
        additionalSections: [
          {
            id: 'ugc-responsibility',
            title: 'Uploader responsibility',
            body: (
              <p>
                You are responsible for ensuring you have the right to upload content and that everyone depicted is an
                adult who consented to be shown. Kink Social relies on member attestations, reporting, and moderation. We do not
                perform studio-style performer ID collection for routine personal uploads.
              </p>
            ),
          },
          {
            id: 'not-2257-producer',
            title: 'Why we do not collect IDs for 2257-style records',
            body: (
              <>
                <p>
                  Commercial adult producers who create or publish explicit content for distribution may have record-keeping
                  duties under U.S. law. Kink Social is not that kind of business. We provide software for a kink-positive community:
                  profiles, groups, events, and member uploads similar in model to mainstream social platforms.
                </p>
                <p className="mt-2">
                  Members self-attest that they are 18+ at registration. We do not collect government-issued IDs platform-wide
                  for upload permissions. If we ever launch features that change our regulatory posture, we will publish
                  updated terms and practices before enabling them.
                </p>
              </>
            ),
          },
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: (
              <p>
                This page summarizes Kink Social&apos;s intended platform posture during beta. It is not legal advice. Applicable
                law varies by jurisdiction and may change. Counsel review is required before public launch and before any
                material change to explicit media features.
              </p>
            ),
          },
        ],
      }}
    />
  )
}
