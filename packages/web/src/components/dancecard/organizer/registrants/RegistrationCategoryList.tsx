'use client'

import { useEffect, useState } from 'react'
import { OrganizerApiError, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'
import {
  SETTINGS_FIELD_CLASS,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { generateAccessCodeClient } from '@/lib/dancecard/generateAccessCodeClient'
import {
  REGISTRATION_ROLE_KINDS,
  roleKindMeta,
  type RegistrationRoleKind,
} from '@/lib/dancecard/registrationCategoryRoleKinds'
import { Panel } from '@/components/dancecard/ui/Panel'
import { Button } from '@/components/dancecard/ui/Button'

/** Stacked label + control with consistent label height so grid rows align. */
const CATEGORY_FIELD_LABEL_CLASS =
  'flex min-h-[2.75rem] flex-col justify-end gap-1 text-xs font-medium uppercase tracking-wide text-dc-muted'

const CATEGORY_FIELD_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'

export type RegistrationCategory = {
  id: string
  name: string
  roleKind: string
  expectedHours: number | null
  capacity: number | null
  accessCode: string | null
  grantsStaffAccess: boolean
  sortOrder: number
  checkInValidFrom: string | null
  checkInValidThrough: string | null
}

type CategoryDraft = {
  name: string
  roleKind: RegistrationRoleKind
  expectedHours: string
  capacity: string
  accessCode: string
  grantsStaffAccess: boolean
  checkInValidFrom: string
  checkInValidThrough: string
}

function formatCategoryApiError(e: unknown): string {
  if (e instanceof OrganizerApiError) {
    try {
      const parsed = JSON.parse(e.body) as { error?: string }
      if (parsed.error?.trim()) return parsed.error
    } catch {
      // use message below
    }
    return e.message
  }
  return e instanceof Error ? e.message : 'Request failed'
}

function draftFromCategory(c: RegistrationCategory): CategoryDraft {
  const kind = REGISTRATION_ROLE_KINDS.some((r) => r.id === c.roleKind)
    ? (c.roleKind as RegistrationRoleKind)
    : 'other'
  return {
    name: c.name,
    roleKind: kind,
    expectedHours: c.expectedHours === null ? '' : String(c.expectedHours),
    capacity: c.capacity === null ? '' : String(c.capacity),
    accessCode: c.accessCode ?? '',
    grantsStaffAccess: c.grantsStaffAccess,
    checkInValidFrom: c.checkInValidFrom ?? '',
    checkInValidThrough: c.checkInValidThrough ?? '',
  }
}

function parseExpectedHours(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  if (Number.isNaN(n) || n < 0) return NaN
  return n
}

function copyText(text: string, onDone: (msg: string) => void) {
  void navigator.clipboard.writeText(text).then(
    () => onDone('Code copied.'),
    () => onDone('Copy failed. Select the code and copy manually.'),
  )
}

function CategoryRow({
  category,
  canEdit,
  eventSlug,
  busy,
  setBusy,
  onSaved,
  onError,
  onMessage,
  onDelete,
}: {
  category: RegistrationCategory
  canEdit: boolean
  eventSlug: string
  busy: boolean
  setBusy: (v: boolean) => void
  onSaved: () => void
  onError: (msg: string) => void
  onMessage: (msg: string) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<CategoryDraft>(() => draftFromCategory(category))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(draftFromCategory(category))
    setDirty(false)
  }, [category])

  function updateDraft(patch: Partial<CategoryDraft>) {
    setDraft((d) => {
      const next = { ...d, ...patch }
      if (patch.roleKind !== undefined) {
        const meta = roleKindMeta(patch.roleKind)
        if (!dirty && (d.name === roleKindMeta(d.roleKind).defaultName || d.name === '')) {
          next.name = meta.defaultName || d.name
        }
        if (patch.expectedHours === undefined && meta.defaultHours !== null && !d.expectedHours.trim()) {
          next.expectedHours = String(meta.defaultHours)
        }
        if (patch.grantsStaffAccess === undefined) {
          next.grantsStaffAccess = meta.defaultStaffUnlock
        }
      }
      return next
    })
    setDirty(true)
  }

  async function save() {
    if (!canEdit) return
    const capacityTrim = draft.capacity.trim()
    const capacity = capacityTrim === '' ? null : Number.parseInt(capacityTrim, 10)
    if (capacity !== null && (Number.isNaN(capacity) || capacity < 0)) {
      onError('Capacity must be a non-negative number or blank for unlimited.')
      return
    }
    const expectedHours = parseExpectedHours(draft.expectedHours)
    if (expectedHours !== null && Number.isNaN(expectedHours)) {
      onError('Hours of service must be a non-negative number or blank.')
      return
    }
    const accessCode = draft.accessCode.trim() || null
    setBusy(true)
    onError('')
    try {
      await organizerDancecardFetch(eventSlug, `/registration-categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          roleKind: draft.roleKind,
          expectedHours,
          capacity,
          accessCode,
          grantsStaffAccess: draft.grantsStaffAccess,
          checkInValidFrom: draft.checkInValidFrom.trim() || null,
          checkInValidThrough: draft.checkInValidThrough.trim() || null,
        }),
      })
      setDirty(false)
      onMessage(`Saved “${draft.name.trim()}”.`)
      onSaved()
    } catch (e) {
      onError(formatCategoryApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function generateCode() {
    updateDraft({ accessCode: generateAccessCodeClient() })
    onMessage('New code generated. Click Save category to store it.')
  }

  const roleLabel = roleKindMeta(draft.roleKind).label

  return (
    <li className="rounded-lg border border-dc-border bg-dc-surface-muted p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-dc-border bg-dc-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dc-muted">
          {roleLabel}
        </span>
        {draft.expectedHours.trim() ? (
          <span className="text-[10px] text-dc-muted">{draft.expectedHours.trim()} hrs service</span>
        ) : null}
      </div>
      <div className="space-y-4">
        <div className={CATEGORY_FIELD_GRID}>
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Role type</span>
            <select
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              disabled={!canEdit || busy}
              value={draft.roleKind}
              onChange={(e) => updateDraft({ roleKind: e.target.value as RegistrationRoleKind })}
            >
            {REGISTRATION_ROLE_KINDS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Display name</span>
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              disabled={!canEdit || busy}
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </label>
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Hours of service</span>
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              type="number"
              min={0}
              step={0.5}
              placeholder="Optional"
              disabled={!canEdit || busy}
              value={draft.expectedHours}
              onChange={(e) => updateDraft({ expectedHours: e.target.value })}
            />
          </label>
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Capacity</span>
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              type="number"
              min={0}
              placeholder="Unlimited"
              disabled={!canEdit || busy}
              value={draft.capacity}
              onChange={(e) => updateDraft({ capacity: e.target.value })}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Check-in from</span>
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              type="date"
              disabled={!canEdit || busy}
              value={draft.checkInValidFrom}
              onChange={(e) => updateDraft({ checkInValidFrom: e.target.value })}
            />
          </label>
          <label className={CATEGORY_FIELD_LABEL_CLASS}>
            <span>Check-in through</span>
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0`}
              type="date"
              disabled={!canEdit || busy}
              value={draft.checkInValidThrough}
              onChange={(e) => updateDraft({ checkInValidThrough: e.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-dc-muted">Comp / access code</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              className={`${SETTINGS_FIELD_CLASS} mt-0 min-h-[2.5rem] flex-1 font-mono text-xs tracking-wide`}
              placeholder="Optional"
              disabled={!canEdit || busy}
              value={draft.accessCode}
              onChange={(e) => updateDraft({ accessCode: e.target.value })}
            />
            {canEdit ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[2.5rem] px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={generateCode}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[2.5rem] px-3 py-2 text-xs"
                  disabled={busy || !draft.accessCode.trim()}
                  onClick={() => copyText(draft.accessCode.trim(), onMessage)}
                >
                  Copy
                </Button>
              </div>
            ) : null}
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-dc-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs text-dc-text">
          <input
            type="checkbox"
            disabled={!canEdit || busy}
            checked={draft.grantsStaffAccess}
            onChange={(e) => updateDraft({ grantsStaffAccess: e.target.checked })}
          />
          Unlock staff tools when this code is used on the dancecard
        </label>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" className="min-h-[2.5rem] px-4 py-2 text-xs" disabled={busy || !dirty} onClick={() => void save()}>
              Save category
            </Button>
            <button
              type="button"
              className="min-h-[2.5rem] px-2 text-xs text-dc-danger hover:underline disabled:opacity-40"
              disabled={busy}
              onClick={() => onDelete(category.id)}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )
}

export function RegistrationCategoryList({
  eventSlug,
  canEdit,
  categories,
  onCategoriesChange,
  onMessage,
  onError,
}: {
  eventSlug: string
  canEdit: boolean
  categories: RegistrationCategory[]
  onCategoriesChange: () => Promise<void>
  onMessage: (msg: string | null) => void
  onError: (msg: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [newRoleKind, setNewRoleKind] = useState<RegistrationRoleKind>('attendee')
  const [newName, setNewName] = useState('Weekend pass')
  const [newExpectedHours, setNewExpectedHours] = useState('')
  const [newCapacity, setNewCapacity] = useState('')
  const [newGenerateCode, setNewGenerateCode] = useState(false)
  const [newStaffUnlock, setNewStaffUnlock] = useState(false)
  const { ask, dialog } = useConfirmDialog()

  function applyNewRoleKind(kind: RegistrationRoleKind) {
    const meta = roleKindMeta(kind)
    setNewRoleKind(kind)
    setNewName(meta.defaultName || 'Custom')
    setNewExpectedHours(meta.defaultHours !== null ? String(meta.defaultHours) : '')
    setNewStaffUnlock(meta.defaultStaffUnlock)
    setNewGenerateCode(kind === 'staff' || kind === 'volunteer' || kind === 'comp')
  }

  async function deleteCategory(id: string) {
    if (!canEdit) return
    if (!(await ask({ title: 'Delete category?', message: 'Delete this category?', destructive: true }))) return
    setBusy(true)
    onError(null)
    try {
      await organizerDancecardFetch(eventSlug, `/registration-categories/${id}`, { method: 'DELETE' })
      await onCategoriesChange()
      onMessage('Category removed.')
    } catch (e) {
      onError(formatCategoryApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    if (!canEdit || !newName.trim()) return
    const capacityTrim = newCapacity.trim()
    const capacity = capacityTrim === '' ? null : Number.parseInt(capacityTrim, 10)
    if (capacity !== null && (Number.isNaN(capacity) || capacity < 0)) {
      onError('Capacity must be a non-negative number or blank.')
      return
    }
    const expectedHours = parseExpectedHours(newExpectedHours)
    if (expectedHours !== null && Number.isNaN(expectedHours)) {
      onError('Hours of service must be a non-negative number or blank.')
      return
    }
    const accessCode = newGenerateCode ? generateAccessCodeClient() : null
    setBusy(true)
    onError(null)
    try {
      await organizerDancecardFetch(eventSlug, '/registration-categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          roleKind: newRoleKind,
          expectedHours,
          capacity,
          accessCode,
          grantsStaffAccess: newStaffUnlock,
        }),
      })
      applyNewRoleKind('attendee')
      setNewCapacity('')
      setNewGenerateCode(false)
      await onCategoriesChange()
      onMessage('Category added.')
    } catch (e) {
      onError(formatCategoryApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      {dialog}
      <h3 className="text-sm font-semibold text-dc-text">Registration categories</h3>
      <p className="mt-1 text-xs text-dc-muted">
        Each category is a registration type attendees pick (attendee, staff, presenter, vendor, etc.). Set capacity,
        hours of service, and comp codes per type. The attendee form lists every category you add here.
      </p>
      {categories.length === 0 ? (
        <p className="mt-3 text-sm italic text-dc-muted">
          No categories yet. Add Attendee, Staff, Presenter, Photographer, Vendor, or custom types.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              canEdit={canEdit}
              eventSlug={eventSlug}
              busy={busy}
              setBusy={setBusy}
              onSaved={() => void onCategoriesChange()}
              onError={(m) => onError(m || null)}
              onMessage={(m) => onMessage(m)}
              onDelete={(id) => void deleteCategory(id)}
            />
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="mt-4 rounded-lg border border-dashed border-dc-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">Add category</p>
          <div className={`mt-3 ${CATEGORY_FIELD_GRID}`}>
            <label className={CATEGORY_FIELD_LABEL_CLASS}>
              <span>Role type</span>
              <select
                className={`${SETTINGS_FIELD_CLASS} mt-0`}
                value={newRoleKind}
                disabled={busy}
                onChange={(e) => applyNewRoleKind(e.target.value as RegistrationRoleKind)}
              >
                {REGISTRATION_ROLE_KINDS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={CATEGORY_FIELD_LABEL_CLASS}>
              <span>Display name</span>
              <input
                className={`${SETTINGS_FIELD_CLASS} mt-0`}
                placeholder="Shown on registration form"
                value={newName}
                disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className={CATEGORY_FIELD_LABEL_CLASS}>
              <span>Hours of service</span>
              <input
                className={`${SETTINGS_FIELD_CLASS} mt-0`}
                type="number"
                min={0}
                step={0.5}
                placeholder="Optional"
                value={newExpectedHours}
                disabled={busy}
                onChange={(e) => setNewExpectedHours(e.target.value)}
              />
            </label>
            <label className={CATEGORY_FIELD_LABEL_CLASS}>
              <span>Capacity</span>
              <input
                className={`${SETTINGS_FIELD_CLASS} mt-0`}
                type="number"
                min={0}
                placeholder="Unlimited"
                value={newCapacity}
                disabled={busy}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-dc-text">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newGenerateCode}
                disabled={busy}
                onChange={(e) => setNewGenerateCode(e.target.checked)}
              />
              Generate comp code
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newStaffUnlock}
                disabled={busy}
                onChange={(e) => setNewStaffUnlock(e.target.checked)}
              />
              Staff unlock code
            </label>
          </div>
          <Button type="button" className="mt-3" disabled={busy || !newName.trim()} onClick={() => void addCategory()}>
            Add category
          </Button>
        </div>
      ) : null}
    </Panel>
  )
}
