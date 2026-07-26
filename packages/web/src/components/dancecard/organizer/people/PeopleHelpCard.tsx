'use client'

import { copy } from '@/lib/dancecard/productCopy'

export function PeopleHelpCard() {
  return (
    <details className="rounded-xl border border-dc-border bg-dc-elevated-muted/50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-dc-text">How People works</summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-dc-muted">
        <p>
          One Kink Social account per person. <strong className="font-medium text-dc-text">{copy.signups}</strong> are
          registration records for this event. <strong className="font-medium text-dc-text">{copy.roster}</strong> is the
          unified people directory built from registrations, staff shifts, program assignments, and access grants.
        </p>
        <p className="text-xs">
          The same member can appear in both signups and roster. Staff shifts are tied to Kink Social member accounts, not
          roster directory rows.
        </p>
      </div>
    </details>
  )
}
