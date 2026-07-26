import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'

export type OverflowAction = {
  label: string
  onClick: () => void
  destructive?: boolean
}

type Props = {
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  contextLine: string
  connectedBadge?: boolean
  children?: React.ReactNode
  overflow?: OverflowAction[]
}

export default function ConnectionPersonRow({
  username,
  displayName,
  avatarUrl,
  contextLine,
  connectedBadge,
  children,
  overflow,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const label = displayName?.trim() || username
  const showHandle = Boolean(username.trim())

  return (
    <li className="rounded-xl border border-dc-border bg-dc-elevated-solid p-3 shadow-[var(--dc-shadow-soft)] sm:rounded-2xl sm:p-4">
      <div className="flex gap-3 sm:items-start">
        <Link to={`/profile/${encodeURIComponent(username)}`} className="shrink-0">
          <UserAvatar avatarUrl={avatarUrl} alt="" size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/profile/${encodeURIComponent(username)}`}
                className="line-clamp-1 font-display text-sm font-semibold text-dc-text hover:text-dc-accent sm:text-base"
              >
                {label}
              </Link>
              {showHandle ?
                <p className="line-clamp-1 text-xs text-dc-muted">@{username}</p>
              : null}
              <p className="mt-0.5 text-[11px] leading-relaxed text-dc-text-muted sm:mt-1 sm:text-xs">{contextLine}</p>
            </div>
            {connectedBadge ?
              <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400/90">
                Connected
              </span>
            : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {children}
            {overflow && overflow.length > 0 ?
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-dc-border px-2 text-sm text-dc-text-muted hover:border-dc-accent-border hover:text-dc-text"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="More actions"
                >
                  ···
                </button>
                {menuOpen ?
                  <ul
                    role="menu"
                    className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg"
                  >
                    {overflow.map((action) => (
                      <li key={action.label} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false)
                            action.onClick()
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-dc-elevated-muted ${
                            action.destructive ? 'text-red-300' : 'text-dc-text'
                          }`}
                        >
                          {action.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                : null}
              </div>
            : null}
          </div>
        </div>
      </div>
    </li>
  )
}
