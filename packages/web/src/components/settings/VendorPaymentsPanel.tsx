import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { useApiVendorStripe } from '@/hooks/useApiVendorStripe'
import type { PaymentProcessor } from '@/hooks/useApiOrgStripe'
import { PAYMENTS_POLICY_HREF, PAYMENTS_SELLER_NOTE } from '@/lib/payments-disclaimer'

const PROCESSOR_OPTIONS: { id: PaymentProcessor; label: string; blurb: string }[] = [
  {
    id: 'stripe',
    label: 'Stripe Connect',
    blurb: 'Card checkout on your shop page. Money settles to your Stripe account — kink.social is never merchant of record.',
  },
  {
    id: 'external',
    label: 'External store / link',
    blurb: 'Etsy, Shopify, PayPal, your own checkout — buyers leave kink.social to pay.',
  },
  {
    id: 'manual',
    label: 'Inquire / manual only',
    blurb: 'No online checkout. Buyers contact you or pay offline.',
  },
]

type Props = {
  /** When false, skip loading until vault is unlocked parent-side. */
  enabled?: boolean
}

export default function VendorPaymentsPanel({ enabled = true }: Props) {
  const {
    status,
    processor,
    externalPaymentUrl,
    platformStripeConfigured,
    loading,
    error,
    refresh,
    updatePayments,
    startConnect,
  } = useApiVendorStripe(enabled)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [externalUrlDraft, setExternalUrlDraft] = useState('')

  useEffect(() => {
    setExternalUrlDraft(externalPaymentUrl ?? '')
  }, [externalPaymentUrl])

  const onProcessor = async (next: PaymentProcessor) => {
    setBusy(true)
    setActionError(null)
    try {
      await updatePayments({ processor: next })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update processor')
    } finally {
      setBusy(false)
    }
  }

  const onSaveExternalUrl = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await updatePayments({ externalPaymentUrl: externalUrlDraft.trim() || null })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save URL')
    } finally {
      setBusy(false)
    }
  }

  const onConnect = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await startConnect()
      if (result.accountLinkUrl) {
        window.location.href = result.accountLinkUrl
        return
      }
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Connect failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !status) {
    return <p className="text-sm text-dc-text-muted">Loading payment settings…</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-dc-text">Shop payments</h3>
        <p className="mt-1 text-xs text-dc-muted">{PAYMENTS_SELLER_NOTE}</p>
        <Link to={PAYMENTS_POLICY_HREF} className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline">
          Payments &amp; disputes policy →
        </Link>
      </div>

      {error ?
        <p className="rounded-lg border border-dc-danger/40 bg-dc-danger/10 px-3 py-2 text-sm text-dc-text">
          {error}
        </p>
      : null}
      {actionError ?
        <p className="rounded-lg border border-dc-danger/40 bg-dc-danger/10 px-3 py-2 text-sm text-dc-text" role="alert">
          {actionError}
        </p>
      : null}

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-xs font-medium text-dc-muted uppercase mb-2">How buyers pay</legend>
        {PROCESSOR_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
              processor === opt.id ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border bg-dc-elevated-solid'
            }`}
          >
            <input
              type="radio"
              name="vendor-processor"
              className="mt-1"
              checked={processor === opt.id}
              onChange={() => void onProcessor(opt.id)}
            />
            <span>
              <span className="block text-sm font-medium text-dc-text">{opt.label}</span>
              <span className="block text-xs text-dc-muted mt-0.5">{opt.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {processor === 'external' ?
        <div className="space-y-2">
          <label htmlFor="vendor-ext-pay-url" className="block text-xs text-dc-muted">
            Optional payment / storefront URL
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="vendor-ext-pay-url"
              value={externalUrlDraft}
              onChange={(e) => setExternalUrlDraft(e.target.value)}
              placeholder="https://"
              className="min-w-[16rem] flex-1 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSaveExternalUrl()}
              className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
            >
              Save URL
            </button>
          </div>
        </div>
      : null}

      {processor === 'stripe' ?
        <div className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-dc-text">Stripe Connect</span>
            {status?.readyForCheckout ?
              <Badge variant="success">Ready for checkout</Badge>
            : status?.configured ?
              <Badge variant="neutral">Finish onboarding</Badge>
            : <Badge variant="neutral">Not connected</Badge>}
          </div>
          {!platformStripeConfigured ?
            <p className="text-xs text-amber-200/90">
              Platform Stripe keys are not configured in this environment. Connect will be unavailable until an admin
              sets <code className="text-dc-text">STRIPE_SECRET_KEY</code>.
            </p>
          : null}
          <p className="text-xs text-dc-muted">
            Catalog products with a price can use in-platform Checkout when Connect is ready. You can still keep
            outbound listing links for Etsy/Shopify items.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !platformStripeConfigured}
              onClick={() => void onConnect()}
              className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            >
              {status?.configured ? 'Continue Stripe setup' : 'Connect Stripe'}
            </button>
            {status?.dashboardUrl ?
              <a
                href={status.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Open Stripe Dashboard
              </a>
            : null}
          </div>
        </div>
      : null}
    </div>
  )
}
