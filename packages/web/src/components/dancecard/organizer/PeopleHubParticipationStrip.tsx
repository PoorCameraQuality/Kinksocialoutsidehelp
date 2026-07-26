'use client'

import { useEffect, useState } from 'react'

type Props = {
  conventionKey: string
}

function accessRoleLabel(role: string | undefined): string {
  if (!role || role === 'ATTENDEE') return 'Attendee'
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function PeopleHubParticipationStrip({ conventionKey }: Props) {
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetch(
        `/api/v1/conventions/${encodeURIComponent(conventionKey)}/me/participation`,
        { credentials: 'include' },
      )
      if (!r.ok) return
      const d = (await r.json()) as {
        participation?: {
          registrant?: { badgeName?: string | null; displayName?: string } | null
          access?: { role?: string; paidConfirmed?: boolean; attendingConfirmed?: boolean } | null
        }
      }
      const reg = d.participation?.registrant
      const access = d.participation?.access
      const parts: string[] = []
      const name = reg?.badgeName?.trim() || reg?.displayName?.trim()
      if (name) parts.push(`You are registered as ${name}`)
      if (access) {
        const paid = access.paidConfirmed && access.attendingConfirmed
        parts.push(paid ? 'Paid access confirmed' : `Access role: ${accessRoleLabel(access.role)}`)
      }
      if (!cancelled && parts.length > 0) setSummary(parts.join(' · '))
    })()
    return () => {
      cancelled = true
    }
  }, [conventionKey])

  if (!summary) return null

  return (
    <p className="rounded-lg border border-dc-border/60 bg-dc-surface/40 px-3 py-2 text-sm text-dc-muted">
      {summary}
    </p>
  )
}
