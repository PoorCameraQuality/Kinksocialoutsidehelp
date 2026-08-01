import { useCallback, useEffect, useMemo, useState } from 'react'
import { getIsoReadiness } from '@c2k/shared'
import ProfileIsoEditor from '@/components/profile/ProfileIsoEditor'

type MeIso = {
  post: {
    body: string
    visibility: string
    structured?: unknown
  } | null
}

export default function PlaySpaceMyIsoPanel({
  slug,
  eventTitle,
  onOpenBoard,
}: {
  slug: string
  eventTitle?: string
  onOpenBoard?: () => void
}) {
  const key = encodeURIComponent(slug)
  const boardName = eventTitle?.trim() || 'this camp'
  const [listed, setListed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [listPrompt, setListPrompt] = useState(false)
  const [visibility, setVisibility] = useState('MEMBERS')
  const [body, setBody] = useState('')
  const [structured, setStructured] = useState<unknown>(null)
  const [hasSavedCard, setHasSavedCard] = useState(false)
  const [globalNoticeDismissed, setGlobalNoticeDismissed] = useState(false)

  const promptKey = `dc-iso-list-prompt-${slug}`
  const globalKey = `dc-iso-global-notice-${slug}`

  const readiness = useMemo(
    () => getIsoReadiness(structured, body, visibility),
    [structured, body, visibility],
  )

  const loadListed = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/play-spaces/${key}/iso-board/me`, { credentials: 'include' })
      if (!r.ok) return
      const d = (await r.json()) as { listed?: boolean }
      setListed(Boolean(d.listed))
    } catch {
      /* ignore */
    }
  }, [key])

  const loadIso = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/me/iso', { credentials: 'include' })
      if (!r.ok) return
      const d = (await r.json()) as MeIso
      if (d.post) {
        setBody(d.post.body ?? '')
        setVisibility(d.post.visibility ?? 'MEMBERS')
        setStructured(d.post.structured ?? null)
        setHasSavedCard(true)
      } else {
        setBody('')
        setStructured(null)
        setHasSavedCard(false)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadListed()
    void loadIso()
    try {
      if (localStorage.getItem(globalKey) === '1') setGlobalNoticeDismissed(true)
    } catch {
      /* ignore */
    }
  }, [loadListed, loadIso, globalKey])

  async function setListedState(next: boolean) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/play-spaces/${key}/iso-board/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed: next }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsg(j.error ?? 'Could not update board listing')
        return
      }
      setListed(next)
      setManageOpen(false)
      setListPrompt(false)
      setMsg(next ? `Listed on the ${boardName} ISO board.` : 'Removed from this board.')
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  const privateBlocked = visibility === 'PRIVATE'
  const canListHere = readiness.canList && !privateBlocked && hasSavedCard

  return (
    <div className="min-w-0 space-y-4 px-4 pb-4 sm:px-6">
      <header className="space-y-2">
        {eventTitle ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">{eventTitle}</p>
        ) : null}
        <div>
          <h2 className="text-[22px] font-semibold text-dc-text sm:text-[24px]">My ISO</h2>
          <p className="mt-0.5 text-[15px] text-dc-text-muted">Your scene card for this camp</p>
        </div>
        <p className="text-[14px] leading-relaxed text-dc-muted">
          Help people understand how to approach you and what they can comfortably ask about.
        </p>
        {!globalNoticeDismissed ? (
          <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
            <p className="text-[14px] font-medium text-dc-text">One card, wherever you list it</p>
            <p className="mt-1 text-[13px] leading-relaxed text-dc-muted">
              This is your personal ISO card. Changes made here also update it on your profile and other boards where
              it is listed.
            </p>
            {hasSavedCard ? (
              <button
                type="button"
                className="mt-2 text-[13px] font-medium text-dc-accent"
                onClick={() => {
                  setGlobalNoticeDismissed(true)
                  try {
                    localStorage.setItem(globalKey, '1')
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Got it
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-dc-muted">
            This is your profile ISO card. Changes apply everywhere.
          </p>
        )}
      </header>

      {hasSavedCard ? (
        <ListingBanner
          listed={listed}
          boardName={boardName}
          privateBlocked={privateBlocked}
          canList={canListHere}
          missing={readiness.missing}
          legacyBodyOnly={readiness.legacyBodyOnly}
          busy={busy}
          onList={() => void setListedState(true)}
          onOpenManage={() => setManageOpen(true)}
          onOpenBoard={onOpenBoard}
          onChangeVisibilityHint={() => {
            /* editor has Who can see this */
            document.getElementById('iso-section-posting')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      ) : null}

      {listPrompt && !listed && canListHere ? (
        <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
          <p className="text-[14px] font-medium text-dc-text">Your card is saved.</p>
          <p className="mt-1 text-[13px] text-dc-muted">
            Would you like it to appear on the {boardName} ISO board?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              onClick={() => {
                setListPrompt(false)
                try {
                  localStorage.setItem(promptKey, '1')
                } catch {
                  /* ignore */
                }
              }}
            >
              Not now
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
              onClick={() => {
                try {
                  localStorage.setItem(promptKey, '1')
                } catch {
                  /* ignore */
                }
                void setListedState(true)
              }}
            >
              List on this board
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p className="text-[13px] text-dc-muted" role="status">
          {msg}
        </p>
      ) : null}

      {readiness.legacyBodyOnly ? (
        <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
          <p className="text-[14px] font-medium text-dc-text">Make your ISO easier to browse</p>
          <p className="mt-1 text-[13px] text-dc-muted">
            Add roles, approach preferences, and scene ideas without removing what you already wrote.
          </p>
        </div>
      ) : null}

      <ProfileIsoEditor
        compact
        variant="play-space"
        hideChrome
        onDraftChange={(draft) => {
          setBody(draft.body)
          setVisibility(draft.visibility)
          setStructured(draft.structured)
          if (draft.hasPublished) setHasSavedCard(true)
        }}
        onSaved={(info) => {
          setHasSavedCard(true)
          void loadListed()
          void loadIso()
          try {
            if (localStorage.getItem(promptKey) !== '1' && !listed && info.ready) {
              setListPrompt(true)
            }
          } catch {
            /* ignore */
          }
        }}
      />

      {manageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Manage listing"
          onClick={() => setManageOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated p-4 shadow-[var(--dc-shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-dc-text">Your {boardName} listing</p>
            <p className="mt-2 text-[14px] leading-relaxed text-dc-muted">
              Your saved ISO card is currently visible on this Play Space’s board.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {onOpenBoard ? (
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-dc-border text-sm font-medium text-dc-accent"
                  onClick={() => {
                    setManageOpen(false)
                    onOpenBoard()
                  }}
                >
                  View board listing
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-full border border-dc-border text-sm font-medium text-dc-text disabled:opacity-50"
                onClick={() => void setListedState(false)}
              >
                Remove from this board
              </button>
              <button
                type="button"
                className="min-h-11 text-sm font-medium text-dc-muted"
                onClick={() => setManageOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ListingBanner({
  listed,
  boardName,
  privateBlocked,
  canList,
  missing,
  legacyBodyOnly,
  busy,
  onList,
  onOpenManage,
  onOpenBoard,
  onChangeVisibilityHint,
}: {
  listed: boolean
  boardName: string
  privateBlocked: boolean
  canList: boolean
  missing: string[]
  legacyBodyOnly: boolean
  busy: boolean
  onList: () => void
  onOpenManage: () => void
  onOpenBoard?: () => void
  onChangeVisibilityHint: () => void
}) {
  if (listed) {
    return (
      <section
        className="rounded-2xl border border-dc-border px-4 py-3"
        style={{
          background:
            'color-mix(in srgb, var(--dc-accent) 8%, var(--dc-elevated))',
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">Listed on this board</p>
        <p className="mt-1 text-[14px] text-dc-text">
          Your card appears on the {boardName} ISO board.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onOpenBoard ? (
            <button
              type="button"
              onClick={onOpenBoard}
              className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
            >
              View on ISO board
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenManage}
            className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
          >
            Manage listing
          </button>
        </div>
      </section>
    )
  }

  if (privateBlocked) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">
          Private cards cannot be listed
        </p>
        <p className="mt-1 text-[14px] text-dc-muted">
          Change visibility to Members or Public before listing on this board.
        </p>
        <button
          type="button"
          onClick={onChangeVisibilityHint}
          className="mt-3 min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent"
        >
          Change visibility
        </button>
      </section>
    )
  }

  if (!canList && !legacyBodyOnly) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">
          Finish the basics before listing
        </p>
        <p className="mt-1 text-[14px] text-dc-muted">Save a useful card before listing.</p>
        {missing.length ? (
          <ul className="mt-2 space-y-1 text-[13px] text-dc-muted">
            {missing.map((m) => (
              <li key={m}>○ {m}</li>
            ))}
          </ul>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dc-muted">Not listed on this board</p>
      <p className="mt-1 text-[14px] text-dc-muted">
        Your card is saved, but people browsing the {boardName} ISO board will not see it yet.
      </p>
      <button
        type="button"
        disabled={busy || !canList}
        onClick={onList}
        className="mt-3 min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
      >
        List on this board
      </button>
      <p className="mt-2 text-[12px] text-dc-muted">Visibility must be Members or Public to appear on the board.</p>
    </section>
  )
}
