import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import StatusBanner from '@/components/ui/StatusBanner'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import type { TicketHistoryItem, UseApiTicketHistoryResult } from '@/hooks/useApiTicketHistory'

function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAccessThrough(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const label = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return d.getTime() >= now.getTime() ? `Access through ${label}` : `Ended ${label}`
}

function rowTitle(item: TicketHistoryItem): string {
  const cost = item.expectedCostText?.trim()
  const provider = item.ticketingProvider?.trim()
  const parts = [cost, item.convention.name].filter(Boolean)
  let title = parts.join(' · ')
  if (provider) title += ` (${provider})`
  return title || item.convention.name
}

type StatusTone = 'success' | 'pending' | 'muted'

function rowStatus(item: TicketHistoryItem): { label: string; tone: StatusTone; footnote: string | null } {
  const accessGranted = item.paidConfirmed && item.attendingConfirmed
  if (accessGranted) {
    return {
      label: 'Confirmed',
      tone: 'success',
      footnote: formatAccessThrough(item.convention.endsAt),
    }
  }
  if (item.attendingConfirmed && !item.paidConfirmed) {
    return {
      label: 'Payment pending',
      tone: 'pending',
      footnote: item.ticketPurchaseUrl ? 'Buy tickets externally' : 'Awaiting organizer confirmation',
    }
  }
  return {
    label: 'Incomplete',
    tone: 'muted',
    footnote: item.ticketPurchaseUrl ? 'Finish registration' : null,
  }
}

const badgeClass: Record<StatusTone, string> = {
  success: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200',
  pending: 'border-amber-500/40 bg-amber-950/40 text-amber-100',
  muted: 'border-dc-border bg-dc-elevated-muted text-dc-muted',
}

function TicketHistoryRow({ item }: { item: TicketHistoryItem }) {
  const status = rowStatus(item)
  const conventionHref =
    item.convention.organizationSlug ?
      `/conventions/${encodeURIComponent(item.convention.slug)}`
    : `/conventions/${encodeURIComponent(item.convention.slug)}`

  return (
    <article className="flex flex-wrap items-start justify-between gap-4 border-b border-dc-border px-4 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link to={conventionHref} className="text-sm font-medium text-dc-text hover:text-dc-accent">
          {rowTitle(item)}
        </Link>
        <p className="mt-1 text-xs text-dc-muted">{formatHistoryDate(item.grantedAt)}</p>
        {item.role !== 'ATTENDEE' ?
          <p className="mt-1 text-xs text-dc-muted capitalize">{item.role.toLowerCase()} access</p>
        : null}
        {item.ticketPurchaseUrl && !item.paidConfirmed ?
          <a
            href={item.ticketPurchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-dc-accent hover:underline"
          >
            Open ticketing link
          </a>
        : null}
      </div>
      <div className="text-right">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeClass[status.tone]}`}
        >
          {status.label}
        </span>
        {status.footnote ?
          <p className="mt-1 text-xs text-dc-muted">{status.footnote}</p>
        : null}
      </div>
    </article>
  )
}

type Props = {
  hook: UseApiTicketHistoryResult
}

export default function SettingsPaymentHistorySections({ hook }: Props) {
  const loading = hook.status === 'loading' || hook.status === 'idle'

  return (
    <Panel className="!p-0 overflow-hidden">
      <div className="border-b border-dc-border px-4 py-4">
        <SectionHeader
          eyebrow="Account"
          title="Payment history"
          description="Organizer-confirmed event access and external ticketing. Not charges processed by Kink Social."
        />
      </div>
      <div className="px-4 pb-4">
        {hook.error ?
          <StatusBanner tone="error">{hook.error}</StatusBanner>
        : null}
        {loading ?
          <div className="py-4">
            <DancecardPanelSkeleton lines={4} />
          </div>
        : hook.items.length === 0 ?
          <p className="py-6 text-sm text-dc-muted">
            No event registrations yet. When you register for a convention, organizer-confirmed access appears here.
            Ticket purchases happen on each organizer&apos;s external site.
          </p>
        : <div className="-mx-4">
            {hook.items.map((item) => (
              <TicketHistoryRow key={item.id} item={item} />
            ))}
          </div>
        }
      </div>
    </Panel>
  )
}
