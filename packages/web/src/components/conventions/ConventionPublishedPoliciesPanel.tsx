import { useCallback, useEffect, useState } from 'react'

type PolicyRow = {
  id: string
  title: string
  kind: string
  version: number
  bodyMarkdown: string | null
  bodyHtml: string | null
  accepted: boolean
}

export default function ConventionPublishedPoliciesPanel({ conventionKey }: { conventionKey: string }) {
  const key = encodeURIComponent(conventionKey)
  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [signerName, setSignerName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/v1/conventions/${key}/policies/published`, { credentials: 'include' })
    if (!r.ok) {
      setErr('Could not load policies.')
      return
    }
    const d = (await r.json()) as { policies: PolicyRow[] }
    setPolicies(d.policies ?? [])
    setSelected(new Set((d.policies ?? []).filter((p) => !p.accepted).map((p) => p.id)))
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  async function sign() {
    setMsg(null)
    setErr(null)
    const ids = [...selected]
    if (ids.length === 0 || !signerName.trim()) {
      setErr('Select policies and enter your legal name.')
      return
    }
    const r = await fetch(`/api/v1/conventions/${key}/policies/sign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyIds: ids, signerName: signerName.trim() }),
    })
    if (!r.ok) {
      setErr('Could not sign policies.')
      return
    }
    setMsg('Policies signed.')
    void load()
  }

  if (policies.length === 0) {
    return <p className="text-sm text-dc-muted">No published policies for this convention yet.</p>
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-dc-text-muted">
        Read each policy below, then sign with your legal name. Organizers see acceptance in their compliance exports.
      </p>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-200">{msg}</p> : null}
      <div className="space-y-3">
        {policies.map((p) => (
          <details key={p.id} className="group rounded-xl border border-dc-border bg-dc-elevated/95/40 open:bg-dc-elevated/95/70">
            <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex items-start gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(p.id)}
                    disabled={p.accepted}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(p.id)
                        else next.delete(p.id)
                        return next
                      })
                    }}
                  />
                  <span>
                    <span className="font-semibold text-dc-text">{p.title}</span>
                    <span className="ml-2 text-xs text-dc-muted">
                      {p.kind} · v{p.version}
                      {p.accepted ? ' · signed' : ''}
                    </span>
                  </span>
                </label>
                <span className="ml-auto text-xs text-dc-accent group-open:hidden">Expand to read</span>
              </div>
            </summary>
            <div className="border-t border-dc-border px-4 pb-4 pt-2">
              {p.bodyHtml ?
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: p.bodyHtml }}
                />
              : p.bodyMarkdown ?
                <pre className="whitespace-pre-wrap text-sm text-dc-text-muted">{p.bodyMarkdown}</pre>
              : <p className="text-sm text-dc-muted">No policy text published.</p>}
            </div>
          </details>
        ))}
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3 max-w-lg">
        <p className="text-sm font-semibold text-dc-text">Sign required policies</p>
        <label className="block text-xs text-dc-muted">
          Legal name (signature)
          <input
            className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-xl bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500"
          onClick={() => void sign()}
        >
          Sign selected policies
        </button>
      </div>
    </div>
  )
}
