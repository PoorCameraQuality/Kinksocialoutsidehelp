'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ParticipationPayload = {
  conventionSlug: string
  participation: {
    registrant: { badgeName: string | null; displayName: string } | null
    access: { paidConfirmed: boolean; attendingConfirmed: boolean; role: string } | null
  }
}

type Props = {
  conventionKey: string
  /** Sidebar card on desktop; compact bar when placed under the hero on mobile. */
  variant?: 'default' | 'sidebar' | 'compact'
}

export default function ConventionParticipationStrip({ conventionKey, variant = 'default' }: Props) {
  const [data, setData] = useState<ParticipationPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const r = await fetch(
          `/api/v1/conventions/${encodeURIComponent(conventionKey)}/me/participation`,
          { credentials: 'include' },
        )
        if (r.status === 401 || r.status === 404) {
          if (!cancelled) setData(null)
          return
        }
        if (!r.ok) {
          if (!cancelled) setData(null)
          return
        }
        const json = (await r.json()) as ParticipationPayload
        if (!cancelled) setData(json)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conventionKey])

  if (loading || !data) return null

  const reg = data.participation.registrant
  const access = data.participation.access
  if (!reg && !access) return null

  const badge = reg?.badgeName?.trim() || reg?.displayName?.trim()
  const paidOk = Boolean(access?.paidConfirmed && access?.attendingConfirmed)

  const shellClass =
    variant === 'sidebar' ?
      'rounded-2xl border border-dc-border bg-dc-elevated/95 px-4 py-4 text-sm text-dc-text-muted shadow-lg backdrop-blur-sm'
    : variant === 'compact' ?
      'rounded-xl border border-dc-accent-border/30 bg-dc-accent/10 px-4 py-3 text-sm text-dc-text-muted'
    : 'rounded-xl border border-dc-accent-border/30 bg-dc-accent/10 px-4 py-3 text-sm text-dc-text-muted'

  return (
    <div className={shellClass}>
      <p className="font-medium text-dc-text">Your registration</p>
      {badge ?
        <p className="mt-1">
          Badge: <span className="text-dc-text">{badge}</span>
        </p>
      : null}
      {access ?
        <p className="mt-0.5">
          Access:{' '}
          <span className="text-dc-text">
            {paidOk ? 'Confirmed attendee' : access.role}
            {!paidOk && !access.paidConfirmed ? ' (payment pending)' : ''}
          </span>
        </p>
      : null}
      <Link
        to={`/conventions/${encodeURIComponent(conventionKey)}/register`}
        className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-dc-accent hover:underline"
      >
        {paidOk ? 'View registration' : 'Complete registration'}
      </Link>
    </div>
  )
}
