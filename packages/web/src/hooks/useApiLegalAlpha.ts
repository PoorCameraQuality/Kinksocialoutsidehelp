/**
 * Legal-alpha admin hooks (DMCA, contact, holds, privacy requests, step-up).
 * Public policy version lives in `usePolicyVersion.ts` (re-exported below for compat).
 */
import { useCallback, useMemo, useState } from 'react'

export type DmcaCaseRow = {
  id: string
  status: string
  claimantName: string
  claimantEmail: string
  workIdentified: string
  infringingUrl: string
  targetContentType: string | null
  targetContentId: string | null
  receivedAt: string
  resolvedAt: string | null
  repeatInfringerFlag: boolean
  notesPrivate: string | null
}

export type LegalRequestRow = {
  id: string
  requestType: string
  status: string
  subjectUserId: string | null
  receivedVia: string | null
  requesterName: string | null
  requesterAgency: string | null
  jurisdiction: string | null
  scopeSummary: string | null
  gagOrder: boolean
  userNoticeAllowed: boolean
  notes: string | null
  receivedAt: string
  dueAt: string | null
}

export type LegalHoldRow = {
  id: string
  legalRequestId: string | null
  targetType: string
  targetId: string
  active: boolean
  reason: string | null
  placedAt: string
  releasedAt: string | null
}

export type PrivacyRequestRow = {
  id: string
  requestType: string
  status: string
  requestedAt: string
  completedAt: string | null
}

export type ContactInquiryRow = {
  id: string
  status: string
  category: string
  subject: string
  senderName: string
  senderEmail: string
  message: string
  userId: string | null
  receivedAt: string
  notesPrivate: string | null
}

export class StepUpRequiredError extends Error {
  code = 'step_up_required' as const
  constructor() {
    super('Password step-up required')
    this.name = 'StepUpRequiredError'
  }
}

async function parseError(r: Response, fallback: string): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string }
  if (r.status === 403 && j.code === 'step_up_required') throw new StepUpRequiredError()
  return typeof j.error === 'string' ? j.error : fallback
}

export function useApiLegalAlpha() {
  const [dmcaCases, setDmcaCases] = useState<DmcaCaseRow[]>([])
  const [legalRequests, setLegalRequests] = useState<LegalRequestRow[]>([])
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequestRow[]>([])
  const [contactInquiries, setContactInquiries] = useState<ContactInquiryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDmcaCases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/v1/admin/dmca/cases', { credentials: 'include' })
      if (!r.ok) throw new Error(await parseError(r, 'Failed to load DMCA cases'))
      const data = (await r.json()) as { cases: DmcaCaseRow[] }
      setDmcaCases(data.cases)
    } catch (e) {
      if (e instanceof StepUpRequiredError) throw e
      setError(e instanceof Error ? e.message : 'Failed to load DMCA cases')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLegalRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/v1/admin/legal/requests', { credentials: 'include' })
      if (!r.ok) throw new Error(await parseError(r, 'Failed to load legal requests'))
      const data = (await r.json()) as { requests: LegalRequestRow[] }
      setLegalRequests(data.requests)
    } catch (e) {
      if (e instanceof StepUpRequiredError) throw e
      setError(e instanceof Error ? e.message : 'Failed to load legal requests')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPrivacyRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/v1/me/privacy/requests', { credentials: 'include' })
      if (!r.ok) throw new Error(await parseError(r, 'Failed to load privacy requests'))
      const data = (await r.json()) as { requests: PrivacyRequestRow[] }
      setPrivacyRequests(data.requests)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load privacy requests')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContactInquiries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/v1/admin/contact/inquiries', { credentials: 'include' })
      if (!r.ok) throw new Error(await parseError(r, 'Failed to load contact inquiries'))
      const data = (await r.json()) as { inquiries: ContactInquiryRow[] }
      setContactInquiries(data.inquiries)
    } catch (e) {
      if (e instanceof StepUpRequiredError) throw e
      setError(e instanceof Error ? e.message : 'Failed to load contact inquiries')
    } finally {
      setLoading(false)
    }
  }, [])

  const submitStepUp = useCallback(async (password: string) => {
    let r: Response
    try {
      r = await fetch('/api/v1/admin/security/step-up', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      throw new Error(
        'Could not reach the server. Check that the API is running (port 3001), refresh this page, and try again.'
      )
    }
    if (!r.ok) throw new Error(await parseError(r, 'Step-up failed'))
  }, [])

  const patchDmcaCase = useCallback(async (id: string, body: { status?: string; reason: string }) => {
    const r = await fetch(`/api/v1/admin/dmca/cases/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(await parseError(r, 'Update failed'))
    return (await r.json()) as { case: DmcaCaseRow }
  }, [])

  const dmcaAction = useCallback(async (id: string, action: 'disable' | 'restore', reason: string) => {
    const r = await fetch(`/api/v1/admin/dmca/cases/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!r.ok) throw new Error(await parseError(r, 'Action failed'))
    return (await r.json()) as { case: DmcaCaseRow }
  }, [])

  const createLegalRequest = useCallback(
    async (body: Record<string, unknown> & { reason: string }) => {
      const r = await fetch('/api/v1/admin/legal/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Create failed'))
      return (await r.json()) as { request: LegalRequestRow }
    },
    []
  )

  const createLegalHold = useCallback(
    async (requestId: string, body: { targetType: string; targetId: string; reason: string }) => {
      const r = await fetch(`/api/v1/admin/legal/requests/${requestId}/holds`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Hold failed'))
      return (await r.json()) as { hold: LegalHoldRow }
    },
    []
  )

  const patchContactInquiry = useCallback(
    async (id: string, body: { status?: string; notesPrivate?: string; reason: string }) => {
      const r = await fetch(`/api/v1/admin/contact/inquiries/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await parseError(r, 'Update failed'))
      return (await r.json()) as { inquiry: ContactInquiryRow }
    },
    []
  )

  const createPrivacyRequest = useCallback(async (requestType: 'EXPORT_JSON' | 'DEACTIVATE' | 'DELETE') => {
    const r = await fetch('/api/v1/me/privacy/requests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType }),
    })
    const data = (await r.json().catch(() => ({}))) as {
      request?: PrivacyRequestRow
      error?: string
      code?: string
    }
    if (!r.ok) {
      if (data.request) return { blocked: true as const, request: data.request }
      if (r.status === 403 && data.code === 'step_up_required') throw new StepUpRequiredError()
      throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
    }
    return { blocked: false as const, request: data.request! }
  }, [])

  const downloadExport = useCallback(async (id: string) => {
    const r = await fetch(`/api/v1/me/privacy/export/${id}`, { credentials: 'include' })
    if (!r.ok) throw new Error(await parseError(r, 'Download failed'))
    return (await r.json()) as { export: Record<string, unknown>; requestId: string }
  }, [])

  return useMemo(
    () => ({
      dmcaCases,
      legalRequests,
      privacyRequests,
      contactInquiries,
      loading,
      error,
      loadDmcaCases,
      loadLegalRequests,
      loadPrivacyRequests,
      loadContactInquiries,
      submitStepUp,
      patchDmcaCase,
      dmcaAction,
      createLegalRequest,
      createLegalHold,
      patchContactInquiry,
      createPrivacyRequest,
      downloadExport,
    }),
    [
      dmcaCases,
      legalRequests,
      privacyRequests,
      contactInquiries,
      loading,
      error,
      loadDmcaCases,
      loadLegalRequests,
      loadPrivacyRequests,
      loadContactInquiries,
      submitStepUp,
      patchDmcaCase,
      dmcaAction,
      createLegalRequest,
      createLegalHold,
      patchContactInquiry,
      createPrivacyRequest,
      downloadExport,
    ],
  )
}

/** @deprecated Import from `@/hooks/usePolicyVersion`. */
export { usePolicyVersion } from './usePolicyVersion'
