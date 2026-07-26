import { Link, useParams } from 'react-router-dom'
import { useApiStaffProfile } from '@/hooks/useApiStaffProfile'
import SettingsStaffSection from '@/components/settings/SettingsStaffSection'
import { useAuth } from '@/contexts/AuthContext'

export default function StaffProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { isAuthenticated, viewerUsername } = useAuth()
  const key = username?.trim() ?? ''
  const isSelf = Boolean(viewerUsername && key && viewerUsername.toLowerCase() === key.toLowerCase())
  const { status, profile, error, reload } = useApiStaffProfile(Boolean(key), key)

  if (!key) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-dc-muted">Missing username.</p>
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-dc-text">Staff timeline</h1>
        <p className="mt-2 text-sm text-dc-muted">
          <Link to="/settings" className="text-dc-accent hover:underline">
            Settings
          </Link>{' '}
          has the full participation view.
        </p>
        <div className="mt-6">
          <SettingsStaffSection enabled={isAuthenticated} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold text-dc-text">
        {profile?.displayName ?? profile?.username ?? key}
      </h1>
      {profile?.username ?
        <p className="text-sm text-dc-muted mt-1">@{profile.username}</p>
      : null}

      {status === 'loading' || status === 'idle' ?
        <div className="mt-6 h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {error ?
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 rounded-lg border border-dc-border px-3 py-1.5 text-xs"
          >
            Retry
          </button>
        </div>
      : null}

      {status === 'ready' && profile && profile.historyVisible === false ?
        <p className="mt-6 text-sm text-dc-muted rounded-xl border border-dc-border px-4 py-6">
          Participation history is private for this member.
        </p>
      : null}

      {status === 'ready' && profile && profile.historyVisible !== false ?
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-dc-border px-2.5 py-1 text-dc-muted">
              {profile.summary.organizationCount} org{profile.summary.organizationCount === 1 ? '' : 's'}
            </span>
            <span className="rounded-full border border-dc-border px-2.5 py-1 text-dc-muted">
              {profile.summary.staffDutyCount} staff roles
            </span>
            <span className="rounded-full border border-dc-border px-2.5 py-1 text-dc-muted">
              {profile.summary.volunteerShiftCount} volunteer shifts
            </span>
          </div>
          {profile.organizations.length > 0 ?
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Organizations</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {profile.organizations.map((o) => (
                  <li key={o.organizationId}>
                    <Link to={`/orgs/${encodeURIComponent(o.organizationSlug)}`} className="text-dc-accent hover:underline">
                      {o.organizationName}
                    </Link>
                    <span className="text-dc-muted ml-2">{o.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          : null}
          {!profile.staffDuties.length && !profile.slotStaff.length && !profile.volunteerShifts.length ?
            <p className="text-sm text-dc-muted">No public staff or volunteer history on file.</p>
          : null}
        </div>
      : null}
    </div>
  )
}
