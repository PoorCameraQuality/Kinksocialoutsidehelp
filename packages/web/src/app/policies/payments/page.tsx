import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'July 25, 2026' : undefined

export default function PaymentsPolicyPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Payments & Disputes"
      intro="Organizations and vendors own their payment processing. kink.social is not the merchant of record for ticket, membership, or shop charges collected through Stripe Connect or external checkouts linked from the platform."
      relatedLinks={[
        { label: 'Vendor & organizer terms', href: '/vendor-organizer-terms' },
        { label: 'Event guidelines', href: '/policies/events' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Appeals', href: '/policies/appeals' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              When you pay for a convention category, an event ticket, a membership, or a vendor product through
              kink.social Checkout (or an external payment link the seller provides), the charge settles to that{' '}
              <strong className="text-dc-text">organization&apos;s or vendor&apos;s</strong> payment account — not to a
              shared kink.social merchant balance.
            </p>
            <p className="mt-2">
              kink.social provides Connect onboarding, Checkout hooks, and access flags (such as paid confirmation). We
              do <strong className="text-dc-text">not</strong> hold card funds for those sales, cannot issue refunds, and
              cannot reverse or mediate chargebacks on the seller&apos;s behalf.
            </p>
          </>
        ),
        notAllowed: (
          <ul>
            <li>Expecting kink.social support to refund, reverse, or guarantee a ticket or product purchase.</li>
            <li>Using in-platform Checkout to run scams, bait-and-switch listings, or take payment with no intent to deliver.</li>
            <li>Misrepresenting that kink.social is the seller, escrow, or payment guarantor.</li>
            <li>Retaliating against buyers who dispute a charge with their card issuer after a legitimate problem.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Paying an organization or vendor through their Stripe Connect account or their published external checkout.</li>
            <li>Contacting the organizer or vendor first about refunds, cancellations, and delivery issues.</li>
            <li>Opening a dispute with your credit card company or bank when you believe you were charged improperly.</li>
            <li>Reporting scam patterns, impersonation, or abusive sellers through kink.social reporting tools.</li>
          </ul>
        ),
        howToReport: (
          <ul>
            <li>
              <strong className="text-dc-text">Payment / refund problems:</strong> contact the organizer or vendor who
              charged you, then your card issuer if needed. kink.social cannot process that refund.
            </li>
            <li>
              <strong className="text-dc-text">Scam or platform abuse:</strong> use in-product Report on the event, org,
              shop, or profile, or contact Trust &amp; Safety through Support.
            </li>
          </ul>
        ),
        whoCanReport: (
          <p>
            Any member who paid or was solicited for payment. Card issuers and Stripe may also act on disputes
            independently of kink.social.
          </p>
        ),
        whatHappensNext: (
          <ul>
            <li>
              For money movement: the seller and Stripe / your bank handle refunds and chargebacks. We may receive
              limited technical metadata about Checkout sessions.
            </li>
            <li>
              For community safety: Trust &amp; Safety may investigate reports, remove listings, disable Checkout, or
              suspend accounts.
            </li>
          </ul>
        ),
        escalation: (
          <>
            <p>
              kink.social reserves the right to suspend, ban, or remove any organization, vendor shop, event, listing,
              registration category, membership plan, or related account when payment activity, fraud risk, or other
              conduct becomes a problem for the platform or its members — including patterns of unpaid chargebacks,
              scam reports, or policy violations.
            </p>
            <p className="mt-2">
              Platform enforcement is separate from card disputes. Removing a listing does not refund you; refunds remain
              with the seller and your payment provider.
            </p>
          </>
        ),
      }}
    />
  )
}
