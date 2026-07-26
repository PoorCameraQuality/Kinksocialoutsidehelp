import { Link } from 'react-router-dom'

type Props = {
  viewerUsername: string | null
  apiBacked: boolean
  hasPresenter?: boolean
  hasVendor?: boolean
  vendorHref?: string | null
}

export default function ProfileOwnerActions({
  viewerUsername,
  apiBacked,
  hasPresenter,
  hasVendor,
  vendorHref,
}: Props) {
  const publicHref =
    viewerUsername ? `/profile/${encodeURIComponent(viewerUsername)}` : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Link
          to="/profile/edit"
          className="min-h-11 inline-flex items-center px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover text-dc-accent-foreground text-sm font-medium rounded-xl transition-colors"
        >
          Profile Studio
        </Link>
        {publicHref ?
          <Link
            to={publicHref}
            className="min-h-11 inline-flex items-center px-4 py-2 bg-dc-elevated-solid hover:bg-dc-elevated-muted text-dc-text text-sm font-medium rounded-xl border border-dc-border transition-colors"
          >
            View as public
          </Link>
        : null}
        {apiBacked ?
          <>
            <Link
              to="/connections"
              className="min-h-11 inline-flex items-center px-4 py-2 bg-dc-elevated-solid hover:bg-dc-elevated-muted text-dc-text text-sm font-medium rounded-xl border border-dc-border transition-colors"
            >
              Connections
            </Link>
            <Link
              to="/messaging"
              className="min-h-11 inline-flex items-center px-4 py-2 bg-dc-elevated-solid hover:bg-dc-elevated-muted text-dc-text text-sm font-medium rounded-xl border border-dc-border transition-colors"
            >
              Messages
            </Link>
          </>
        : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/orgs/new"
          className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center"
        >
          Create organization
        </Link>
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        {hasVendor && vendorHref ?
          <Link to={vendorHref} className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center">
            Your vendor shop
          </Link>
        : hasVendor ?
          <Link to="/settings/vendor" className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center">
            Your vendor shop
          </Link>
        : (
          <Link
            to="/vendors/onboarding"
            className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center"
          >
            Open a vendor shop
          </Link>
        )}
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        {hasPresenter ?
          <Link
            to={viewerUsername ? `/presenters/${encodeURIComponent(viewerUsername)}` : '/presenters/onboarding'}
            className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center"
          >
            Your presenter profile
          </Link>
        : (
          <Link
            to="/presenters/onboarding"
            className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center"
          >
            Set up presenter profile
          </Link>
        )}
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        <Link to="/settings/account" className="text-sm text-dc-accent hover:underline min-h-10 inline-flex items-center">
          Account settings
        </Link>
      </div>
    </div>
  )
}
