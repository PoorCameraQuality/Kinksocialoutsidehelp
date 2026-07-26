import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiMailIntake, type MailIntakeDetail, type MailIntakeTab } from '@/hooks/useApiMailIntake'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

const TABS: { id: MailIntakeTab; label: string }[] = [
  { id: 'support', label: 'Support' },
  { id: 'legal', label: 'Legal' },
  { id: 'business', label: 'Business' },
  { id: 'abuse', label: 'Abuse / Safety' },
  { id: 'security', label: 'Security' },
]

export default function ModerationMailIntakePage() {
  const { staff } = useApiPlatformStaff(true)
  const api = useApiMailIntake()
  const [tab, setTab] = useState<MailIntakeTab>('support')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MailIntakeDetail | null>(null)
  const [status, setStatus] = useState('new')
  const [priority, setPriority] = useState('normal')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const canAccess =
    staff?.siteOwner ||
    staff?.siteAdmin ||
    staff?.trustSafetyAdmin ||
    staff?.legalAdmin

  const { loadSummary, loadTab, loadItem } = api

  const reload = useCallback(async () => {
    await loadSummary()
    await loadTab(tab)
  }, [loadSummary, loadTab, tab])

  useEffect(() => {
    if (canAccess) void reload()
  }, [canAccess, reload])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void (async () => {
      const d = await loadItem(selectedId)
      setDetail(d)
      if (d) {
        setStatus(d.status)
        setPriority(d.priority)
      }
    })()
  }, [selectedId, loadItem])

  if (!canAccess) {
    return (
      <p className="text-sm text-dc-muted">
        Platform staff access required.{' '}
        <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">
          Dashboard
        </Link>
      </p>
    )
  }

  async function saveItem() {
    if (!selectedId || !reason.trim()) {
      setMsg('Select an item and provide an audit reason.')
      return
    }
    setMsg(null)
    try {
      await api.patchItem(selectedId, { status, priority, reason: reason.trim() })
      setReason('')
      await reload()
      const d = await api.loadItem(selectedId)
      setDetail(d)
      setMsg('Updated.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dc-text">Mail intake</h1>
        <p className="mt-1 text-sm text-dc-muted max-w-prose">
          Inbound email imported from staff mailboxes. Legal and security tabs are owner-only. Messages remain in
          Roundcube webmail.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setSelectedId(null)
            }}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              tab === t.id ?
                'bg-dc-accent/15 text-dc-accent'
              : 'bg-dc-elevated-muted text-dc-muted hover:text-dc-text'
            }`}
          >
            {t.label}
            {(api.newCounts[t.id] ?? 0) > 0 ?
              <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-dc-accent/20 px-1.5 text-xs">
                {api.newCounts[t.id]}
              </span>
            : null}
          </button>
        ))}
      </div>

      {api.error ?
        <p className="text-sm text-amber-300">{api.error}</p>
      : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/40 overflow-hidden">
          <div className="border-b border-dc-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-dc-muted">
            Inbox
          </div>
          <ul className="divide-y divide-dc-border max-h-[28rem] overflow-y-auto">
            {api.loading ?
              <li className="px-4 py-6 text-sm text-dc-muted">Loading…</li>
            : api.items.length === 0 ?
              <li className="px-4 py-6 text-sm text-dc-muted">No messages in this tab.</li>
            : api.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left hover:bg-dc-elevated-muted ${
                      selectedId === item.id ? 'bg-dc-accent/10' : ''
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="text-sm font-medium text-dc-text truncate">{item.subject}</div>
                    <div className="text-xs text-dc-muted mt-0.5">
                      {item.fromName ?? item.fromEmail} · {new Date(item.receivedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-dc-muted">{item.mailbox}</div>
                  </button>
                </li>
              ))
            }
          </ul>
        </div>

        <div className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-4 space-y-4">
          {!detail ?
            <p className="text-sm text-dc-muted">Select a message to view sanitized content.</p>
          : <>
              <div>
                <h2 className="text-base font-semibold text-dc-text">{detail.subject}</h2>
                <p className="text-sm text-dc-muted mt-1">
                  From {detail.fromName ? `${detail.fromName} <${detail.fromEmail}>` : detail.fromEmail}
                </p>
                <p className="text-xs text-dc-muted">To {detail.toEmail} · {detail.mailbox}</p>
              </div>
              {detail.sanitizedHtmlBody ?
                <div
                  className="prose prose-invert max-w-none text-sm border border-dc-border rounded-xl p-3 max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: detail.sanitizedHtmlBody }}
                />
              : detail.plainTextBody ?
                <pre className="text-sm whitespace-pre-wrap border border-dc-border rounded-xl p-3 max-h-64 overflow-y-auto">
                  {detail.plainTextBody}
                </pre>
              : <p className="text-sm text-dc-muted">No body content.</p>}
              {(detail.attachmentMetadata?.length ?? 0) > 0 ?
                <p className="text-xs text-dc-muted">
                  Attachments (metadata only):{' '}
                  {detail.attachmentMetadata.map((a) => a.filename).join(', ')}
                </p>
              : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-dc-muted block mb-1">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-dc-border bg-dc-bg px-2 py-2"
                  >
                    {['new', 'triaged', 'assigned', 'waiting', 'closed'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-dc-muted block mb-1">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-dc-border bg-dc-bg px-2 py-2"
                  >
                    {['normal', 'high', 'urgent'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-sm block">
                <span className="text-dc-muted block mb-1">Audit reason (required)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-dc-border bg-dc-bg px-3 py-2"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveItem()}
                className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
              >
                Save changes
              </button>
              {msg ? <p className="text-xs text-dc-muted">{msg}</p> : null}
            </>
          }
        </div>
      </div>
    </div>
  )
}
