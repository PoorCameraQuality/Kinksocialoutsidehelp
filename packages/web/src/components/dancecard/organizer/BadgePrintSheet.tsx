'use client'

import { BadgePrintCard } from '@/components/dancecard/organizer/BadgePrintCard'
import type { BadgePrintRegistrant } from '@/lib/dancecard/badgePrint'

const PRINT_STYLE = `
  @media print {
    @page { margin: 0.35in; }
    body * { visibility: hidden; }
    #dc-badge-print-root, #dc-badge-print-root * { visibility: visible; }
    #dc-badge-print-root {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    .dc-badge-card {
      width: 3.375in;
      height: 2.125in;
      box-sizing: border-box;
    }
  }
`

export function BadgePrintSheet({
  eventSlug,
  eventTitle,
  logoUrl,
  registrants,
  header,
  className = 'hidden print:block',
}: {
  eventSlug: string
  eventTitle: string
  logoUrl: string | null
  registrants: BadgePrintRegistrant[]
  header?: string
  className?: string
}) {
  if (!registrants.length) return null
  return (
    <div id="dc-badge-print-root" className={className}>
      <style>{PRINT_STYLE}</style>
      {header ? (
        <p className="mb-4 text-center text-xs text-neutral-600 print:mb-3">{header}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
        {registrants.map((r) => (
          <BadgePrintCard
            key={r.id}
            eventSlug={eventSlug}
            eventTitle={eventTitle}
            logoUrl={logoUrl}
            reg={r}
          />
        ))}
      </div>
    </div>
  )
}
