import { useCallback, useMemo, useState } from 'react'

export type MailIntakeListItem = {
  id: string
  mailbox: string
  fromName: string | null
  fromEmail: string
  subject: string
  receivedAt: string
  status: string
  priority: string
  assignedToUserId: string | null
  linkedUserId: string | null
  linkedModerationCaseId: string | null
  visibility: string
}

export type MailIntakeDetail = MailIntakeListItem & {
  toEmail: string
  plainTextBody: string | null
  sanitizedHtmlBody: string | null
  attachmentMetadata: Array<{ filename: string; contentType?: string; size?: number }>
  tab: string | null
}

export type MailIntakeTab = 'support' | 'legal' | 'business' | 'abuse' | 'security'

export function useApiMailIntake() {
  const [items, setItems] = useState<MailIntakeListItem[]>([])
  const [newCounts, setNewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    const r = await fetch('/api/v1/admin/mail-intake/summary', { credentials: 'include' })
    if (!r.ok) throw new Error('Could not load mail intake summary')
    const d = (await r.json()) as { newCounts?: Record<string, number> }
    setNewCounts(d.newCounts ?? {})
  }, [])

  const loadTab = useCallback(async (tab: MailIntakeTab) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/admin/mail-intake/${tab}`, { credentials: 'include' })
      if (!r.ok) throw new Error(r.status === 403 ? 'Forbidden' : 'Could not load mail intake')
      const d = (await r.json()) as { items?: MailIntakeListItem[] }
      setItems(d.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadItem = useCallback(async (id: string): Promise<MailIntakeDetail | null> => {
    const r = await fetch(`/api/v1/admin/mail-intake/item/${id}`, { credentials: 'include' })
    if (!r.ok) return null
    const d = (await r.json()) as { item?: MailIntakeDetail }
    return d.item ?? null
  }, [])

  const patchItem = useCallback(
    async (
      id: string,
      body: {
        status?: string
        priority?: string
        assignedToUserId?: string | null
        linkedUserId?: string | null
        linkedModerationCaseId?: string | null
        reason: string
      },
    ) => {
      const r = await fetch(`/api/v1/admin/mail-intake/item/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? 'Update failed')
      }
    },
    [],
  )

  return useMemo(
    () => ({ items, newCounts, loading, error, loadSummary, loadTab, loadItem, patchItem }),
    [items, newCounts, loading, error, loadSummary, loadTab, loadItem, patchItem],
  )
}
