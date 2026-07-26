import { Link } from 'react-router-dom'
import { ToolsSection } from '@/components/organizer/tools/tools-ui'
import Badge from '@/components/ui/Badge'

type Props = {
  orgSlug: string
}

/** Org Tools entry pointing at left-rail Payments (vault-gated). */
export default function ComingSoonPaymentsCard({ orgSlug }: Props) {
  const paymentsHref = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=payments`
  const setupHref = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=payments-setup`

  return (
    <ToolsSection className="border-dc-accent/30 bg-dc-accent/5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-dc-text">Ticketing & payments</h3>
        <Badge variant="accent">Left rail</Badge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-dc-text-muted">
        Open <strong className="text-dc-text">Payments</strong> in the left rail. You&apos;ll set a
        separate payments password first, then connect Stripe or choose an external processor.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={paymentsHref}
          className="inline-flex min-h-11 items-center rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-on-accent"
        >
          Open Payments →
        </Link>
        <Link
          to={setupHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-dc-text-muted hover:underline"
        >
          Payments setup
        </Link>
      </div>
    </ToolsSection>
  )
}
