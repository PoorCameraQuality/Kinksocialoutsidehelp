/**
 * Convention participation opportunities (presenter/vendor/staff/volunteer pathways).
 *
 * `GET /api/v1/conventions/:slug/participation` (credentials). Disabled when slug is null.
 * Returns pathway open/apply URLs plus the signed-in viewer’s pending offers when present.
 */
import { useCallback, useEffect, useState } from 'react'

export type ParticipationPathway = {
  open: boolean
  applyUrl: string | null
  introHtml?: string | null
}

export type ParticipationOffer = {
  id: string
  status: string
  letterText: string | null
  letterHtml: string | null
  accessCode: string | null
  boothLabel: string | null
  feeCents: number | null
  feeInstructions: string | null
  expectedHours: number | null
  expiresAt: string | null
  sourceType: string
  sentAt: string | null
}

export type TrustedRolePathway = {
  id: string
  name: string
  roleKind: string
  applySlug: string
  open: boolean
  applyUrl: string
  introHtml?: string | null
}

export type ParticipationOpportunities = {
  convention: { id: string; slug: string; name: string }
  pathways: {
    present: ParticipationPathway
    vendor: ParticipationPathway
    staff: ParticipationPathway
    volunteer: ParticipationPathway
  }
  /** Published trusted roles — mirrors organizer Applications windows on the public page. */
  trustedRoles?: TrustedRolePathway[]
  myStatus: {
    presenterPending?: boolean
    pendingOffers?: number
    offers?: ParticipationOffer[]
    myOffersUrl?: string
  } | null
}

const API = '/api/v1'

export function useApiConventionParticipation(conventionSlug: string | null) {
  const [data, setData] = useState<ParticipationOpportunities | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!conventionSlug) return
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(
        `${API}/public/conventions/${encodeURIComponent(conventionSlug)}/participation-opportunities`,
        { credentials: 'include' },
      )
      const j = (await r.json().catch(() => ({}))) as ParticipationOpportunities & { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not load participation options.')
        setData(null)
        return
      }
      setData(j)
    } catch {
      setErr('Network error.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [conventionSlug])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, err, reload }
}

export async function submitPresenterApplications(
  conventionSlug: string,
  offerings: Array<{ presenterOfferingId: string; roomNeeds?: string; materialNeeds?: string }>,
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionSlug)}/presenter-requests`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerings }),
    },
  )
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) return { ok: false, error: j.error ?? 'Submit failed' }
  return { ok: true }
}

export async function submitVendorApplication(
  conventionSlug: string,
  body: {
    productSummary: string
    boothPreferences?: string
    powerNeeds?: string
    hours?: string
    url?: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(
    `${API}/public/conventions/${encodeURIComponent(conventionSlug)}/vendor-applications`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) return { ok: false, error: j.error ?? 'Submit failed' }
  return { ok: true }
}

export async function loadMyParticipationOffers(conventionSlug: string): Promise<ParticipationOffer[]> {
  const r = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionSlug)}/me/participation-offers`,
    { credentials: 'include' },
  )
  const j = (await r.json().catch(() => ({}))) as { offers?: ParticipationOffer[] }
  if (!r.ok) return []
  return j.offers ?? []
}

export async function acceptParticipationOffer(
  conventionSlug: string,
  offerId: string,
): Promise<{ ok: boolean; registerUrl?: string; error?: string }> {
  const r = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionSlug)}/participation-offers/${encodeURIComponent(offerId)}/accept`,
    { method: 'POST', credentials: 'include' },
  )
  const j = (await r.json().catch(() => ({}))) as { registerUrl?: string; error?: string }
  if (!r.ok) return { ok: false, error: j.error ?? 'Accept failed' }
  return { ok: true, registerUrl: j.registerUrl }
}

export async function declineParticipationOffer(
  conventionSlug: string,
  offerId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionSlug)}/participation-offers/${encodeURIComponent(offerId)}/decline`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  )
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) return { ok: false, error: j.error ?? 'Decline failed' }
  return { ok: true }
}

export async function createAndSendParticipationOffer(
  conventionKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const createR = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionKey)}/participation-offers`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const created = (await createR.json().catch(() => ({}))) as { offer?: { id: string }; error?: string }
  if (!createR.ok) return { ok: false, error: created.error ?? 'Could not create offer' }
  const offerId = created.offer?.id
  if (!offerId) return { ok: false, error: 'No offer id returned' }
  const sendR = await fetch(
    `${API}/conventions/${encodeURIComponent(conventionKey)}/participation-offers/${encodeURIComponent(offerId)}/send`,
    { method: 'POST', credentials: 'include' },
  )
  const sent = (await sendR.json().catch(() => ({}))) as { error?: string }
  if (!sendR.ok) return { ok: false, error: sent.error ?? 'Could not send offer' }
  return { ok: true }
}
