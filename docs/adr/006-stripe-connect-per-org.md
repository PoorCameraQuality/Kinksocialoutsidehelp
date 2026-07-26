# ADR 006: Per-organization (and vendor) Stripe Connect

## Status

**Accepted (2026-07-25)** — SaaS Connect / direct charges. **MVP implemented** for orgs (Connect onboarding, convention + event ticket Checkout, webhooks → `paidConfirmed`, membership plans + subscription Checkout + Customer Portal) and **vendors** (Connect onboarding, product Checkout on vendor connected account).

## Context

Organizers want ticketing, memberships, and dues inside Kink Social. Vendors want optional in-platform shop checkout without giving up control of money. Product decision: **build payments**, but each **organization** and each **vendor** owns its own Stripe account. The platform provides Connect onboarding UI, Checkout hookups, webhooks, and a setup guide. Kink Social must **not** be merchant of record for org ticket revenue or vendor product sales.

## Decision

1. **Stripe Connect SaaS** with **direct charges** on the connected account (org or vendor = merchant of record).
2. Connected accounts use **Full Stripe Dashboard** (`controller.stripe_dashboard.type = full`), Stripe-owned pricing/fees, Stripe loss liability on direct charges.
3. **Onboarding:** Account Links (primary) + Account Sessions when available for embedded components.
4. **Convention tickets:** Checkout Session `mode=payment` with `Stripe-Account` header; metadata carries `c2k_org_id`, `c2k_user_id`, `c2k_convention_id`, `c2k_mode=ticket`.
5. **Standalone org events:** same org Connect account; `events.price_cents` + Checkout `c2k_mode=event_ticket` → `event_rsvps.paid_confirmed`.
6. **Vendor products:** Checkout on the **vendor** Connect account (`c2k_mode=vendor_product`); not the org account.
7. **Memberships:** Products/Prices on the org connected account; Checkout `mode=subscription`; Customer Portal for self-serve.
8. **Webhooks:** `POST /api/v1/webhooks/stripe` — signature verify, idempotent event ids, `checkout.session.completed` → `paidConfirmed` / membership billing jsonb; `account.updated` syncs org **and** vendor Connect flags.
9. **Secrets:** platform keys only in env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable keys). Never commit secrets; use `.env.local` / `.env.development.local`.
10. **Identity:** no guest checkout.
11. **Still allowed:** external ticket/storefront URLs, cash/comp + manual `paidConfirmed`.
12. **Payment processor preference:** `stripe` | `external` | `manual` on `organizations` and `vendor_profiles` (plus optional `external_payment_url`). Not a second processor SDK — external means link-out + manual paid confirmation.
13. **Who may manage org payments:** organization **owner** by default; owner may grant `organization_members.can_manage_payments`. Org ADMIN role alone is not enough.
14. **Who may manage vendor payments:** vendor shop managers (`requireVendorShopManager`).
15. **Payments vault:** each user must set a **secondary payments password** before Connect / processor UI. Unlock stamps `payments_vault_unlocked_at` (30‑minute TTL). Distinct from login password. Shared for org and vendor surfaces.
16. **UI:** Org left rail **Payments** / **Payments setup**; vendor **Settings → Vendor shop** (vault-gated).
17. **Deferred:** platform `application_fee_amount`, platform MoR, native PayPal/Square SDKs.

## Implementation map

| Area | Path |
|------|------|
| Client | `packages/api/src/lib/stripe.ts` |
| Org helpers | `packages/api/src/lib/stripe-org.ts` |
| Vendor helpers | `packages/api/src/lib/stripe-vendor.ts` |
| Connect routes | `stripe-connect-org.ts`, `stripe-connect-vendor.ts` |
| Checkout | `packages/api/src/routes/stripe-checkout-routes.ts` |
| Webhooks | `packages/api/src/routes/stripe-webhooks.ts` |
| Organizer UI | Left rail **Payments** / **Payments setup** (vault gate) |
| Vendor UI | `/settings/vendor` → `VendorPaymentsPanel` (vault gate) |
| Vault | `payments-vault.ts` + `/api/v1/me/payments-vault*` |
| Attendee pay | `RegisterFlow` (conventions), `EventDetailClient` (events) |
| Buyer pay | Vendor shop product cards → vendor Checkout |

## Consequences

- Requires Stripe Connect platform account + webhook (including connected-account events).
- Adult-industry Stripe risk remains **per org / per vendor**.
- Cursor session checklist: payments follow this ADR (not a hard stop).
