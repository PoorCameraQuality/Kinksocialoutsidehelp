'use client'

import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'

type Variant = 'applications' | 'coverage'

export function TrustedRoleWorkflowCallout({
  eventSlug: _eventSlug,
  variant,
}: {
  eventSlug: string
  variant: Variant
}) {
  const applicationsHref = useOrganizerTabHref('people', { peopleTab: 'applications' })
  const staffHref = useOrganizerTabHref('people', { peopleTab: 'staff' })
  const coverageHref = useOrganizerTabHref('people', { peopleTab: 'coverage' })

  return (
    <div className="rounded-xl border border-dc-accent-border/45 bg-dc-accent-muted/25 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Trusted role workflow</p>
      {variant === 'applications' ? (
        <p className="mt-1.5 text-sm leading-relaxed text-dc-text">
          <span className="font-medium text-dc-text">1.</span> Approve applicants below ·{' '}
          <span className="font-medium text-dc-text">2.</span> Assign shifts on{' '}
          <a className="font-semibold text-dc-accent underline hover:text-dc-accent-hover" href={staffHref}>
            People → Staff shifts
          </a>{' '}
          · <span className="font-medium text-dc-text">3.</span> Fill gaps on{' '}
          <a className="text-dc-accent underline hover:text-dc-accent-hover" href={coverageHref}>
            Coverage & assignments
          </a>
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-dc-text">
          Trusted roles need approved applications before you assign shifts. Review pending applicants on{' '}
          <a className="font-semibold text-dc-accent underline hover:text-dc-accent-hover" href={applicationsHref}>
            People → Applications
          </a>
         . Then assign shifts on{' '}
          <a className="font-semibold text-dc-accent underline hover:text-dc-accent-hover" href={staffHref}>
            Staff shifts
          </a>
          .
        </p>
      )}
    </div>
  )
}
