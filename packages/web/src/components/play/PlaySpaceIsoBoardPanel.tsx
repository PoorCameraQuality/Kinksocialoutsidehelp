import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IsoBoardCard from '@/components/play/iso-board/IsoBoardCard'
import IsoBoardFilterSheet from '@/components/play/iso-board/IsoBoardFilterSheet'
import IsoBoardFullSheet, {
  type IsoBoardFullSource,
} from '@/components/play/iso-board/IsoBoardFullSheet'
import IsoPitchMessageSheet from '@/components/play/iso-board/IsoPitchMessageSheet'
import { useAuth } from '@/contexts/AuthContext'
import {
  EMPTY_ISO_BOARD_FILTERS,
  filterIsoBoardItems,
  filtersActive,
  normalizeIsoBoardItem,
  sortIsoBoardItems,
  tallyCommonIntoTags,
  type IsoBoardFilters,
  type IsoBoardPitch,
  type IsoBoardViewItem,
} from '@/lib/iso-board-view'
import { startIsoConversation } from '@/lib/iso-conversation'

type Props = {
  slug: string
  eventTitle?: string
  onEditIso?: () => void
}

type IsoRow = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  body: string
  structured?: unknown
  acceptDmsViaIso?: boolean
  staffRemoved?: boolean
}

const FILTER_THRESHOLD = 8

export default function PlaySpaceIsoBoardPanel({ slug, eventTitle, onEditIso }: Props) {
  const key = encodeURIComponent(slug)
  const boardName = eventTitle?.trim() || 'this camp'
  const navigate = useNavigate()
  const { viewerUsername } = useAuth()
  const [rawItems, setRawItems] = useState<IsoRow[]>([])
  const [listed, setListed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [msgErr, setMsgErr] = useState<string | null>(null)
  const [msgBusyUserId, setMsgBusyUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<IsoBoardFilters>(EMPTY_ISO_BOARD_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortMode, setSortMode] = useState<'default' | 'name'>('default')
  const [pitchSheetItem, setPitchSheetItem] = useState<IsoBoardViewItem | null>(null)
  const [fullSource, setFullSource] = useState<IsoBoardFullSource | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [boardR, meR] = await Promise.all([
        fetch(`/api/v1/play-spaces/${key}/iso-board`, { credentials: 'include' }),
        fetch(`/api/v1/play-spaces/${key}/iso-board/me`, { credentials: 'include' }),
      ])
      if (!boardR.ok) {
        setErr(
          boardR.status === 403
            ? 'Join this Play Space to view the ISO board.'
            : 'The ISO board could not be loaded.',
        )
        setRawItems([])
        return
      }
      const board = (await boardR.json()) as { items: IsoRow[] }
      setRawItems((board.items ?? []).filter((x) => !x.staffRemoved))
      if (meR.ok) {
        const me = (await meR.json()) as { listed?: boolean }
        setListed(Boolean(me.listed))
      }
    } catch {
      setErr('The ISO board could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(
    () =>
      rawItems
        .map((row) => normalizeIsoBoardItem(row, viewerUsername))
        .filter((x): x is IsoBoardViewItem => Boolean(x)),
    [rawItems, viewerUsername],
  )

  const commonTags = useMemo(() => tallyCommonIntoTags(rawItems, 6), [rawItems])
  const filtered = useMemo(
    () => sortIsoBoardItems(filterIsoBoardItems(items, filters), sortMode),
    [items, filters, sortMode],
  )
  const active = filtersActive(filters)
  const showFilters = items.length >= FILTER_THRESHOLD
  const selfItem = items.find((i) => i.isSelf)

  const scrollToSelf = () => {
    if (!selfItem) return
    const el = cardRefs.current.get(selfItem.userId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const sendMessage = async (item: IsoBoardViewItem, pitch?: IsoBoardPitch) => {
    if (item.isSelf) return
    setMsgErr(null)
    setMsgBusyUserId(item.userId)
    const result = await startIsoConversation({
      participantUsername: item.username,
      isoSubjectUserId: item.userId,
      pitchTitle: pitch?.title,
      displayName: item.displayName,
    })
    setMsgBusyUserId(null)
    setPitchSheetItem(null)
    if (!result.ok) {
      setMsgErr(result.error)
      return
    }
    navigate(`/messaging?c=${encodeURIComponent(result.conversationId)}`)
  }

  const onMessage = (item: IsoBoardViewItem, pitch?: IsoBoardPitch) => {
    if (!item.acceptsIsoMessages || item.isSelf) return
    if (pitch) {
      void sendMessage(item, pitch)
      return
    }
    if (item.pitches.length > 1) {
      setPitchSheetItem(item)
      return
    }
    void sendMessage(item, item.pitches[0])
  }

  if (loading) {
    return <p className="px-4 text-sm text-dc-muted sm:px-6">Loading ISO board…</p>
  }

  if (err) {
    return (
      <div className="space-y-3 px-4 sm:px-6">
        <p className="text-sm text-red-300">{err}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pb-6 sm:px-6">
      <header className="space-y-2">
        {eventTitle ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">{eventTitle}</p>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[22px] font-semibold text-dc-text sm:text-[24px]">ISO board</h2>
            <p className="mt-0.5 text-[15px] text-dc-text-muted">
              Scene cards listed for {boardName}
            </p>
          </div>
          {items.length > 0 ? (
            <p className="text-[13px] text-dc-muted">
              {active ? `${filtered.length} of ${items.length}` : `${items.length} listed`}
            </p>
          ) : null}
        </div>
        <p className="text-[14px] text-dc-muted">
          Scan by approach and scene ideas, then open a full ISO or start a conversation.
        </p>
      </header>

      <section className="mt-4 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">Your listing</p>
        {listed ? (
          <>
            <p className="mt-1 text-[14px] font-medium text-dc-text">✓ You’re listed on this board</p>
            <p className="mt-0.5 text-[13px] text-dc-muted">
              People at {boardName} can find your current ISO here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selfItem ? (
                <button
                  type="button"
                  onClick={scrollToSelf}
                  className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
                >
                  View your card
                </button>
              ) : null}
              {onEditIso ? (
                <button
                  type="button"
                  onClick={onEditIso}
                  className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
                >
                  Edit my ISO
                </button>
              ) : null}
            </div>
            {onEditIso ? (
              <button
                type="button"
                onClick={onEditIso}
                className="mt-2 text-[13px] font-medium text-dc-muted hover:text-dc-accent"
              >
                Edit or remove listing in My ISO ›
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-dc-text">Your ISO is not listed on this board.</p>
            {onEditIso ? (
              <button
                type="button"
                onClick={onEditIso}
                className="mt-3 min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
              >
                List my ISO
              </button>
            ) : null}
          </>
        )}
      </section>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-dc-border px-4 py-8 text-center">
          <p className="text-[16px] font-semibold text-dc-text">No one has listed an ISO yet</p>
          <p className="mt-1 text-[14px] text-dc-muted">
            Be the first to share how you would like people to approach and what you might enjoy.
          </p>
          {onEditIso ? (
            <button
              type="button"
              onClick={onEditIso}
              className="mt-4 min-h-11 rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
            >
              List my ISO
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {showFilters ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_ISO_BOARD_FILTERS)}
                  className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
                    !active
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                      : 'border-dc-border text-dc-muted'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  aria-pressed={filters.dmsOpen}
                  onClick={() => setFilters((f) => ({ ...f, dmsOpen: !f.dmsOpen }))}
                  className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
                    filters.dmsOpen
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                      : 'border-dc-border text-dc-muted'
                  }`}
                >
                  DMs open
                </button>
                <button
                  type="button"
                  aria-pressed={filters.hasSceneIdeas}
                  onClick={() => setFilters((f) => ({ ...f, hasSceneIdeas: !f.hasSceneIdeas }))}
                  className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
                    filters.hasSceneIdeas
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                      : 'border-dc-border text-dc-muted'
                  }`}
                >
                  Has scene ideas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="min-h-11 rounded-full border border-dc-border px-3 text-sm font-medium text-dc-accent"
                >
                  More filters
                </button>
                <label className="ml-auto flex min-h-11 items-center gap-2 text-[13px] text-dc-muted">
                  Sort
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value === 'name' ? 'name' : 'default')}
                    className="min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-2 text-sm text-dc-text"
                  >
                    <option value="default">Board order</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </label>
              </div>

              {active ? (
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-dc-muted">
                  <span>
                    {filtered.length} of {items.length} cards
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_ISO_BOARD_FILTERS)}
                    className="font-medium text-dc-accent"
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>
          ) : items.length > 0 ? (
            <p className="mt-4 text-[13px] text-dc-muted">
              {items.length} scene card{items.length === 1 ? '' : 's'} listed
            </p>
          ) : null}

          {msgErr ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {msgErr}
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-8 text-center">
              <p className="text-[16px] font-semibold text-dc-text">No cards match those filters</p>
              <p className="mt-1 text-[14px] text-dc-muted">
                Try removing a role, approach, or interest filter.
              </p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_ISO_BOARD_FILTERS)}
                className="mt-4 min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
              {filtered.map((item) => (
                <IsoBoardCard
                  key={item.userId}
                  item={item}
                  messagingBusy={msgBusyUserId === item.userId}
                  onEditIso={onEditIso}
                  cardRef={(el) => {
                    if (el) cardRefs.current.set(item.userId, el)
                    else cardRefs.current.delete(item.userId)
                  }}
                  onMessage={(pitch) => onMessage(item, pitch)}
                  onViewFull={() => {
                    const row = rawItems.find((r) => r.userId === item.userId)
                    setFullSource({
                      item,
                      body: row?.body ?? item.legacyExcerpt ?? '',
                      structured: row?.structured,
                      acceptDmsViaIso: row?.acceptDmsViaIso ?? item.acceptsIsoMessages,
                    })
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <IsoBoardFilterSheet
        open={filterOpen}
        filters={filters}
        commonTags={commonTags}
        matchCount={filtered.length}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_ISO_BOARD_FILTERS)}
        onClose={() => setFilterOpen(false)}
      />

      <IsoPitchMessageSheet
        open={Boolean(pitchSheetItem)}
        item={pitchSheetItem}
        busy={Boolean(pitchSheetItem && msgBusyUserId === pitchSheetItem.userId)}
        onClose={() => setPitchSheetItem(null)}
        onPick={(pitch) => {
          if (pitchSheetItem) void sendMessage(pitchSheetItem, pitch)
        }}
      />

      <IsoBoardFullSheet
        source={fullSource}
        onClose={() => setFullSource(null)}
        onEditIso={onEditIso}
        messagingBusy={Boolean(fullSource && msgBusyUserId === fullSource.item.userId)}
        onMessage={
          fullSource && !fullSource.item.isSelf
            ? () => {
                const item = fullSource.item
                setFullSource(null)
                onMessage(item)
              }
            : undefined
        }
      />
    </div>
  )
}
