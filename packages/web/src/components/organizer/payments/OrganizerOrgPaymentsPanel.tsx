import SettingsPaymentsTab from '@/components/organizer/settings/SettingsPaymentsTab'
import PaymentsVaultGate from '@/components/organizer/payments/PaymentsVaultGate'
import { Link } from 'react-router-dom'

type Props = {
  orgSlug: string
}

export default function OrganizerOrgPaymentsPanel({ orgSlug }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-dc-text">Payments</h1>
        <p className="mt-1 text-sm text-dc-text-muted">
          Stripe Connect, external processors, and who can manage payment settings for this organization.
        </p>
        <Link
          to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=payments-setup`}
          className="mt-2 inline-block text-sm font-medium text-dc-accent hover:underline"
        >
          Payments setup guide →
        </Link>
      </div>
      <PaymentsVaultGate title="Payments">
        <SettingsPaymentsTab orgSlug={orgSlug} />
      </PaymentsVaultGate>
    </div>
  )
}
