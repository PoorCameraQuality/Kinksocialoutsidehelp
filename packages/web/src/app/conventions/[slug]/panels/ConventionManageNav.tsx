import { Link } from 'react-router-dom'

type Props = {
  orgSlug: string
  orgLabel: string
  conventionSlug?: string
  conventionName?: string | null
  variant?: 'breadcrumb' | 'back'
}

/** C1: organizer / manage navigation back to the hosting org. */
export default function ConventionManageNav({
  orgSlug,
  orgLabel,
  conventionSlug,
  conventionName,
  variant = 'breadcrumb',
}: Props) {
  const orgHref = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule`
  const consoleHref =
    conventionSlug ?
      `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(conventionSlug)}`
    : orgHref

  if (variant === 'back') {
    return (
      <nav className="flex flex-wrap items-center gap-3" aria-label="Back to organization">
        <Link
          to={orgHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:border-dc-accent-border/40 hover:text-dc-text"
        >
          <span aria-hidden>←</span>
          <span>
            Back to <span className="font-medium text-dc-text">{orgLabel}</span>
          </span>
        </Link>
        {conventionSlug ?
          <Link
            to={consoleHref}
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-accent-border/40 px-4 text-sm text-dc-accent hover:bg-dc-accent/10"
          >
            Open in organizer dashboard
          </Link>
        : null}
      </nav>
    )
  }

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Organizer breadcrumb">
      <Link to="/organizer" className="text-dc-muted hover:text-dc-text">
        Organizer
      </Link>
      <span className="text-dc-muted" aria-hidden>
        /
      </span>
      <Link to={orgHref} className="max-w-[10rem] truncate text-dc-muted hover:text-dc-text sm:max-w-none">
        {orgLabel}
      </Link>
      {conventionName ?
        <>
          <span className="text-dc-muted" aria-hidden>
            /
          </span>
          <span className="max-w-[12rem] truncate font-medium text-dc-text sm:max-w-none">{conventionName}</span>
        </>
      : null}
    </nav>
  )
}
