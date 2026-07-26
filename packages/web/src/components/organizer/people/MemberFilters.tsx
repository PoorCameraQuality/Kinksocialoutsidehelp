import type { MemberFilter } from '@/lib/organizer/org-people-utils'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  roleFilter: MemberFilter
  onRoleFilterChange: (f: MemberFilter) => void
}

export default function MemberFilters({ query, onQueryChange, roleFilter, onRoleFilterChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="min-w-0 flex-1 sm:max-w-md">
        <span className="sr-only">Search members</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search members by name or handle"
          className="w-full min-h-11 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-dc-text-muted">
        <span className="sr-only">Filter by role</span>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as MemberFilter)}
          className="min-h-11 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text"
        >
          <option value="all">All roles</option>
          <option value="owner_admin">Owner / Admin</option>
          <option value="MODERATOR">Moderator</option>
          <option value="STAFF">Staff</option>
          <option value="MEMBER">Member</option>
          <option value="visible">Publicly visible</option>
          <option value="hidden">Hidden from public</option>
        </select>
      </label>
    </div>
  )
}
