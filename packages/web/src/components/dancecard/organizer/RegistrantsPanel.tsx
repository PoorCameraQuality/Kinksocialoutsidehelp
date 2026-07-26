'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { OrganizerApiError, organizerConventionApiBase, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import {
  organizerTabHref,
  REGISTRANT_PARAM,
  useOrganizerSubPath,
  useOrganizerWorkspacePath,
} from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { InlineSuccessBanner, useConfirmDialog, EntityPickerModal, type EntityPickerOption } from '@/components/dancecard/organizer/ui'
import { checkInTimingLabel, type CheckInEligibility, type CheckInTiming } from '@/lib/dancecard/registrantCheckIn'
import { RegistrantsMasterDetail } from '@/components/dancecard/organizer/registrants/RegistrantsMasterDetail'
import type { ConventionCommandPermissions } from '@c2k/shared'
import {
  canEditVettingSafetyNotes,
  canSeeRegistrantInternalNotes,
} from '@/lib/dancecard/conventionCommandPermissions'
import { copy } from '@/lib/dancecard/productCopy'
import { ImportSignupsMenu } from '@/components/dancecard/organizer/people/ImportSignupsMenu'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'
import { PEOPLE_ACTION_PARAM } from '@/components/dancecard/organizer/people/peopleHubConfig'

type RegRow = {
  id: string
  categoryId: string
  categoryName: string | null
  personId: string | null
  status: string
  sceneDisplayName: string
  email: string | null
  legalName: string | null
  internalNotes: string | null
  vettingStatus: string
  vettingSafetyNotes: string | null
  pronouns: string | null
  externalSource: string | null
  externalId: string | null
  lastSyncedAt: string | null
  createdAt: string
  checkInValidFrom: string | null
  checkInValidThrough: string | null
  checkInEligibility: CheckInEligibility
  checkInTiming: CheckInTiming | null
  checkedInAt: string | null
  /** Linked convention_persons row when synced from the same Kink Social user. */
  directoryPersonId?: string | null
}

type CheckInTone = 'gold' | 'blue' | 'red' | 'neutral'

function rowCheckInTone(r: RegRow): CheckInTone {
  if (r.status === 'checked_in') {
    if (r.checkInTiming === 'late') return 'blue'
    if (r.checkInTiming === 'early_override') return 'red'
    return 'gold'
  }
  if (r.checkInEligibility === 'early') return 'red'
  if (r.checkInEligibility === 'late') return 'blue'
  return 'neutral'
}

const TONE_CLASS: Record<CheckInTone, { status: string; button: string; pill: string }> = {
  gold: {
    status: 'font-medium text-dc-accent-hover',
    button:
      'min-h-10 border-dc-accent-border/50 px-3 py-2 text-dc-accent-hover hover:bg-dc-accent-muted',
    pill: 'border-dc-accent-border/45 bg-dc-accent-muted px-3 py-1.5 text-dc-accent-hover',
  },
  blue: {
    status: 'font-medium text-sky-600 dark:text-sky-300',
    button:
      'min-h-10 border-sky-500/50 px-3 py-2 text-sky-700 hover:bg-sky-500/10 dark:text-sky-200',
    pill: 'border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sky-700 dark:text-sky-200',
  },
  red: {
    status: 'font-medium text-dc-danger',
    button: 'min-h-10 border-dc-danger-border px-3 py-2 text-dc-danger hover:bg-dc-danger-muted',
    pill: 'border-dc-danger-border bg-dc-danger-muted px-3 py-1.5 text-dc-danger',
  },
  neutral: {
    status: '',
    button:
      'min-h-10 border-dc-success/40 px-3 py-2 text-dc-success hover:bg-dc-success-muted',
    pill: '',
  },
}

type PolicyDoc = { id: string; kind: string; version: number; title: string; publishedAt: string | null }

const STATUSES = ['', 'imported', 'pending', 'confirmed', 'cancelled', 'waitlisted', 'checked_in'] as const

const VETTING = ['none', 'pending', 'approved', 'rejected', 'hold'] as const

const PAGE_SIZE = 50

const PAYMENT_STATUSES = ['', 'paid', 'unpaid', 'partial', 'refunded', 'comp', 'pending', 'waived'] as const

type RegistrantsListResponse = {
  registrants: RegRow[]
  total: number
  limit: number
  offset: number
}

const STATUS_LABELS: Record<string, string> = {
  imported: 'Imported',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  waitlisted: 'Waitlisted',
  checked_in: 'On-site',
}

function formatRegistrantStatus(r: RegRow) {
  if (r.status === 'checked_in') {
    const tone = rowCheckInTone(r)
    return <span className={TONE_CLASS[tone].status}>{checkInTimingLabel(r.checkInTiming)}</span>
  }
  if (r.checkInEligibility === 'early') {
    return <span className={TONE_CLASS.red.status}>Early: not on-site</span>
  }
  if (r.checkInEligibility === 'late') {
    return <span className={TONE_CLASS.blue.status}>Late window</span>
  }
  return STATUS_LABELS[r.status] ?? r.status
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      q = !q
      continue
    }
    if (!q && c === ',') {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

function parseRegistrantCsv(text: string): { rows: Record<string, unknown>[] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const col = (...aliases: string[]) => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '_')
    for (const a of aliases) {
      const i = header.indexOf(norm(a))
      if (i >= 0) return i
    }
    return -1
  }
  const iName = col('name', 'scene_display_name', 'display_name', 'scenename')
  const iCat = col('category', 'category_name', 'ticket', 'ticket_type', 'type')
  const iEmail = col('email')
  const iLegal = col('legal_name', 'legalname')
  const iExtSrc = col('external_source', 'source')
  const iExtId = col('external_id', 'externalid')
  const iPay = col('payment_status', 'imported_payment_status', 'importedpaymentstatus')
  if (iName < 0 || iCat < 0) {
    throw new Error('CSV must include name and category columns (e.g. name, category)')
  }
  const rows: Record<string, unknown>[] = []
  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li])
    const sceneDisplayName = (cells[iName] ?? '').trim()
    const categoryName = (cells[iCat] ?? '').trim()
    if (!sceneDisplayName) continue
    const row: Record<string, unknown> = { sceneDisplayName, categoryName }
    if (iEmail >= 0 && cells[iEmail]?.trim()) row.email = cells[iEmail].trim()
    if (iLegal >= 0 && cells[iLegal]?.trim()) row.legalName = cells[iLegal].trim()
    if (iExtSrc >= 0 && cells[iExtSrc]?.trim()) row.externalSource = cells[iExtSrc].trim()
    if (iExtId >= 0 && cells[iExtId]?.trim()) row.externalId = cells[iExtId].trim()
    if (iPay >= 0 && cells[iPay]?.trim()) row.importedPaymentStatus = cells[iPay].trim()
    rows.push(row)
  }
  if (!rows.length) throw new Error('No data rows parsed from CSV')
  return { rows }
}

function formatRegistrationAnswerDisplay(value: unknown): { primary: string; rawJson?: string } {
  if (value == null || value === '') return { primary: '' }
  if (typeof value === 'string') return { primary: value }
  if (typeof value === 'number' || typeof value === 'boolean') return { primary: String(value) }
  if (Array.isArray(value)) {
    const simple = value.every(
      (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    )
    if (simple) return { primary: value.map(String).join(', ') }
    return { primary: value.map(String).join(', '), rawJson: JSON.stringify(value, null, 2) }
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const simple = entries.every(
      ([, v]) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    )
    if (simple && entries.length) {
      return { primary: entries.map(([k, v]) => `${k}: ${v ?? ''}`).join(' · ') }
    }
    return {
      primary: entries.length ? `${entries.length} field${entries.length === 1 ? '' : 's'}` : '(empty)',
      rawJson: JSON.stringify(value, null, 2),
    }
  }
  return { primary: String(value) }
}

function registrationAnswerEditValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value == null) return ''
  return JSON.stringify(value)
}

export function RegistrantsPanel({
  eventSlug,
  readOnly,
  permissions,
  embedded = false,
}: {
  eventSlug: string
  readOnly: boolean
  permissions: ConventionCommandPermissions
  embedded?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceBase = useOrganizerWorkspacePath(eventSlug)
  const doorHref = useOrganizerSubPath('door')
  const settingsHref = organizerTabHref(workspaceBase, 'settings', { settingsPanel: 'registration' })
  const [rows, setRows] = useState<RegRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [status, setStatus] = useState('')
  const [vettingFilter, setVettingFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<RegRow | null>(null)
  const [detailTab, setDetailTab] = useState<'general' | 'vetting' | 'answers' | 'payment' | 'tags'>('general')
  const [detailStatus, setDetailStatus] = useState('')
  const [detailCategoryId, setDetailCategoryId] = useState('')
  const [detailNotes, setDetailNotes] = useState('')
  const [detailPronouns, setDetailPronouns] = useState('')
  const [detailVettingStatus, setDetailVettingStatus] = useState<(typeof VETTING)[number]>('none')
  const [detailVettingSafety, setDetailVettingSafety] = useState('')
  const [, setPolicyDocs] = useState<PolicyDoc[]>([])
  const [policyPick, setPolicyPick] = useState<Record<string, boolean>>({})
  const [detailPaymentStatus, setDetailPaymentStatus] = useState('')
  const [detailAnswers, setDetailAnswers] = useState<Record<string, unknown>>({})
  const [detailTagIds, setDetailTagIds] = useState<string[]>([])
  const [registrantTags, setRegistrantTags] = useState<{ id: string; name: string }[]>([])
  const [formQuestions, setFormQuestions] = useState<
    { id: string; label: string; type: string; optionsJson: unknown }[]
  >([])
  const [busy, setBusy] = useState(false)
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [userPickerOptions, setUserPickerOptions] = useState<EntityPickerOption[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [stats, setStats] = useState<{ total: number; checkedIn: number; pendingVetting: number; waitlisted: number } | null>(
    null,
  )
  const { ask, dialog } = useConfirmDialog()

  const showInternal = canSeeRegistrantInternalNotes(permissions)
  const showVettingSafety = canEditVettingSafetyNotes(permissions)

  const loadUserPickerOptions = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{
        users: { userId: string; displayName: string; username: string; email: string }[]
      }>(eventSlug, '/organizer/user-picker')
      setUserPickerOptions(
        (res.users ?? []).map((u) => ({
          id: u.userId,
          label: u.displayName,
          sublabel: u.email || u.username,
        })),
      )
    } catch {
      setUserPickerOptions([])
    }
  }, [eventSlug])

  useEffect(() => {
    if (!readOnly) void loadUserPickerOptions()
  }, [loadUserPickerOptions, readOnly])

  async function addSignup(userId: string) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/registrants', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      setImportSuccess('Signup added.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add signup failed')
    } finally {
      setBusy(false)
      setUserPickerOpen(false)
    }
  }

  async function openRow(r: RegRow) {
    setSelected(r)
    syncRegistrantUrl(r.id)
    setDetailTab('general')
    setDetailStatus(r.status)
    setDetailCategoryId(r.categoryId)
    setDetailNotes(r.internalNotes ?? '')
    setDetailPronouns(r.pronouns ?? '')
    setDetailVettingStatus((r.vettingStatus as (typeof VETTING)[number]) ?? 'none')
    setDetailVettingSafety(r.vettingSafetyNotes ?? '')
    setPolicyPick({})
    setDetailPaymentStatus('')
    setDetailAnswers({})
    setDetailTagIds([])
    try {
      const [res, polRes, tagsRes, formRes] = await Promise.all([
        organizerDancecardFetch<{
          registrant: {
            categoryId: string
            status: string
            internalNotes: string | null
            pronouns: string | null
            vettingStatus: string
            vettingSafetyNotes: string | null
            importedPaymentStatus: string | null
            answers?: Record<string, unknown>
            tagIds?: string[]
          }
        }>(eventSlug, `/registrants/${r.id}`),
        organizerDancecardFetch<{ documents: PolicyDoc[] }>(eventSlug, '/policy-documents').catch(() => ({
          documents: [] as PolicyDoc[],
        })),
        organizerDancecardFetch<{ tags: { id: string; name: string; scope: string }[] }>(eventSlug, '/tags').catch(
          () => ({ tags: [] }),
        ),
        organizerDancecardFetch<{
          form: null | { questions: { id: string; label: string; type: string; optionsJson: unknown }[] }
        }>(eventSlug, '/registration-form').catch(() => ({ form: null })),
      ])
      setDetailStatus(res.registrant.status)
      setDetailCategoryId(res.registrant.categoryId ?? r.categoryId)
      setDetailNotes(res.registrant.internalNotes ?? '')
      setDetailPronouns(res.registrant.pronouns ?? '')
      setDetailVettingStatus((res.registrant.vettingStatus as (typeof VETTING)[number]) ?? 'none')
      setDetailVettingSafety(res.registrant.vettingSafetyNotes ?? '')
      setDetailPaymentStatus(res.registrant.importedPaymentStatus ?? '')
      setDetailAnswers(res.registrant.answers ?? {})
      setDetailTagIds(res.registrant.tagIds ?? [])
      setRegistrantTags((tagsRes.tags ?? []).filter((t) => t.scope === 'registrant').map((t) => ({ id: t.id, name: t.name })))
      setFormQuestions(formRes.form?.questions ?? [])
      setPolicyDocs((polRes.documents ?? []).filter((d) => d.publishedAt))
    } catch {
      setPolicyDocs([])
      setRegistrantTags([])
      setFormQuestions([])
    }
  }

  const loadCategories = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{ categories: { id: string; name: string }[] }>(
        eventSlug,
        '/registration-categories',
      )
      setCategories(res.categories ?? [])
    } catch {
      setCategories([])
    }
  }, [eventSlug])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const registrantsQueryPath = useCallback(
    (pageOffset: number) => {
      const qs = new URLSearchParams()
      qs.set('limit', String(PAGE_SIZE))
      qs.set('offset', String(pageOffset))
      let effStatus = status
      let effVetting = vettingFilter
      if (quickFilter === 'needs_vetting') {
        effVetting = 'pending'
        effStatus = ''
      } else if (quickFilter === 'checked_in') {
        effStatus = 'checked_in'
        effVetting = ''
      } else if (quickFilter === 'not_checked_in') {
        effStatus = 'registered'
        effVetting = ''
      } else if (quickFilter === 'waitlisted') {
        effStatus = 'waitlisted'
        effVetting = ''
      }
      if (effStatus) qs.set('status', effStatus)
      if (effVetting) qs.set('vetting', effVetting)
      if (categoryFilter) qs.set('categoryId', categoryFilter)
      if (q.trim()) qs.set('q', q.trim())
      return `/registrants?${qs}`
    },
    [status, vettingFilter, categoryFilter, q, quickFilter],
  )

  const load = useCallback(async () => {
    setErr(null)
    setLoadFailed(false)
    setLoading(true)
    try {
      const res = await organizerDancecardFetch<RegistrantsListResponse>(eventSlug, registrantsQueryPath(0))
      setRows(res.registrants ?? [])
      setTotal(res.total ?? 0)
    } catch (e) {
      setLoadFailed(true)
      setRows([])
      setTotal(0)
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [eventSlug, registrantsQueryPath])

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return
    setLoadingMore(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<RegistrantsListResponse>(
        eventSlug,
        registrantsQueryPath(rows.length),
      )
      setRows((prev) => [...prev, ...(res.registrants ?? [])])
      setTotal(res.total ?? 0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }, [eventSlug, registrantsQueryPath, loadingMore, rows.length, total])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(t)
  }, [load])

  const loadStats = useCallback(async () => {
    try {
      const count = async (extra: string) => {
        const res = await organizerDancecardFetch<{ total?: number }>(
          eventSlug,
          `/registrants?limit=1&offset=0${extra}`,
        )
        return res.total ?? 0
      }
      const [total, checkedIn, pendingVetting, waitlisted] = await Promise.all([
        count(''),
        count('&status=checked_in'),
        count('&vetting=pending'),
        count('&status=waitlisted'),
      ])
      setStats({ total, checkedIn, pendingVetting, waitlisted })
    } catch {
      setStats(null)
    }
  }, [eventSlug])

  useEffect(() => {
    void loadStats()
  }, [loadStats, total])

  const syncRegistrantUrl = useCallback(
    (registrantId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (registrantId) params.set(REGISTRANT_PARAM, registrantId)
      else params.delete(REGISTRANT_PARAM)
      params.delete(PEOPLE_ACTION_PARAM)
      router.replace(`${workspaceBase}?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, workspaceBase],
  )

  const deepRegistrantId = searchParams.get(REGISTRANT_PARAM)
  useEffect(() => {
    if (!deepRegistrantId || loading) return
    const hit = rows.find((r) => r.id === deepRegistrantId)
    if (hit && selected?.id !== hit.id) void openRow(hit)
  }, [deepRegistrantId, rows, loading, selected?.id])

  useEffect(() => {
    const action = searchParams.get(PEOPLE_ACTION_PARAM)
    if (action === 'addSignup' && !readOnly) setUserPickerOpen(true)
  }, [readOnly, searchParams])

  async function exportCsv() {
    const url = `${organizerConventionApiBase(eventSlug)}/registrants/export`
    const res = await fetch(url, { credentials: 'include' })
    const text = await res.text()
    if (!res.ok) {
      setErr(text.slice(0, 200))
      return
    }
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `registrants-${eventSlug}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function runImport(json: string) {
    if (readOnly) return
    let body: unknown
    try {
      body = JSON.parse(json)
    } catch {
      setErr('Import body must be JSON: { rows: [...] }')
      return
    }
    setBusy(true)
    try {
      const res = await organizerDancecardFetch<{
        created: number
        updated?: number
        skipped?: number
        errors: string[]
      }>(
        eventSlug,
        '/registrants/import',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      )
      setErr(res.errors?.length ? res.errors.join('\n') : null)
      await load()
      const u = res.updated ?? 0
      const sk = res.skipped ?? 0
      setImportSuccess(
        `Imported ${res.created} new, updated ${u}${sk ? `, skipped ${sk} (no Kink Social account or missing email)` : ''}`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveDetail() {
    if (!selected || readOnly) return
    setBusy(true)
    try {
      const policyDocumentIds = Object.entries(policyPick)
        .filter(([, v]) => v)
        .map(([id]) => id)
      const patch: Record<string, unknown> = {
        status: detailStatus,
        categoryId: detailCategoryId || undefined,
        pronouns: detailPronouns.trim() || null,
        vettingStatus: detailVettingStatus,
      }
      if (showInternal) patch.internalNotes = detailNotes || null
      if (showVettingSafety) patch.vettingSafetyNotes = detailVettingSafety || null
      if (policyDocumentIds.length) patch.policyDocumentIds = policyDocumentIds
      if (detailTab === 'payment' || detailTab === 'general') {
        patch.importedPaymentStatus = detailPaymentStatus.trim() || null
      }
      if (detailTab === 'answers') patch.answers = detailAnswers
      // tagIds not persisted yet - see Tags tab copy

      const res = await organizerDancecardFetch<{ registrant: RegRow }>(eventSlug, `/registrants/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const updated = mergeRegistrantRow(selected, res.registrant)
      setSelected(updated)
      setDetailStatus(updated.status)
      setDetailCategoryId(updated.categoryId)
      setRows((prev) => prev.map((row) => (row.id === updated.id ? mergeRegistrantRow(row, updated) : row)))
      setImportSuccess('Saved.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function mergeRegistrantRow(prev: RegRow, next: RegRow): RegRow {
    return { ...prev, ...next, categoryName: next.categoryName ?? prev.categoryName }
  }

  async function quickCheckIn(
    id: string,
    e: { stopPropagation(): void },
    earlyOverride = false,
  ) {
    e.stopPropagation()
    if (readOnly) return
    const row = rows.find((r) => r.id === id)
    if (row?.status === 'checked_in') return
    setErr(null)
    setCheckInSuccess(null)
    try {
      const res = await organizerDancecardFetch<{ registrant: RegRow }>(eventSlug, `/registrants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'checked_in', earlyCheckInOverride: earlyOverride }),
      })
      const updated = res.registrant
      if (updated.status !== 'checked_in') {
        setErr(
          `Check-in did not stick. Status is still "${STATUS_LABELS[updated.status] ?? updated.status}".`,
        )
        return
      }
      setRows((prev) => prev.map((r) => (r.id === id ? mergeRegistrantRow(r, updated) : r)))
      if (selected?.id === id) {
        setSelected((s) => (s ? mergeRegistrantRow(s, updated) : s))
        setDetailStatus('checked_in')
      }
      if (status === 'confirmed') setStatus('')
      rowCheckInTone(updated)
      const toneNote =
        updated.checkInTiming === 'late'
          ? ' (late window)'
          : updated.checkInTiming === 'early_override'
            ? ' (early override)'
            : ''
      setCheckInSuccess(`${updated.sceneDisplayName} marked on-site${toneNote}.`)
    } catch (err2) {
      if (err2 instanceof OrganizerApiError && err2.status === 409) {
        try {
          const body = JSON.parse(err2.body) as { code?: string; validFrom?: string | null }
          if (body.code === 'EARLY_CHECK_IN') {
            const from = body.validFrom ? ` Ticket check-in opens ${body.validFrom}.` : ''
            const ok = await ask({
              title: 'Early check-in',
              message: `${row?.sceneDisplayName ?? 'This attendee'} is before their ticket check-in window.${from} Override and check them in anyway?`,
              confirmLabel: 'Override & check in',
              destructive: true,
            })
            if (ok) return quickCheckIn(id, e, true)
            return
          }
        } catch {
          /* fall through */
        }
      }
      setErr(err2 instanceof Error ? err2.message : 'Check-in failed')
    }
  }

  return (
    <div className="space-y-4">
      {dialog}
      <EntityPickerModal
        open={userPickerOpen}
        title="Add signup: choose Kink Social member"
        options={userPickerOptions}
        emptyLabel="No org members found."
        onCancel={() => setUserPickerOpen(false)}
        onSelect={(id) => void addSignup(id)}
      />
      {!embedded ? (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl text-dc-text sm:text-2xl">{copy.signups}</h2>
          <Link
            href={doorHref}
            className="min-h-10 inline-flex items-center rounded-xl border border-dc-accent-border/50 px-4 py-2 text-sm font-medium text-dc-accent hover:bg-dc-accent-muted"
          >
            Open door mode
          </Link>
        </header>
      ) : null}
      {stats && stats.total > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Checked in', value: stats.checkedIn, tone: 'text-emerald-400' },
            { label: 'Needs vetting', value: stats.pendingVetting, tone: stats.pendingVetting ? 'text-amber-400' : undefined },
            { label: 'Waitlisted', value: stats.waitlisted },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
              <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{s.label}</p>
              <p className={`mt-0.5 font-serif text-xl tabular-nums ${s.tone ?? 'text-dc-text'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['needs_vetting', 'Needs vetting', stats?.pendingVetting],
            ['checked_in', 'Checked in', stats?.checkedIn],
            ['not_checked_in', 'Not checked in', stats ? stats.total - stats.checkedIn : undefined],
            ['waitlisted', 'Waitlisted', stats?.waitlisted],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={
              quickFilter === key
                ? 'rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground'
                : 'rounded-full border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:bg-dc-elevated-muted'
            }
            onClick={() => setQuickFilter((f) => (f === key ? '' : key))}
          >
            {label}
            {count !== undefined && count > 0 ? ` (${count})` : ''}
          </button>
        ))}
      </div>
      {importSuccess ? (
        <InlineSuccessBanner message={importSuccess} onDismiss={() => setImportSuccess(null)} />
      ) : null}
      {checkInSuccess ? (
        <InlineSuccessBanner message={checkInSuccess} onDismiss={() => setCheckInSuccess(null)} />
      ) : null}
      {err ? <p className="text-sm text-dc-danger whitespace-pre-wrap">{err}</p> : null}
      <details className="text-xs text-dc-muted lg:hidden">
        <summary className="cursor-pointer font-medium text-dc-text">Check-in color key</summary>
        <p className="mt-2">
          <span className="text-dc-accent-hover">Gold</span> on-site · <span className="text-sky-600 dark:text-sky-300">blue</span>{' '}
          late · <span className="text-dc-danger">red</span> early override.
        </p>
      </details>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-dc-muted">
          <span className="font-semibold uppercase tracking-wide">Status</span>
          <select
            className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base text-dc-text"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? (STATUS_LABELS[s] ?? s) : 'All statuses'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-dc-muted">
          <span className="font-semibold uppercase tracking-wide">Vetting</span>
          <select
            className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base text-dc-text"
            value={vettingFilter}
            onChange={(e) => setVettingFilter(e.target.value)}
          >
            <option value="">All vetting</option>
            {VETTING.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-dc-muted sm:col-span-2 lg:col-span-1">
          <span className="font-semibold uppercase tracking-wide">Ticket type</span>
          <select
            className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base text-dc-text"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All ticket types</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-dc-muted sm:col-span-2 lg:col-span-1">
          <span className="font-semibold uppercase tracking-wide">Search</span>
          <input
            className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base text-dc-text"
            placeholder="Name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly ? (
          <button
            type="button"
            disabled={busy}
            className="min-h-10 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
            onClick={() => setUserPickerOpen(true)}
          >
            Add signup
          </button>
        ) : null}
        {!readOnly ? (
          <ImportSignupsMenu
            disabled={busy}
            defaultOpen={searchParams.get(PEOPLE_ACTION_PARAM) === 'importSignups'}
            onImportCsv={(text) => {
              try {
                void runImport(JSON.stringify(parseRegistrantCsv(text)))
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'CSV parse error')
              }
            }}
            onImportJson={(text) => void runImport(text)}
          />
        ) : null}
        {!readOnly ? (
          <button
            type="button"
            className="min-h-10 rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-surface-muted"
            onClick={() => void exportCsv()}
          >
            Export CSV
          </button>
        ) : null}
        {!embedded ? (
          <Link
            href={doorHref}
            className="min-h-10 inline-flex items-center rounded-xl border border-dc-accent-border/50 px-4 py-2 text-sm font-medium text-dc-accent hover:bg-dc-accent-muted"
          >
            Open door mode
          </Link>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-dc-muted">Loading signups…</p> : null}
      {loadFailed && err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {total > 0 ? (
        <p className="text-xs text-dc-muted">
          Showing {rows.length} of {total} signup{total === 1 ? '' : 's'}
        </p>
      ) : null}
      {!loading && total === 0 && !loadFailed ? (
        <PeopleEmptyState
          title="No signups yet"
          actions={[
            ...(!readOnly
              ? [
                  { label: 'Add signup', onClick: () => setUserPickerOpen(true), primary: true },
                  { label: 'Import CSV', onClick: () => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set(PEOPLE_ACTION_PARAM, 'importSignups')
                    router.replace(`${workspaceBase}?${params.toString()}`, { scroll: false })
                  } },
                ]
              : []),
            ...(permissions.isFullAdmin
              ? [{ label: 'Registration settings', href: settingsHref }]
              : []),
          ]}
        >
          When attendees register or are added manually, they will appear here.
        </PeopleEmptyState>
      ) : (
      <RegistrantsMasterDetail
        eventSlug={eventSlug}
        rows={rows}
        readOnly={readOnly}
        selectedId={selected?.id ?? null}
        onSelect={(r) => void openRow(r)}
        onClearSelection={() => {
          setSelected(null)
          syncRegistrantUrl(null)
        }}
        renderPersonRosterLink={(r) =>
          r.directoryPersonId ? (
            <Link
              href={organizerTabHref(workspaceBase, 'people', {
                peopleTab: 'roster',
                personId: r.directoryPersonId,
              })}
              className="text-sm font-medium text-dc-accent hover:underline"
            >
              View in roster
            </Link>
          ) : null
        }
        getCell={(r, col) => {
          if (col === 'category') return r.categoryName ?? '-'
          if (col === 'status') return formatRegistrantStatus(r)
          if (col === 'vetting') return r.vettingStatus
          if (col === 'email') return r.email ?? '-'
          if (col === 'external')
            return r.externalSource || r.externalId
              ? `${r.externalSource ?? '-'} / ${r.externalId ?? '-'}`
              : '-'
          return '-'
        }}
        renderCheckIn={
          readOnly
            ? undefined
            : (r) => {
                const tone = rowCheckInTone(r)
                const cls = TONE_CLASS[tone]
                if (r.status === 'checked_in') {
                  return (
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${cls.pill}`}
                    >
                      {checkInTimingLabel(r.checkInTiming)}
                    </span>
                  )
                }
                return (
                  <button
                    type="button"
                    className={`rounded-full border text-xs font-medium ${cls.button}`}
                    onClick={(e) => void quickCheckIn(r.id, e)}
                  >
                    {r.checkInEligibility === 'early'
                      ? 'Check in (early)'
                      : r.checkInEligibility === 'late'
                        ? 'Check in (late)'
                        : 'Check in'}
                  </button>
                )
              }
        }
        renderDetail={() =>
          selected ? (
            <>
              <h3 className="font-serif text-lg text-dc-text">{selected.sceneDisplayName}</h3>
              <p className="text-xs text-dc-muted">{selected.id}</p>
              <div className="mt-3 flex flex-wrap gap-1 border-b border-dc-border pb-2">
                {(
                  [
                    ['general', 'General'],
                    ['answers', 'Answers'],
                    ['payment', 'Payment'],
                    ['tags', 'Tags'],
                    ['vetting', 'Vetting'],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    className={
                      detailTab === t
                        ? 'rounded-full bg-dc-accent/20 px-3 py-1 text-xs text-dc-accent'
                        : 'rounded-full px-3 py-1 text-xs text-dc-muted'
                    }
                    onClick={() => setDetailTab(t)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {detailTab === 'general' ? (
                <div className="mt-3 space-y-3 text-sm">
                  <label className="block text-xs uppercase text-dc-muted">
                    Registration category
                    <select
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-text"
                      disabled={readOnly}
                      value={detailCategoryId}
                      onChange={(e) => setDetailCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] leading-snug text-dc-muted">
                    Change ticket type here for anyone. Including people who signed up under a different category or
                    without a staff/comp code. For shift assignments, also add them on{' '}
                    <strong className="font-medium text-dc-text">Staff roster (overview)</strong>.
                  </p>
                  <label className="block text-xs uppercase text-dc-muted">
                    Status
                    <select
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-text"
                      disabled={readOnly}
                      value={detailStatus}
                      onChange={(e) => setDetailStatus(e.target.value)}
                    >
                      {(['imported', 'pending', 'confirmed', 'cancelled', 'waitlisted', 'checked_in'] as const).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s] ?? s}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="block text-xs uppercase text-dc-muted">
                    Pronouns
                    <input
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2"
                      disabled={readOnly}
                      value={detailPronouns}
                      onChange={(e) => setDetailPronouns(e.target.value)}
                    />
                  </label>
                  {showInternal ? (
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2"
                      disabled={readOnly}
                      value={detailNotes}
                      onChange={(e) => setDetailNotes(e.target.value)}
                      placeholder="Internal notes"
                    />
                  ) : null}
                </div>
              ) : detailTab === 'answers' ? (
                <div className="mt-3 space-y-3 text-sm">
                  {formQuestions.length === 0 ? (
                    <p className="text-xs text-dc-muted">No registration form questions configured.</p>
                  ) : (
                    formQuestions.map((q) => {
                      const answerValue = detailAnswers[q.id]
                      const { primary, rawJson } = formatRegistrationAnswerDisplay(answerValue)
                      return (
                        <div key={q.id} className="block text-xs text-dc-muted">
                          <span className="font-medium text-dc-text">{q.label}</span>
                          {rawJson ? (
                            <div className="mt-1 space-y-2">
                              <p className="text-sm text-dc-text">{primary || '-'}</p>
                              <details>
                                <summary className="cursor-pointer text-[11px] text-dc-muted">Raw value (JSON)</summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded border border-dc-border bg-dc-surface-muted p-2 font-mono text-[10px] text-dc-muted">
                                  {rawJson}
                                </pre>
                              </details>
                              {!readOnly ? (
                                <textarea
                                  className="min-h-[60px] w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 font-mono text-xs text-dc-text"
                                  value={registrationAnswerEditValue(answerValue)}
                                  onChange={(e) => setDetailAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <input
                              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm"
                              disabled={readOnly}
                              value={registrationAnswerEditValue(answerValue)}
                              onChange={(e) => setDetailAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            />
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              ) : detailTab === 'payment' ? (
                <div className="mt-3 space-y-3 text-sm">
                  <p className="text-[11px] leading-snug text-dc-muted">
                    Kink Social does not process payments. Record off-platform status here for door and roster reference
                    only. Organizers mark paid access separately when using comp codes or manual confirmation.
                  </p>
                  <label className="block text-xs uppercase text-dc-muted">
                    Imported payment status
                    <select
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2"
                      disabled={readOnly}
                      value={detailPaymentStatus}
                      onChange={(e) => setDetailPaymentStatus(e.target.value)}
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s || 'none'} value={s}>
                          {s ? s : 'Not set'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : detailTab === 'tags' ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="rounded-lg border border-dc-warning/30 bg-dc-warning-muted px-3 py-2 text-xs text-dc-warning">
                    Registrant tags are not saved yet. Use Notes or category for now. Tag assignment ships in a
                    follow-up slice.
                  </p>
                  {registrantTags.length === 0 ? (
                    <p className="text-xs text-dc-muted">No registrant-scoped tags.</p>
                  ) : (
                    registrantTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 text-dc-text">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={detailTagIds.includes(tag.id)}
                          onChange={(e) => {
                            setDetailTagIds((ids) =>
                              e.target.checked ? [...ids, tag.id] : ids.filter((id) => id !== tag.id),
                            )
                          }}
                        />
                        {tag.name}
                      </label>
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <select
                    className="w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2"
                    disabled={readOnly}
                    value={detailVettingStatus}
                    onChange={(e) => setDetailVettingStatus(e.target.value as (typeof VETTING)[number])}
                  >
                    {VETTING.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {showVettingSafety ? (
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2"
                      disabled={readOnly}
                      value={detailVettingSafety}
                      onChange={(e) => setDetailVettingSafety(e.target.value)}
                    />
                  ) : null}
                </div>
              )}
              {!readOnly ? (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-4 w-full rounded-full bg-dc-accent py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
                  onClick={() => void saveDetail()}
                >
                  Save
                </button>
              ) : null}
            </>
          ) : null
        }
      />
      )}
      {rows.length < total ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={loadingMore}
            className="rounded-full border border-dc-border px-4 py-2 text-sm text-dc-text hover:bg-dc-surface-muted disabled:opacity-40"
            onClick={() => void loadMore()}
          >
            {loadingMore ? 'Loading…' : `Load more (${rows.length} of ${total})`}
          </button>
        </div>
      ) : null}
    </div>
  )
}
