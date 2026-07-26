import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const DISMISS_KEY = 'c2k-stripe-payments-online-v1'

/**
 * Site-wide notice: seller-owned Stripe Connect is live.
 * kink.social provides the UI only — sellers set up their own Stripe accounts.
 */
export default function StripePaymentsAnnouncementBanner() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!mounted || dismissed) return null

  return (
    <div
      className="border-b border-dc-accent-border/35 bg-dc-accent/10 px-4 py-3 text-sm text-dc-text"
      role="status"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 leading-relaxed pr-2">
          <span className="font-semibold text-dc-text">Stripe payments are online.</span> Organizations,
          conventions, individual org events, and vendors can take card checkout through their own Stripe
          accounts. kink.social provides the setup and checkout UI only — you connect and manage your own
          Stripe (or use an external/manual processor). We do not hold your funds.{' '}
          <Link to="/policies/payments" className="font-medium text-dc-accent hover:underline">
            Payments policy
          </Link>
          {' · '}
          <Link to="/organizer/stripe-setup" className="font-medium text-dc-accent hover:underline">
            Org setup guide
          </Link>
          {' · '}
          <Link to="/settings/vendor" className="font-medium text-dc-accent hover:underline">
            Vendor shop payments
          </Link>
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              /* ignore */
            }
            setDismissed(true)
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
