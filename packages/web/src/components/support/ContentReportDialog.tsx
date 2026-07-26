import { useEffect, useState } from 'react'
import Dialog from '@/components/ui/Dialog'

export type ContentReportTarget = {
  targetType: string
  targetId: string
  label: string
}

type Props = {
  open: ContentReportTarget | null
  onClose: () => void
  onSubmitted?: () => void
}

export default function ContentReportDialog({ open, onClose, onSubmitted }: Props) {
  const [category, setCategory] = useState('spam')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategory('spam')
    setBody('')
    setMsg(null)
  }, [open])

  async function submit() {
    const target = open
    if (!target) return
    setMsg(null)
    setBusy(true)
    try {
      const r = await fetch('/api/v1/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: target.targetType,
          targetId: target.targetId,
          category,
          body: body.trim() || undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsg(j.error ?? 'Could not submit report')
        return
      }
      onSubmitted?.()
      onClose()
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      title={open ? `Report ${open.label}` : 'Report'}
      description="Moderators will review this report."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-4 rounded-xl text-sm border border-dc-border text-dc-text-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <label className="block text-xs text-dc-muted mb-1">Category</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-dc-elevated-solid border border-dc-border rounded-lg px-2 py-2 text-sm text-dc-text mb-3"
      >
        <option value="spam">Spam</option>
        <option value="harassment">Harassment</option>
        <option value="illegal">Illegal / safety</option>
        <option value="other">Other</option>
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Optional details"
        className="w-full bg-dc-elevated-solid border border-dc-border rounded-xl p-3 text-sm text-dc-text-muted"
      />
      {msg ? <p className="text-sm text-dc-danger mt-2">{msg}</p> : null}
    </Dialog>
  )
}
