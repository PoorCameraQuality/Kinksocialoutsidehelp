import { Link } from 'react-router-dom'

export type VendorShopPerson = {
  username: string
  displayName: string | null
}

type Props = {
  owner: VendorShopPerson | null
  coOwners?: VendorShopPerson[]
  className?: string
}

function personLabel(person: VendorShopPerson): string {
  return person.displayName?.trim() || person.username
}

function ProfileLink({ person, className }: { person: VendorShopPerson; className?: string }) {
  return (
    <Link
      to={`/profile/${encodeURIComponent(person.username)}`}
      className={className ?? 'text-dc-accent hover:underline font-medium'}
    >
      {personLabel(person)}
    </Link>
  )
}

/** Links from a vendor shop to the people who run it on Kink Social (community profiles, not external store). */
export default function VendorShopPeople({ owner, coOwners = [], className = '' }: Props) {
  if (!owner) return null

  return (
    <div
      className={`rounded-xl border border-dc-border bg-dc-elevated-solid/40 px-4 py-3 ${className}`.trim()}
    >
      <p className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2">People behind this shop</p>
      <div className="space-y-1.5 text-sm text-dc-text-muted">
        <p>
          Owned by <ProfileLink person={owner} />
        </p>
        {coOwners.map((co) => (
          <p key={co.username}>
            Co-owner · <ProfileLink person={co} />
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/profile/${encodeURIComponent(owner.username)}`}
          className="inline-flex items-center rounded-lg border border-dc-accent-border/40 bg-dc-accent/10 px-2.5 py-1 text-xs font-medium text-dc-accent hover:bg-dc-accent/15"
        >
          View {personLabel(owner)}&apos;s profile
        </Link>
        {coOwners.map((co) => (
          <Link
            key={co.username}
            to={`/profile/${encodeURIComponent(co.username)}`}
            className="inline-flex items-center rounded-lg border border-dc-border bg-dc-elevated-solid px-2.5 py-1 text-xs font-medium text-dc-text-muted hover:text-dc-text hover:border-dc-accent-border/40"
          >
            {personLabel(co)}
          </Link>
        ))}
      </div>
    </div>
  )
}
