export function OrganizerHubHowItWorks() {
  return (
    <aside
      className="mb-8 rounded-2xl border border-dc-border/80 bg-gradient-to-br from-dc-elevated/90 to-dc-surface-muted/40 p-5 sm:p-6"
      aria-labelledby="hub-how-heading"
    >
      <h2 id="hub-how-heading" className="text-sm font-semibold text-dc-text">
        What happens on this page?
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-dc-muted">
        <p className="text-base text-dc-text">
          This is your <strong className="font-medium text-dc-text">event console</strong>. This is where you create new
          events, manage already established events, and perform initial setup.
        </p>
        <p>
          Use <strong className="font-medium text-dc-text">Create new event</strong> to start a blank convention or copy
          from a previous year. Open an event below when you want to work on program, registrants, staff, or the attendee
          link.
        </p>
        <p className="rounded-lg border border-dc-accent-border/30 bg-dc-accent-muted/25 px-3 py-2.5 text-dc-accent-foreground">
          You will be presented with setup options after creating a new event.
        </p>
      </div>
    </aside>
  )
}
