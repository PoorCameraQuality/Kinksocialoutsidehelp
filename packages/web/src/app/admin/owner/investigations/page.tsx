import { Link } from 'react-router-dom'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

export default function OwnerInvestigationsIndexPage() {
  const { staff, status } = useApiPlatformStaff(true)

  if (status === 'loading') {
    return <p className="p-6 text-sm text-dc-muted">Checking access…</p>
  }

  if (!staff?.siteOwner) {
    return (
      <div className="p-6">
        <p className="text-sm text-dc-muted">Owner-only area. Access denied.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Owner investigations</h1>
      <p className="text-sm text-dc-muted">
        Open a user investigation by UUID:{' '}
        <code className="text-dc-text">/admin/owner/investigations/users/&lt;userId&gt;</code>
      </p>
      <p className="text-sm text-dc-muted">
        From moderation, copy a subject user UUID from trust summary or case detail, then navigate directly.
      </p>
      <Link to="/moderation/cases" className="text-dc-accent text-sm hover:underline">
        Moderation cases
      </Link>
    </div>
  )
}
