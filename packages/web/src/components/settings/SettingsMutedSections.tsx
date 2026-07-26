import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import Button from '@/components/ui/Button'
import SectionHeader from '@/components/ui/SectionHeader'
import StatusBanner from '@/components/ui/StatusBanner'
import TextInput from '@/components/ui/TextInput'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import type { ApiMutedTag } from '@/hooks/useApiMutedTags'
import type { UseApiMutesResult } from '@/hooks/useApiMutes'

type TagSectionProps = {
  items: ApiMutedTag[]
  loading: boolean
  error: string | null
  onMute: (targetId: string) => Promise<boolean>
  onUnmute: (muteId: string) => void
  muteBusy: boolean
  unmuteBusy: boolean
}

type MemberSectionProps = {
  hook: UseApiMutesResult
}

type GroupSectionProps = {
  hook: UseApiMutesResult
}

function MuteListRow({
  label,
  sublabel,
  href,
  onUnmute,
  unmuteBusy,
}: {
  label: string
  sublabel?: string | null
  href?: string | null
  onUnmute: () => void
  unmuteBusy: boolean
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dc-border bg-dc-elevated/40 px-3 py-2">
      <div className="min-w-0">
        {href ?
          <Link to={href} className="text-sm font-medium text-dc-text hover:text-dc-accent">
            {label}
          </Link>
        : <span className="text-sm font-medium text-dc-text">{label}</span>}
        {sublabel ? <p className="text-xs text-dc-muted">{sublabel}</p> : null}
      </div>
      <Button type="button" variant="secondary" disabled={unmuteBusy} onClick={onUnmute}>
        Unmute
      </Button>
    </li>
  )
}

function SettingsMutedTagsSection({
  items,
  loading,
  error,
  onMute,
  onUnmute,
  muteBusy,
  unmuteBusy,
}: TagSectionProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; slug: string; displayName: string }>>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const mutedTagIds = new Set(items.map((m) => m.targetId))

  useEffect(() => {
    const term = query.trim()
    if (!showAdd || term.length < 2) {
      setResults([])
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const r = await fetch(`/api/kink-tags?q=${encodeURIComponent(term)}&limit=20`, { credentials: 'include' })
          if (!r.ok) {
            setResults([])
            return
          }
          const data = (await r.json()) as { tags?: Array<{ id: string; slug: string; displayName: string }> }
          setResults(data.tags ?? [])
        } catch {
          setResults([])
        } finally {
          setSearchBusy(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query, showAdd])

  const addTag = async (tagId: string, label: string) => {
    setNotice(null)
    const ok = await onMute(tagId)
    if (ok) {
      setNotice(`Muted ${label}.`)
      setQuery('')
      setResults([])
    } else {
      setNotice('Could not mute that tag.')
    }
  }

  return (
    <Panel className="scroll-mt-24">
      <SectionHeader
        eyebrow="Feed"
        title="Muted tags"
        description="Hide content tagged with specific interests from your feeds and tag browse."
      />
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {loading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : items.length === 0 ?
        <p className="mt-4 text-sm text-dc-muted">You haven&apos;t muted any tags.</p>
      : <ul className="mt-4 space-y-2">
          {items.map((mute) => {
            const label = mute.tag?.displayName ?? mute.tag?.slug ?? 'Unknown tag'
            const slug = mute.tag?.slug
            return (
              <MuteListRow
                key={mute.id}
                label={label}
                sublabel={slug ? `#${slug}` : null}
                href={slug ? `/tags/${encodeURIComponent(slug)}` : null}
                onUnmute={() => onUnmute(mute.id)}
                unmuteBusy={unmuteBusy}
              />
            )
          })}
        </ul>
      }
      <div className="mt-4 border-t border-dc-border pt-4">
        {showAdd ?
          <div className="space-y-3">
            <TextInput
              type="search"
              placeholder="Search interest tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {notice ? <p className="text-xs text-dc-muted">{notice}</p> : null}
            {searchBusy ?
              <p className="text-xs text-dc-muted">Searching…</p>
            : results.length > 0 ?
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-dc-border bg-dc-elevated/30 p-2">
                {results.map((tag) => {
                  const already = mutedTagIds.has(tag.id)
                  return (
                    <li key={tag.id}>
                      <button
                        type="button"
                        disabled={already || muteBusy}
                        onClick={() => void addTag(tag.id, tag.displayName)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-dc-elevated disabled:opacity-50"
                      >
                        <span className="text-dc-text">{tag.displayName}</span>
                        <span className="text-xs text-dc-muted">{already ? 'Muted' : 'Mute'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            : query.trim().length >= 2 ?
              <p className="text-xs text-dc-muted">No matching tags.</p>
            : <p className="text-xs text-dc-muted">Type at least two characters to search.</p>}
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Done
            </Button>
          </div>
        : <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
            + Add tags
          </Button>
        }
      </div>
    </Panel>
  )
}

function SettingsMutedMembersSection({ hook }: MemberSectionProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [username, setUsername] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const addMember = async () => {
    const u = username.trim().replace(/^@/, '')
    if (!u || hook.muteBusy) return
    setNotice(null)
    try {
      const profileRes = await fetch(`/api/profile/${encodeURIComponent(u)}`, { credentials: 'include' })
      if (!profileRes.ok) {
        setNotice(profileRes.status === 404 ? 'Member not found.' : 'Could not look up that member.')
        return
      }
      const profile = (await profileRes.json()) as { user?: { id: string; username: string } }
      if (!profile.user?.id) {
        setNotice('Could not resolve that member.')
        return
      }
      const ok = await hook.mute(profile.user.id)
      if (ok) {
        setUsername('')
        setNotice(`Muted @${profile.user.username}.`)
        setShowAdd(false)
      } else {
        setNotice('Could not mute that member.')
      }
    } catch {
      setNotice('Network error.')
    }
  }

  const loading = hook.status === 'loading' || hook.status === 'idle'

  return (
    <Panel>
      <SectionHeader
        eyebrow="Feed"
        title="Muted members"
        description="Hide a member's activity from your feeds without blocking messages."
      />
      {hook.error ? <StatusBanner tone="error">{hook.error}</StatusBanner> : null}
      {loading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : hook.items.length === 0 ?
        <p className="mt-4 text-sm text-dc-muted">You haven&apos;t muted anyone.</p>
      : <ul className="mt-4 space-y-2">
          {hook.items.map((mute) => {
            const label = mute.user?.displayName ?? mute.user?.username ?? 'Unknown member'
            const uname = mute.user?.username
            return (
              <MuteListRow
                key={mute.id}
                label={label}
                sublabel={uname ? `@${uname}` : null}
                href={uname ? `/profile/${encodeURIComponent(uname)}` : null}
                onUnmute={() => void hook.unmute(mute.id)}
                unmuteBusy={hook.unmuteBusy}
              />
            )
          })}
        </ul>
      }
      <div className="mt-4 border-t border-dc-border pt-4">
        {showAdd ?
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <Button type="button" disabled={hook.muteBusy || !username.trim()} onClick={() => void addMember()}>
                Mute
              </Button>
            </div>
            {notice ? <p className="text-xs text-dc-muted">{notice}</p> : null}
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        : <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
            + Add member
          </Button>
        }
      </div>
    </Panel>
  )
}

function SettingsMutedGroupsSection({ hook }: GroupSectionProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; slug: string; name: string }>>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const mutedGroupIds = new Set(hook.items.map((m) => m.targetId))

  const searchGroups = useCallback(async (term: string) => {
    setSearchBusy(true)
    try {
      const r = await fetch('/api/v1/groups', { credentials: 'include' })
      if (!r.ok) {
        setResults([])
        return
      }
      const data = (await r.json()) as { items?: Array<{ id: string; slug: string; name: string }> }
      const lower = term.toLowerCase()
      const filtered = (data.items ?? [])
        .filter((g) => g.name.toLowerCase().includes(lower) || g.slug.toLowerCase().includes(lower))
        .slice(0, 20)
      setResults(filtered)
    } catch {
      setResults([])
    } finally {
      setSearchBusy(false)
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!showAdd || term.length < 2) {
      setResults([])
      return
    }
    const handle = window.setTimeout(() => {
      void searchGroups(term)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query, showAdd, searchGroups])

  const addGroup = async (groupId: string, name: string) => {
    setNotice(null)
    const ok = await hook.mute(groupId)
    if (ok) {
      setNotice(`Muted ${name}.`)
      setQuery('')
      setResults([])
    } else {
      setNotice('Could not mute that group.')
    }
  }

  const loading = hook.status === 'loading' || hook.status === 'idle'

  return (
    <Panel>
      <SectionHeader
        eyebrow="Feed"
        title="Muted groups"
        description="Hide a group's discussions and announcements from your activity feeds."
      />
      {hook.error ? <StatusBanner tone="error">{hook.error}</StatusBanner> : null}
      {loading ?
        <div className="mt-4">
          <DancecardPanelSkeleton lines={2} />
        </div>
      : hook.items.length === 0 ?
        <p className="mt-4 text-sm text-dc-muted">You haven&apos;t muted any groups.</p>
      : <ul className="mt-4 space-y-2">
          {hook.items.map((mute) => {
            const name = mute.group?.name ?? 'Unknown group'
            const slug = mute.group?.slug
            return (
              <MuteListRow
                key={mute.id}
                label={name}
                sublabel={slug ? slug : null}
                href={slug ? `/groups/${encodeURIComponent(slug)}` : null}
                onUnmute={() => void hook.unmute(mute.id)}
                unmuteBusy={hook.unmuteBusy}
              />
            )
          })}
        </ul>
      }
      <div className="mt-4 border-t border-dc-border pt-4">
        {showAdd ?
          <div className="space-y-3">
            <TextInput
              type="search"
              placeholder="Search groups by name or slug…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {notice ? <p className="text-xs text-dc-muted">{notice}</p> : null}
            {searchBusy ?
              <p className="text-xs text-dc-muted">Searching…</p>
            : results.length > 0 ?
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-dc-border bg-dc-elevated/30 p-2">
                {results.map((group) => {
                  const already = mutedGroupIds.has(group.id)
                  return (
                    <li key={group.id}>
                      <button
                        type="button"
                        disabled={already || hook.muteBusy}
                        onClick={() => void addGroup(group.id, group.name)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-dc-elevated disabled:opacity-50"
                      >
                        <span className="text-dc-text">{group.name}</span>
                        <span className="text-xs text-dc-muted">{already ? 'Muted' : 'Mute'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            : query.trim().length >= 2 ?
              <p className="text-xs text-dc-muted">No matching groups you can see.</p>
            : <p className="text-xs text-dc-muted">Type at least two characters to search.</p>}
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Done
            </Button>
          </div>
        : <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
            + Add group
          </Button>
        }
      </div>
    </Panel>
  )
}

type Props = {
  mutedTags: ApiMutedTag[]
  mutedTagsLoading: boolean
  mutedTagsError: string | null
  onMuteTag: (targetId: string) => Promise<boolean>
  onUnmuteTag: (muteId: string) => void
  muteTagBusy: boolean
  unmuteTagBusy: boolean
  mutedMembers: UseApiMutesResult
  mutedGroups: UseApiMutesResult
}

export default function SettingsMutedSections({
  mutedTags,
  mutedTagsLoading,
  mutedTagsError,
  onMuteTag,
  onUnmuteTag,
  muteTagBusy,
  unmuteTagBusy,
  mutedMembers,
  mutedGroups,
}: Props) {
  return (
    <div className="space-y-6">
      <SettingsMutedTagsSection
        items={mutedTags}
        loading={mutedTagsLoading}
        error={mutedTagsError}
        onMute={onMuteTag}
        onUnmute={onUnmuteTag}
        muteBusy={muteTagBusy}
        unmuteBusy={unmuteTagBusy}
      />
      <SettingsMutedGroupsSection hook={mutedGroups} />
      <SettingsMutedMembersSection hook={mutedMembers} />
    </div>
  )
}
