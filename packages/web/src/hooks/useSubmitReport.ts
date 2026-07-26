import { useCallback, useState } from 'react'
import type { PolicyReason } from '@c2k/shared'

export type SubmitReportInput = {
  targetType: string
  targetId: string
  policyReason: PolicyReason
  body?: string
  /** Optional intake context forwarded to the API when supported. */
  context?: Record<string, unknown>
}

export type SubmitReportResult = {
  caseId: string
  reportId: string
  queue: string
  severity: string
  status: string
  duplicate: boolean
  requiresRetriage?: boolean
}

export type UseSubmitReportResult = {
  submit: (input: SubmitReportInput) => Promise<SubmitReportResult>
  busy: boolean
  error: string | null
  resetError: () => void
}

export function useSubmitReport(): UseSubmitReportResult {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetError = useCallback(() => setError(null), [])

  const submit = useCallback(async (input: SubmitReportInput): Promise<SubmitReportResult> => {
    setError(null)
    setBusy(true)
    try {
      const r = await fetch('/api/v1/moderation/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: input.targetType,
          targetId: input.targetId,
          policyReason: input.policyReason,
          body: input.body?.trim() || undefined,
          ...(input.context ? { context: input.context } : {}),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as SubmitReportResult & { error?: string }
      if (!r.ok) {
        const msg = j.error ?? 'Could not submit report'
        setError(msg)
        throw new Error(msg)
      }
      return j
    } catch (err) {
      if (err instanceof Error && err.message !== 'Could not submit report') {
        setError('Network error')
      }
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  return { submit, busy, error, resetError }
}
