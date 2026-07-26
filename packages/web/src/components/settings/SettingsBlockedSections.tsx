import { useState } from 'react'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { Panel } from '@/components/dancecard/ui/Panel'
import Button from '@/components/ui/Button'
import StatusBanner from '@/components/ui/StatusBanner'
import TextInput from '@/components/ui/TextInput'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import type { ApiBlockedMember, BlockedSort, UseApiBlockedMembersResult } from '@/hooks/useApiBlockedMembers'
import { settingsSelectClass } from '@/lib/settingsFormClasses'

function genderAbbrev(gender: string | null, genders: string[]): string {
  const label = genders[0] ?? gender
  if (!label) return ''
  const lower = label.toLowerCase()
  if (lower.includes('woman') || lower === 'f') return 'F'
  if (lower.includes('man') && !lower.includes('woman')) return 'M'
  if (lower.includes('non-binary') || lower.includes('nonbinary')) return 'NB'
  return label.charAt(0).toUpperCase()
}

export function formatBlockedSubtitle(member: ApiBlockedMember): string | null {
  const parts: string[] = []
  if (member.age != null) {
    let head = String(member.age)
    const g = genderAbbrev(member.gender, member.genders)
    if (g) head += g
    parts.push(head)
  }
  const role = member.roles[0]
  if (role) parts.push(role)
  return parts.length ? parts.join(' ') : null
}

export function formatBlockedDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const label = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `Blocked ${label}`
}

function BlockedMemberCard({
  member,
  onUnblock,
  busy,
}: {
  member: ApiBlockedMember
  onUnblock: (username: string) => void
  busy: boolean
}) {
  const subtitle = formatBlockedSubtitle(member)
  const blockedLabel = formatBlockedDate(member.blockedAt)
  const location = member.location?.trim()

  return (
    <article className="flex gap-3 rounded-xl border border-dc-border bg-dc-elevated/40 p-3">
      <div className="shrink-0">
        {member.avatarUrl ?
          <img
            src={member.avatarUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
        : <PlaceholderAvatar size="lg" className="!rounded-lg" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dc-accent">@{member.username}</p>
            {member.displayName?.trim() && member.displayName.trim() !== member.username ?
              <p className="truncate text-xs text-dc-muted">{member.displayName.trim()}</p>
            : null}
          </div>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onUnblock(member.username)}>
            Unblock
          </Button>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-dc-text-muted">{subtitle}</p> : null}
        {location ? <p className="mt-0.5 text-xs text-dc-muted">{location}</p> : null}
        {blockedLabel ? <p className="mt-1 text-xs text-dc-muted">{blockedLabel}</p> : null}
      </div>
    </article>
  )
}

function BlockMemberForm({
  onBlock,
  busy,
}: {
  onBlock: (username: string) => Promise<{ ok: boolean; error?: string }>
  busy: boolean
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [username, setUsername] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async () => {
    setNotice(null)
    const trimmed = username.trim().replace(/^@/, '')
    const result = await onBlock(username)
    if (result.ok) {
      setUsername('')
      setNotice(`Blocked @${trimmed}.`)
      setShowAdd(false)
    } else {
      setNotice(result.error ?? 'Could not block.')
    }
  }

  if (!showAdd) {
    return (
      <div className="mb-4">
        <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
          + Block member
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-dc-border bg-dc-elevated/30 p-4">
      <p className="text-sm font-medium text-dc-text">Block by username</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <Button type="button" disabled={busy || !username.trim()} onClick={() => void submit()}>
          Block
        </Button>
      </div>
      {notice ? <p className="text-xs text-dc-muted">{notice}</p> : null}
      <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
        Cancel
      </Button>
    </div>
  )
}

type Props = {
  hook: UseApiBlockedMembersResult
  embed?: boolean
}

export default function SettingsBlockedSections({ hook, embed = false }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const loading = hook.status === 'loading' || hook.status === 'idle'
  const count = hook.items.length

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-dc-text">
        Blocked{loading ? '' : ` (${count})`}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-dc-muted">
          <span className="sr-only">Sort blocked list</span>
          <select
            className={settingsSelectClass}
            value={hook.sort}
            onChange={(e) => hook.setSort(e.target.value as BlockedSort)}
            aria-label="Sort blocked list"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
        {embed ?
          <TextInput
            type="search"
            placeholder="Search"
            value={hook.search}
            onChange={(e) => hook.setSearch(e.target.value)}
            className="max-w-[180px]"
          />
        : <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
            >
              Search
            </Button>
          </>
        }
      </div>
    </div>
  )

  const body = (
    <>
      {hook.error ? <StatusBanner tone="error">{hook.error}</StatusBanner> : null}
      {!embed && searchOpen ?
        <div className="mb-4">
          <TextInput
            type="search"
            placeholder="Search blocked members…"
            value={hook.search}
            onChange={(e) => hook.setSearch(e.target.value)}
            autoFocus
          />
        </div>
      : null}
      <BlockMemberForm onBlock={hook.block} busy={hook.busy} />
      {loading ?
        <DancecardPanelSkeleton lines={4} />
      : hook.items.length === 0 ?
        <p className="text-sm text-dc-muted">
          {hook.search.trim() ? 'No blocked members match your search.' : "You haven't blocked anyone."}
        </p>
      : <div className={embed ? 'space-y-2' : 'grid gap-4 sm:grid-cols-2'}>
          {hook.items.map((member) => (
            <BlockedMemberCard
              key={member.userId}
              member={member}
              busy={hook.busy}
              onUnblock={(username) => void hook.unblock(username)}
            />
          ))}
        </div>
      }
    </>
  )

  if (embed) {
    return (
      <div className="mt-6 space-y-3 border-t border-dc-border pt-6">
        <h3 className="text-sm font-semibold text-dc-text">Blocked members</h3>
        <p className="text-xs text-dc-muted">Blocked people cannot connect, follow, or message you.</p>
        {toolbar}
        {body}
      </div>
    )
  }

  return (
    <Panel>
      {toolbar}
      {body}
    </Panel>
  )
}
