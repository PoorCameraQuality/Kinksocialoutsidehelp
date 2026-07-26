import { Link } from 'react-router-dom'
import {
  PAYMENTS_BUYER_NOTE,
  PAYMENTS_BUYER_SHORT,
  PAYMENTS_POLICY_HREF,
} from '@/lib/payments-disclaimer'

type Props = {
  /** `short` for dense CTAs; `note` for registration / ticket blocks. */
  variant?: 'short' | 'note'
  className?: string
}

/** Compact liability notice for buyer-facing Checkout surfaces. */
export default function PaymentsBuyerDisclaimer({ variant = 'short', className }: Props) {
  const text = variant === 'note' ? PAYMENTS_BUYER_NOTE : PAYMENTS_BUYER_SHORT
  return (
    <p
      className={
        className ??
        'rounded-xl border border-dc-border/80 bg-dc-elevated-solid/60 px-3 py-2 text-xs text-dc-muted'
      }
      role="note"
    >
      {text}{' '}
      <Link to={PAYMENTS_POLICY_HREF} className="text-dc-accent hover:underline">
        Payments policy
      </Link>
    </p>
  )
}
