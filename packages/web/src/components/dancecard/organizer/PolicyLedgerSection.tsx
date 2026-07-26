'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { organizerConventionApiBase, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { Panel } from '@/components/dancecard/ui/Panel'
import { policyKindLabel } from '@/lib/dancecard/policyKindLabels'

type Doc = {
  id: string
  kind: string
  version: number
  title: string
  bodyMarkdown: string
  publishedAt: string | null
}

const KINDS = ['coc', 'waiver', 'photo', 'marketing'] as const

function nextVersionForKind(documents: Doc[], kind: string) {
  const versions = documents.filter((d) => d.kind === kind).map((d) => d.version)
  return versions.length ? Math.max(...versions) + 1 : 1
}

export function PolicyLedgerSection({
  eventSlug,
  readOnly,
  embedded,
}: {
  eventSlug: string
  readOnly: boolean
  embedded?: boolean
}) {
  const [documents, setDocuments] = useState<Doc[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<(typeof KINDS)[number]>('waiver')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const { ask, dialog } = useConfirmDialog()

  const editingDoc = useMemo(() => documents.find((d) => d.id === editingId) ?? null, [documents, editingId])
  const formMode = editingId ? 'edit' : 'create'
  const nextVersion = useMemo(() => nextVersionForKind(documents, kind), [documents, kind])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ documents: Doc[] }>(eventSlug, '/policy-documents')
      setDocuments(res.documents ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load policies')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setKind('waiver')
  }

  function startEdit(doc: Doc) {
    setEditingId(doc.id)
    setKind(doc.kind as (typeof KINDS)[number])
    setTitle(doc.title)
    setBody(doc.bodyMarkdown)
    setOkMsg(null)
    setErr(null)
  }

  function startNewVersion(doc: Doc) {
    setEditingId(null)
    setKind(doc.kind as (typeof KINDS)[number])
    setTitle(doc.title)
    setBody(doc.bodyMarkdown)
    setOkMsg(null)
    setErr(null)
  }

  async function saveDocument() {
    if (readOnly) return
    if (!title.trim()) {
      setErr('Title required')
      return
    }
    setBusy(true)
    setErr(null)
    setOkMsg(null)
    try {
      if (editingId) {
        await organizerDancecardFetch(eventSlug, `/policy-documents/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: title.trim(),
            bodyMarkdown: body,
          }),
        })
        setOkMsg('Policy updated. Attendees who already signed keep their acceptance on this version.')
        resetForm()
      } else {
        const version = nextVersionForKind(documents, kind)
        await organizerDancecardFetch(eventSlug, '/policy-documents', {
          method: 'POST',
          body: JSON.stringify({
            kind,
            version,
            title: title.trim(),
            bodyMarkdown: body,
            publishedAt: new Date().toISOString(),
          }),
        })
        setOkMsg(
          version > 1
            ? `Published v${version} of ${policyKindLabel(kind)}. Attendees must sign the new version if it is required.`
            : `Published ${policyKindLabel(kind)}.`,
        )
        resetForm()
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDoc(doc: Doc) {
    if (readOnly) return
    const acceptedNote =
      'Deleting removes this document and any recorded acceptances tied to it. Consider publishing a new version instead if people have already signed.'
    if (
      !(await ask({
        title: `Delete ${doc.title}?`,
        message: `${acceptedNote}\n\n${policyKindLabel(doc.kind)} · v${doc.version}`,
        confirmLabel: 'Delete',
        destructive: true,
      }))
    )
      return
    setBusy(true)
    setErr(null)
    setOkMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/policy-documents/${doc.id}`, { method: 'DELETE' })
      if (editingId === doc.id) resetForm()
      setOkMsg('Policy deleted.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function exportLedger(format: 'csv' | 'json') {
    const url = `${organizerConventionApiBase(eventSlug)}/policy-acceptances/export?format=${format}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const text = await res.text()
      setErr(text.slice(0, 400))
      return
    }
    if (format === 'json') {
      const json = await res.json()
      const text = JSON.stringify(json, null, 2)
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `policy-acceptances-${eventSlug}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      return
    }
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `policy-acceptances-${eventSlug}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const rootClass = embedded ? 'space-y-4' : 'mt-8 space-y-4 border-t border-dc-border pt-6'

  return (
    <Panel className={rootClass}>
      {dialog}
      <div>
        <h3 className="font-serif text-lg text-dc-text">Policy documents</h3>
        <p className="mt-1 text-sm text-dc-muted">
          Published versions attendees see when they sign. <strong>Edit</strong> fixes typos on the current version.{' '}
          <strong>New version</strong> publishes v2+ when requirements change. Attendees may need to sign again.
        </p>
      </div>
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {okMsg ? <p className="text-sm text-dc-success">{okMsg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:bg-dc-elevated-muted"
          onClick={() => void exportLedger('csv')}
        >
          Download signatures (CSV)
        </button>
        <button
          type="button"
          className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:bg-dc-elevated-muted"
          onClick={() => void exportLedger('json')}
        >
          Download signatures (JSON)
        </button>
      </div>

      <ul className="space-y-2 rounded-xl border border-dc-border bg-dc-surface-muted/40 p-3 text-sm">
        {documents.map((d) => (
          <li
            key={d.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
              editingId === d.id ? 'border-dc-accent-border bg-dc-accent-muted/30' : 'border-dc-border bg-dc-elevated/50'
            }`}
          >
            <div className="min-w-0">
              <span className="font-medium text-dc-text">{d.title}</span>
              <p className="text-xs text-dc-muted">
                {policyKindLabel(d.kind)} · v{d.version}
                {d.publishedAt ? ' · published' : ' · draft'}
              </p>
            </div>
            {!readOnly ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-dc-accent hover:underline"
                  onClick={() => startEdit(d)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-dc-muted hover:text-dc-text hover:underline"
                  onClick={() => startNewVersion(d)}
                >
                  New version
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-dc-danger hover:underline"
                  onClick={() => void deleteDoc(d)}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {!documents.length ? <li className="text-dc-muted">No policy documents yet.</li> : null}
      </ul>

      {!readOnly ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated p-4">
          <p className="text-sm font-medium text-dc-text">
            {formMode === 'edit' ? `Edit ${editingDoc?.title ?? 'policy'}` : 'Publish a new version'}
          </p>
          {formMode === 'edit' ? (
            <p className="mt-1 text-xs text-dc-muted">
              Updates this version in place. Use &quot;New version&quot; on the list if you need a fresh sign-off.
            </p>
          ) : (
            <p className="mt-1 text-xs text-dc-muted">
              Next version for {policyKindLabel(kind)}: <strong>v{nextVersion}</strong>
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={SETTINGS_LABEL_CLASS}>
              Policy type
              <select
                className={SETTINGS_FIELD_CLASS}
                value={kind}
                disabled={formMode === 'edit'}
                onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {policyKindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className={SETTINGS_LABEL_CLASS}>
              Title
              <input className={SETTINGS_FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
          <label className={`${SETTINGS_LABEL_CLASS} mt-3 block`}>
            Body (markdown)
            <textarea
              className={`${SETTINGS_FIELD_CLASS} min-h-[120px]`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
              onClick={() => void saveDocument()}
            >
              {busy ? 'Saving…' : formMode === 'edit' ? 'Save changes' : 'Publish document'}
            </button>
            {formMode === 'edit' || title || body ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-dc-border px-4 py-2 text-sm text-dc-muted hover:text-dc-text"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
