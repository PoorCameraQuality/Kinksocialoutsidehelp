import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { stripHtml } from '@/lib/stripHtml'

export type HostedByOrg = {
  slug: string
  displayName: string
  logoUrl: string | null
  tagline: string | null
  isMember?: boolean
}

type Props = {
  org: HostedByOrg
  onMembershipChange?: (isMember: boolean) => void
  /** Compact stack for the event sidebar; default is the full-width card. */
  variant?: 'default' | 'sidebar'
}

export default function HostedByCard({ org, onMembershipChange, variant = 'default' }: Props) {
  const { isAuthenticated } = useAuth()
  const [isMember, setIsMember] = useState(Boolean(org.isMember))
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinMsg, setJoinMsg] = useState<string | null>(null)
  const rawTagline = org.tagline?.trim()
  const tagline = rawTagline ? (rawTagline.includes('<') ? stripHtml(rawTagline) : rawTagline) : null
  const sidebar = variant === 'sidebar'

  const joinOrg = async () => {
    if (!isAuthenticated) return
    setJoinBusy(true)
    setJoinMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${encodeURIComponent(org.slug)}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await r.json().catch(() => ({}))) as { error?: string; alreadyMember?: boolean }
      if (!r.ok) {
        setJoinMsg(body.error ?? 'Could not join')
        return
      }
      setIsMember(true)
      onMembershipChange?.(true)
      setJoinMsg(body.alreadyMember ? 'Already a member' : 'You joined this organization')
    } finally {
      setJoinBusy(false)
    }
  }

  if (sidebar) {
    return (
      <section aria-label="Hosted by">
        <div className="flex min-w-0 items-center gap-3">
          {org.logoUrl ?
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1 ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={org.logoUrl} alt="" className="h-full w-full object-contain" />
            </div>
          : <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dc-elevated-muted text-sm font-bold text-dc-accent ring-1 ring-white/10"
              aria-hidden
            >
              {org.displayName.slice(0, 1).toUpperCase()}
            </div>
          }
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">Hosted by</p>
            <p className="truncate text-sm font-semibold text-dc-text">{org.displayName}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Link
            to={`/orgs/${encodeURIComponent(org.slug)}`}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-dc-border px-3 text-xs font-semibold text-dc-text hover:bg-dc-elevated-muted"
          >
            View organization
          </Link>
          {!isMember ?
            isAuthenticated ?
              <button
                type="button"
                disabled={joinBusy}
                onClick={() => void joinOrg()}
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-dc-border px-3 text-xs text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text disabled:opacity-50"
              >
                {joinBusy ? 'Joining…' : 'Join organization'}
              </button>
            : <Link
                to={buildLoginHref('/conventions')}
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-dc-border px-3 text-xs text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                Sign in to join
              </Link>
          : <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200">
              You&apos;re a member
            </span>
          }
        </div>
        {joinMsg ? <p className="mt-2 text-xs text-dc-muted">{joinMsg}</p> : null}
      </section>
    )
  }

  return (
    <section
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-dc-border bg-dc-elevated-solid p-6 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Hosted by"
    >
      <div className="flex min-w-0 items-center gap-4">
        {org.logoUrl ?
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1.5 ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.logoUrl} alt="" className="h-full w-full object-contain" />
          </div>
        : <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-dc-elevated-muted text-lg font-bold text-dc-accent ring-1 ring-white/10"
            aria-hidden
          >
            {org.displayName.slice(0, 1).toUpperCase()}
          </div>
        }
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">Hosted by</p>
          <p className="truncate text-lg font-semibold text-dc-text">{org.displayName}</p>
          {tagline ? <p className="mt-1 line-clamp-2 text-sm text-dc-text-muted">{tagline}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/orgs/${encodeURIComponent(org.slug)}`}
            className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            View organization
          </Link>
          {!isMember ?
            isAuthenticated ?
              <button
                type="button"
                disabled={joinBusy}
                onClick={() => void joinOrg()}
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text disabled:opacity-50"
              >
                {joinBusy ? 'Joining…' : 'Join organization'}
              </button>
            : <Link
                to={buildLoginHref('/conventions')}
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                Sign in to join
              </Link>
          : <span className="inline-flex min-h-10 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200">
              You&apos;re a member
            </span>
          }
        </div>
        {joinMsg ? <p className="text-xs text-dc-muted sm:text-right">{joinMsg}</p> : null}
      </div>
    </section>
  )
}
