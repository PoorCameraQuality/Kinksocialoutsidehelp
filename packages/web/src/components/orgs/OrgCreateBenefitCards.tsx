const BENEFITS = [
  {
    id: 'hub',
    title: 'Public hub',
    copy: 'Give members and visitors one place to find your calendar, posts, and information.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: 'events',
    title: 'Event infrastructure',
    copy: 'Create events, conventions, schedules, check-in tools, and attendee workflows.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: 'community',
    title: 'Community tools',
    copy: 'Manage members, communications, moderation, and visibility from one console.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
] as const

export default function OrgCreateBenefitCards() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
      {BENEFITS.map((b) => (
        <li
          key={b.id}
          className="rounded-2xl border border-dc-border bg-dc-elevated-solid/80 p-4 shadow-[var(--dc-shadow-soft)]"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-dc-accent/15 text-dc-accent"
            aria-hidden
          >
            {b.icon}
          </span>
          <h3 className="mt-3 text-sm font-semibold text-dc-text">{b.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{b.copy}</p>
        </li>
      ))}
    </ul>
  )
}
