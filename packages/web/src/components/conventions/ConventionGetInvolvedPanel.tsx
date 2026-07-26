'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiConventionParticipation } from '@/hooks/useApiConventionParticipation'

type Props = {
  conventionSlug: string
  isAuthenticated: boolean
  variant?: 'default' | 'sidebar'
}

function pathwayBadge(open: boolean, pending?: boolean) {
  if (pending) return { label: 'Pending review', className: 'bg-sky-500/20 text-sky-200' }
  if (open) return { label: 'Open', className: 'bg-emerald-500/20 text-emerald-200' }
  return { label: 'Closed', className: 'bg-dc-elevated-muted text-dc-muted' }
}

const ROLE_BLURBS: Record<string, string> = {
  staff: 'Join the event team with a structured application.',
  volunteer: 'Help run the event with a flexible volunteer application.',
  educator: 'Apply to teach a class or lead a session at this event.',
  photographer: 'Apply to shoot photo or video coverage at this event.',
  performer: 'Apply to perform at this event.',
  presenter: 'Apply as a presenter at this event.',
  custom: 'Apply for this role at this event.',
}

type PathwayCard = {
  key: string
  title: string
  blurb: string
  open: boolean
  applyUrl: string | null
  pending?: boolean
}

export default function ConventionGetInvolvedPanel({
  conventionSlug,
  isAuthenticated,
  variant = 'default',
}: Props) {
  const { data, loading, err } = useApiConventionParticipation(conventionSlug)
  const [showClosed, setShowClosed] = useState(false)

  if (loading) {
    return <p className="text-sm text-dc-muted">Loading ways to participate…</p>
  }
  if (err) return null

  const pathways = data?.pathways
  const trustedRoles = data?.trustedRoles ?? []
  if (!pathways) return null

  const my = data?.myStatus

  const cards: PathwayCard[] = [
    {
      key: 'present',
      title: 'Apply to present',
      blurb: 'Submit classes from your presenter catalog for program review.',
      open: pathways.present.open,
      applyUrl: pathways.present.applyUrl,
      pending: my?.presenterPending,
    },
    {
      key: 'vendor',
      title: 'Apply to vend',
      blurb: 'Request a vendor booth for this event.',
      open: pathways.vendor.open,
      applyUrl: pathways.vendor.applyUrl,
    },
    ...trustedRoles.map((role) => ({
      key: `role-${role.id}`,
      title: role.name,
      blurb: ROLE_BLURBS[role.roleKind] ?? ROLE_BLURBS.custom,
      open: role.open,
      applyUrl: role.applyUrl,
    })),
  ]

  const openCards = cards.filter((c) => c.open || c.pending)
  const closedCards = cards.filter((c) => !c.open && !c.pending)
  const anyOpen = openCards.length > 0
  const pendingOffers = my?.pendingOffers ?? 0

  if (!anyOpen) {
    return (
      <section
        id="get-involved"
        className={`scroll-mt-24 rounded-2xl border border-dc-border/80 bg-dc-elevated-solid ${
          variant === 'sidebar' ? 'px-4 py-3.5' : 'px-5 py-4'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">Participation</p>
            <p className="mt-1 text-sm font-medium text-dc-text/90">Applications are not open yet.</p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text/70">
              Follow the event for presenter, vendor, and volunteer openings.
            </p>
          </div>
          {isAuthenticated && pendingOffers > 0 ?
            <Link
              to={`/conventions/${conventionSlug}/my-offers`}
              className="rounded-xl bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/30"
            >
              {pendingOffers} offer{pendingOffers === 1 ? '' : 's'} waiting
            </Link>
          : null}
        </div>
      </section>
    )
  }

  const visible = showClosed ? [...openCards, ...closedCards] : openCards

  return (
    <section
      id="get-involved"
      className={`scroll-mt-24 rounded-2xl border border-dc-border bg-dc-elevated-solid ${
        variant === 'sidebar' ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-accent">Get involved</p>
          <h2 className="mt-1 text-base font-semibold text-dc-text">Participate in this event</h2>
          {variant !== 'sidebar' ?
            <p className="mt-1 max-w-xl text-sm text-dc-text-muted">
              Present, vend, or apply for staff and volunteer roles. You do not need to register as an attendee to apply.
            </p>
          : null}
        </div>
        {isAuthenticated && pendingOffers > 0 ?
          <Link
            to={`/conventions/${conventionSlug}/my-offers`}
            className="rounded-xl bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/30"
          >
            {pendingOffers} offer{pendingOffers === 1 ? '' : 's'} waiting
          </Link>
        : null}
      </div>

      <div className={`mt-4 grid gap-3 ${variant === 'sidebar' ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        {visible.map((c) => {
          const badge = pathwayBadge(c.open, c.pending)
          const canApply = c.open && c.applyUrl && isAuthenticated
          return (
            <div key={c.key} className="rounded-xl border border-dc-border bg-dc-surface-muted/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-dc-text">{c.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-dc-text-muted">{c.blurb}</p>
              {canApply ?
                <Link
                  to={c.applyUrl!}
                  className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Apply
                </Link>
              : c.open && c.applyUrl ?
                <Link
                  to={`/login?returnTo=${encodeURIComponent(c.applyUrl)}`}
                  className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-dc-accent-border/50 px-3 text-xs font-medium text-dc-accent hover:bg-dc-accent/10"
                >
                  Sign in to apply
                </Link>
              : (
                <p className="mt-3 text-xs text-dc-muted">Not open at this time.</p>
              )}
            </div>
          )
        })}
      </div>

      {closedCards.length > 0 ?
        <button
          type="button"
          onClick={() => setShowClosed((v) => !v)}
          className="mt-3 text-xs font-semibold text-dc-accent underline-offset-2 hover:underline"
        >
          {showClosed ? 'Hide closed options' : 'View all participation options'}
        </button>
      : null}
    </section>
  )
}
