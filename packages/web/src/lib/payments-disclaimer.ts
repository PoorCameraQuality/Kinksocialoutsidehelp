/** Shared buyer/seller payment liability copy (ADR 006 — seller MoR). */

export const PAYMENTS_POLICY_HREF = '/policies/payments'

/** One-line buyer note near Checkout CTAs. */
export const PAYMENTS_BUYER_SHORT =
  'Organizers and vendors own their payment processing. kink.social does not hold ticket or shop funds and cannot refund or reverse charges. Payment problems go to the seller and your card issuer.'

/** Slightly longer buyer note for tickets / register success. */
export const PAYMENTS_BUYER_NOTE =
  'Each organization or vendor runs its own payment processing (for example Stripe Connect or an external checkout). kink.social is not the merchant of record, has no ability to issue refunds or resolve charge disputes, and cannot help with payment problems. Take those up with the organizer or vendor and your credit card company. kink.social may suspend, ban, or remove events, shops, listings, and accounts that harm the platform or its members.'

/** Seller-facing note in org/vendor payments settings. */
export const PAYMENTS_SELLER_NOTE =
  'You are the merchant of record for money collected through your connected processor. Buyers must contact you (and their card issuer) for refunds and disputes — kink.social cannot reverse charges. We may suspend checkout, remove listings, or ban accounts that create payment abuse or other platform harm.'
