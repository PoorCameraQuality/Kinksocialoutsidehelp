import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ConventionCommandPermissions } from '@c2k/shared'
import ConventionOrganizerClient from '@/components/organizer/convention/ConventionOrganizerClient'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

type OrgDetail = {
  slug: string
  displayName: string
  viewerRole: string | null
}

type ConventionDetail = {
  slug: string
  name: string
  timezone: string
  startsAt: string
  endsAt: string
}

type CommandAccessResponse = {
  permissions?: ConventionCommandPermissions
  hasAnyAccess?: boolean
}

function parseConventionPayload(raw: unknown): {
  slug: string
  name: string
  timezone: string
  startsAt: string
  endsAt: string
  organizationSummary?: { slug?: string } | null
} | null {
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  const conv =
    root.convention && typeof root.convention === 'object'
      ? (root.convention as Record<string, unknown>)
      : root
  const slug = typeof conv.slug === 'string' ? conv.slug : null
  const name = typeof conv.name === 'string' ? conv.name : null
  const timezone = typeof conv.timezone === 'string' ? conv.timezone : 'America/New_York'
  const startsAt =
    typeof conv.startsAt === 'string'
      ? conv.startsAt
      : conv.startsAt instanceof Date
        ? conv.startsAt.toISOString()
        : null
  const endsAt =
    typeof conv.endsAt === 'string'
      ? conv.endsAt
      : conv.endsAt instanceof Date
        ? conv.endsAt.toISOString()
        : null
  if (!slug || !name || !startsAt || !endsAt) return null
  const organizationSummary =
    root.organizationSummary && typeof root.organizationSummary === 'object'
      ? (root.organizationSummary as { slug?: string })
      : (root.organizationSummary as null | undefined)
  return { slug, name, timezone, startsAt, endsAt, organizationSummary }
}

function formatConventionWindow(startsAt: string, endsAt: string, timezone: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return timezone
  }
  return `${timezone} · ${start.toLocaleString()} – ${end.toLocaleString()}`
}

async function fetchCommandAccess(
  convSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(convSlug)}/organizer/command-access`, {
      credentials: 'include',
    })
    if (r.status === 403) {
      return {
        ok: false,
        message:
          'You do not have Event Systems access for this convention. Ask an org owner or admin for a team grant.',
      }
    }
    if (!r.ok) {
      return { ok: false, message: 'Could not verify dashboard access.' }
    }
    const j = (await r.json()) as CommandAccessResponse
    if (j.hasAnyAccess === false) {
      return { ok: false, message: 'You do not have Event Systems access for this convention.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Network error verifying access.' }
  }
}

export default function OrganizerConventionPageClient() {
  const { slug: orgSlug = '', convSlug = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isFallback, status } = useAuth()

  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [convention, setConvention] = useState<ConventionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const scheduleHref = useMemo(
    () => `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule`,
    [orgSlug],
  )

  useEffect(() => {
    if (status !== 'ready') return
    if (!isAuthenticated || isFallback) {
      navigate(buildLoginHref(`/organizer/orgs/${orgSlug}/conventions/${convSlug}`), { replace: true })
    }
  }, [status, isAuthenticated, isFallback, navigate, orgSlug, convSlug])

  useEffect(() => {
    if (!orgSlug || !convSlug) return
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const [orgRes, convRes] = await Promise.all([
          fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, { credentials: 'include' }),
          fetch(`/api/v1/conventions/${encodeURIComponent(convSlug)}`, { credentials: 'include' }),
        ])
        if (!orgRes.ok) {
          if (!cancelled) setLoadError('Organization not found or not visible to you.')
          return
        }
        const orgJson = (await orgRes.json()) as { organization: OrgDetail }
        const o = orgJson.organization
        if (!o.viewerRole) {
          if (!cancelled) setLoadError('You must belong to this organization to use the organizer dashboard.')
          return
        }
        if (!convRes.ok) {
          if (!cancelled) setLoadError('Convention not found.')
          return
        }
        const convJson = await convRes.json()
        const parsed = parseConventionPayload(convJson)
        if (!parsed) {
          if (!cancelled) setLoadError('Convention data was incomplete.')
          return
        }
        const ownerSlug = parsed.organizationSummary?.slug ?? null
        if (ownerSlug !== orgSlug) {
          if (!cancelled) setLoadError('This convention does not belong to that organization.')
          return
        }
        const access = await fetchCommandAccess(convSlug)
        if (!access.ok) {
          if (!cancelled) setLoadError(access.message ?? 'Access denied.')
          return
        }
        if (!cancelled) {
          setOrg(o)
          setConvention({
            slug: parsed.slug,
            name: parsed.name,
            timezone: parsed.timezone,
            startsAt: parsed.startsAt,
            endsAt: parsed.endsAt,
          })
        }
      } catch {
        if (!cancelled) setLoadError('Network error loading convention.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug, convSlug])

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-dc-text-muted">{loadError}</p>
        <Link to="/organizer" className="mt-4 inline-block text-dc-accent hover:underline">
          Back to organizer hub
        </Link>
      </div>
    )
  }

  if (!org || !convention) {
    return <div className="mx-auto max-w-7xl px-4 py-12 h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
  }

  return (
    <OrganizerAppShell
      scopeKind="convention"
      eyebrow="Convention dashboard"
      title={convention.name}
      subtitle={formatConventionWindow(convention.startsAt, convention.endsAt, convention.timezone)}
      roleBadge={org.viewerRole}
      publicHubHref={`/conventions/${encodeURIComponent(convSlug)}`}
      breadcrumbs={[
        { label: 'Organizer', href: '/organizer' },
        { label: org.displayName, href: `/organizer/orgs/${encodeURIComponent(orgSlug)}` },
        { label: 'Events & conventions', href: scheduleHref },
        { label: convention.name },
      ]}
      statusBarLeft={<span>/{convention.slug}</span>}
    >
      <ConventionOrganizerClient conventionSlug={convSlug} orgSlug={orgSlug} />
    </OrganizerAppShell>
  )
}
