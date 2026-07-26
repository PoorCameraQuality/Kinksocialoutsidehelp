import { useMaxMd } from '@/hooks/useMaxMd'

type Props = {
  className?: string
  onDismiss: () => void
}

const FEED_SCOPES = [
  {
    term: 'Following',
    detail: 'Activity from people you follow or connect with.',
  },
  {
    term: 'Local (Near you)',
    detail: 'Public posts from the wider community, shaped by privacy and safety settings.',
  },
  {
    term: 'Discover',
    detail: 'People, groups, events, presenters, vendors, and community spaces to explore.',
  },
] as const

export default function HomeSocialGuidance({ className = '', onDismiss }: Props) {
  const isMobile = useMaxMd()

  return (
    <section
      className={`rounded-2xl border border-dc-border/80 bg-dc-elevated-solid/95 shadow-[var(--dc-shadow-soft)] ${className}`.trim()}
      aria-label="How Home works"
    >
      <details open={!isMobile} className="group p-3 sm:p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-dc-text marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex w-full items-center justify-between gap-2">
            <span>Make this your community home</span>
            <span className="text-xs font-normal text-dc-muted group-open:hidden">Show tips</span>
            <span className="hidden text-xs font-normal text-dc-muted group-open:inline">Hide tips</span>
          </span>
        </summary>
        <div className="mt-2.5 space-y-2.5 text-xs leading-relaxed text-dc-text-muted">
          <p>
            Follow members to shape your feed, connect with people you know, join groups for ongoing
            conversations, and RSVP to events to stay close to what is happening around you.
          </p>
          <dl className="space-y-1.5">
            {FEED_SCOPES.map(({ term, detail }) => (
              <div key={term}>
                <dt className="inline font-semibold text-dc-text">{term}: </dt>
                <dd className="inline">{detail}</dd>
              </div>
            ))}
            <div>
              <dt className="inline font-semibold text-dc-text">Follow: </dt>
              <dd className="inline">A lightweight way to see someone&apos;s public activity.</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-dc-text">Connect: </dt>
              <dd className="inline">Mutual and more personal — for people you know or want closer contact with.</dd>
            </div>
          </dl>
          <p className="text-dc-muted">
            Follow helps shape what you see. Connect is mutual and more personal.
          </p>
        </div>
      </details>
      <div className="border-t border-dc-border/60 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-dc-muted transition-colors hover:text-dc-text"
        >
          Got it — hide this guide
        </button>
      </div>
    </section>
  )
}
