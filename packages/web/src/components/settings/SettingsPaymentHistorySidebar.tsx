import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'

export default function SettingsPaymentHistorySidebar() {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <Panel className="!p-4 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-dc-accent-border/40 bg-dc-accent-muted text-lg font-bold text-dc-accent"
          aria-hidden
        >
          Kink Social
        </div>
        <h2 className="mt-3 text-sm font-semibold text-dc-text">Member access</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Kink Social membership is free. We do not charge platform fees or sell supporter subscriptions.
        </p>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Event tickets are purchased through each organizer&apos;s external ticketing link. Organizers mark payment
          confirmed in their tools · Kink Social never holds card data or transaction records.
        </p>
        <Link
          to="/support"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 py-2.5 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
        >
          Contact support
        </Link>
      </Panel>
    </div>
  )
}
