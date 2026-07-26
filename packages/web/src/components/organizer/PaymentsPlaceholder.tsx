export default function PaymentsPlaceholder() {
  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Ticketing &amp; payments</p>
      <p className="text-sm text-dc-text-muted">
        Native checkout, Stripe, and Eventbrite deep links will land here. For now, use external ticket URLs on individual
        events or convention settings.
      </p>
      <span className="inline-flex mt-2 rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted">
        Coming soon. Placeholder only
      </span>
    </section>
  )
}
