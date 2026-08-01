import {
  ISO_APPROACH,
  ISO_CAPACITY,
  ISO_MENU_TAGS,
  ISO_ROLE_TAGS,
  getIsoReadiness,
  normalizeIsoStructured,
} from '@c2k/shared'

export type IsoBoardPitch = { id?: string; title: string }

export type IsoBoardViewItem = {
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  isSelf: boolean
  roleIds: string[]
  roles: string[]
  capacity?: string
  approachId: string
  approachLabel: string
  pitches: IsoBoardPitch[]
  tagIds: string[]
  tags: string[]
  fallbackTags: string[]
  legacyExcerpt?: string
  acceptsIsoMessages: boolean
  searchBlob: string
}

export type IsoBoardFilters = {
  query: string
  roles: string[]
  approaches: string[]
  hasSceneIdeas: boolean
  tags: string[]
  dmsOpen: boolean
}

export const EMPTY_ISO_BOARD_FILTERS: IsoBoardFilters = {
  query: '',
  roles: [],
  approaches: [],
  hasSceneIdeas: false,
  tags: [],
  dmsOpen: false,
}

function labelOf(id: string, opts: readonly { id: string; label: string }[]) {
  return opts.find((o) => o.id === id)?.label ?? id
}

/** Human approach sentence for board cards. */
export function formatIsoApproachSentence(approachId: string, visualSignal: string): string {
  if (approachId === 'visual_signal' && visualSignal.trim()) {
    return `Look for ${visualSignal.trim()}`
  }
  switch (approachId) {
    case 'dms_open':
      return 'DMs open · no need to ask first'
    case 'ask_first':
      return 'Ask before sending a DM'
    case 'in_person':
      return 'Say hello in person'
    case 'visual_signal':
      return 'Look for their visual signal'
    default:
      return labelOf(approachId, ISO_APPROACH)
  }
}

export function normalizeIsoBoardItem(
  row: {
    userId: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    body: string
    structured?: unknown
    acceptDmsViaIso?: boolean
    staffRemoved?: boolean
  },
  viewerUsername: string | null | undefined,
): IsoBoardViewItem | null {
  if (row.staffRemoved) return null
  const s = normalizeIsoStructured(row.structured)
  const roleIds = s.roles
  const roles = roleIds.slice(0, 2).map((id) => labelOf(id, ISO_ROLE_TAGS))
  const capacity = labelOf(s.capacity, ISO_CAPACITY)
  const pitches = s.pitches
    .map((p) => ({ id: p.id, title: p.title.trim() }))
    .filter((p) => p.title)
  const tagIds = [...s.into, ...s.curious]
  const tags = tagIds.slice(0, 3).map((id) => labelOf(id, ISO_MENU_TAGS))
  const fallbackTags = s.into.slice(0, 4).map((id) => labelOf(id, ISO_MENU_TAGS))
  const hasStructuredDigest = roles.length > 0 || pitches.length > 0 || s.into.length > 0
  const legacyExcerpt =
    !hasStructuredDigest && row.body.trim() ? row.body.trim().slice(0, 160) : undefined
  const displayName = (row.displayName ?? row.username).trim() || row.username
  const approachLabel = formatIsoApproachSentence(s.approach, s.visualSignal)
  const searchBlob = [
    displayName,
    row.username,
    ...roles,
    ...pitches.map((p) => p.title),
    ...tagIds.map((id) => labelOf(id, ISO_MENU_TAGS)),
    approachLabel,
    legacyExcerpt ?? '',
  ]
    .join(' ')
    .toLowerCase()

  return {
    userId: row.userId,
    username: row.username,
    displayName,
    avatarUrl: row.avatarUrl ?? undefined,
    isSelf: Boolean(viewerUsername && viewerUsername.toLowerCase() === row.username.toLowerCase()),
    roleIds,
    roles,
    capacity,
    approachId: s.approach,
    approachLabel,
    pitches,
    tagIds,
    tags,
    fallbackTags,
    legacyExcerpt,
    acceptsIsoMessages: Boolean(row.acceptDmsViaIso),
    searchBlob,
  }
}

export function filtersActive(f: IsoBoardFilters): boolean {
  return Boolean(
    f.query.trim() ||
      f.roles.length ||
      f.approaches.length ||
      f.hasSceneIdeas ||
      f.tags.length ||
      f.dmsOpen,
  )
}

export function filterIsoBoardItems(items: IsoBoardViewItem[], f: IsoBoardFilters): IsoBoardViewItem[] {
  const q = f.query.trim().toLowerCase()
  return items.filter((item) => {
    if (q && !item.searchBlob.includes(q)) return false
    if (f.dmsOpen && !item.acceptsIsoMessages) return false
    if (f.hasSceneIdeas && item.pitches.length === 0) return false
    if (f.roles.length && !f.roles.some((r) => item.roleIds.includes(r))) return false
    if (f.approaches.length && !f.approaches.includes(item.approachId)) return false
    if (f.tags.length && !f.tags.some((t) => item.tagIds.includes(t))) return false
    return true
  })
}

export function tallyCommonIntoTags(
  rawItems: Array<{ structured?: unknown }>,
  max = 6,
): { id: string; label: string }[] {
  const counts = new Map<string, number>()
  for (const row of rawItems) {
    const s = normalizeIsoStructured(row.structured)
    for (const id of s.into) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => ({ id, label: labelOf(id, ISO_MENU_TAGS) }))
}

export function sortIsoBoardItems(
  items: IsoBoardViewItem[],
  mode: 'default' | 'name',
): IsoBoardViewItem[] {
  if (mode !== 'name') return items
  return [...items].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
}

export { getIsoReadiness }
