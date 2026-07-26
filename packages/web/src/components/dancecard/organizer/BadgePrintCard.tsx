'use client'

import { BadgeQr } from '@/components/dancecard/organizer/door/BadgeQr'
import type { BadgePrintRegistrant } from '@/lib/dancecard/badgePrint'

export function BadgePrintCard({
  eventSlug,
  eventTitle,
  logoUrl,
  reg,
  showQr = true,
}: {
  eventSlug: string
  eventTitle: string
  logoUrl: string | null
  reg: BadgePrintRegistrant
  showQr?: boolean
}) {
  return (
    <article className="dc-badge-card relative flex flex-col items-center justify-between overflow-hidden border border-neutral-300 bg-[#faf8f4] px-3 py-2.5 text-center text-neutral-900 print:break-inside-avoid">
      <div className="flex w-full flex-col items-center gap-1">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="max-h-[0.55in] max-w-[1.6in] object-contain"
          />
        ) : (
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{eventTitle}</p>
        )}
        <h3 className="mt-0.5 max-w-full truncate font-serif text-lg font-semibold leading-tight text-neutral-900">
          {reg.sceneDisplayName}
        </h3>
        {reg.packageName ? (
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-700">{reg.packageName}</p>
        ) : null}
        {reg.pronouns ? <p className="text-[10px] text-neutral-600">{reg.pronouns}</p> : null}
        {reg.badgeTagline ? (
          <p className="line-clamp-2 max-w-full px-1 text-[10px] italic leading-snug text-neutral-700">
            &ldquo;{reg.badgeTagline}&rdquo;
          </p>
        ) : null}
      </div>
      {reg.shifts.length > 0 ? (
        <ul className="mt-1 w-full space-y-0.5 text-[7px] leading-tight text-neutral-600">
          {reg.shifts.slice(0, 4).map((line) => (
            <li key={line} className="truncate">
              {line}
            </li>
          ))}
          {reg.shifts.length > 4 ? <li className="text-neutral-500">+{reg.shifts.length - 4} more</li> : null}
        </ul>
      ) : null}
      <div className="mt-1 flex w-full items-end justify-between gap-1">
        <p className="flex-1 text-center text-[8px] tabular-nums tracking-wider text-neutral-500">
          Reg #{reg.registrationNumber}
        </p>
        {showQr ? (
          <div className="shrink-0">
            <BadgeQr eventSlug={eventSlug} registrantId={reg.id} size={40} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
