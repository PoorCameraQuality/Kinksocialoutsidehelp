import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { renderQuestionInput, type QuestionnaireField } from '@/lib/questionnaireRender'

type RoleQuestion = QuestionnaireField

type Role = {
  id: string
  applySlug: string
  title: string
  description: string | null
  introText: string
  confirmationText: string
  questions: RoleQuestion[]
}

type Info = {
  convention: { id: string; slug: string; name: string }
  role: Role
}

const API_BASE = '/api/v1'

export default function TrustedRoleApplyPage() {
  const params = useParams<{ slug: string; applySlug: string }>()
  const slug = params.slug ?? ''
  const applySlug = params.applySlug ?? ''
  const navigate = useNavigate()
  const { status, isAuthenticated, isFallback } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const [info, setInfo] = useState<Info | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!slug || !applySlug) return
    fetch(
      `${API_BASE}/public/conventions/${encodeURIComponent(slug)}/trusted-roles/${encodeURIComponent(applySlug)}`,
      { credentials: 'include' },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`)
        return (await r.json()) as Info
      })
      .then(setInfo)
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [slug, applySlug])

  const questions = useMemo(() => info?.role.questions ?? [], [info])

  if (status === 'loading') {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-text-muted">Checking session…</div>
  }
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Sign in to apply</h1>
        <Link
          to={buildLoginHref(`/conventions/${slug}/apply/${applySlug}`)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
        >
          Sign in
        </Link>
      </div>
    )
  }
  if (loadErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{loadErr}</p>
      </div>
    )
  }
  if (!info) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-text-muted">Loading…</div>
  }
  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Application submitted</h1>
        {info.role.confirmationText ? (
          <p className="mt-2 whitespace-pre-line text-sm text-dc-text-muted">
            {info.role.confirmationText}
          </p>
        ) : (
          <p className="mt-2 text-sm text-dc-text-muted">
            We’ll review your application and follow up. You can close this tab.
          </p>
        )}
        <Link
          to={`/conventions/${slug}`}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
        >
          Back to {info.convention.name}
        </Link>
      </div>
    )
  }

  async function submit() {
    setBusy(true)
    setSubmitErr(null)
    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        setBusy(false)
        return setSubmitErr(`Please answer “${q.label}”.`)
      }
    }
    const r = await fetch(
      `${API_BASE}/public/conventions/${encodeURIComponent(slug)}/trusted-roles/${encodeURIComponent(applySlug)}/apply`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, notes: notes.trim() || undefined }),
      },
    )
    setBusy(false)
    if (!r.ok) {
      try {
        const body = (await r.json()) as { error?: string }
        setSubmitErr(body.error ?? `Failed (${r.status})`)
      } catch {
        setSubmitErr(`Failed (${r.status})`)
      }
      return
    }
    setDone(true)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-dc-text">{info.role.title}</h1>
      <p className="mt-1 text-sm text-dc-muted">{info.convention.name}</p>
      {info.role.introText ? (
        <p className="mt-4 whitespace-pre-line rounded-xl border border-dc-border bg-dc-elevated/95 p-4 text-sm text-dc-text-muted">
          {info.role.introText}
        </p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {questions.map((q) => (
          <li key={q.id}>
            <label className="block text-sm font-medium text-dc-text">
              {q.label} {q.required ? <span className="text-red-400">*</span> : null}
            </label>
            {renderQuestionInput(q, answers[q.id], (v) => setAnswers((a) => ({ ...a, [q.id]: v })), busy)}
          </li>
        ))}
        <li>
          <label className="block text-sm font-medium text-dc-text">Anything else organizers should know?</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </li>
      </ul>
      {submitErr ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{submitErr}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-11 rounded-xl border border-dc-border-strong px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
          onClick={() => navigate(`/conventions/${slug}`)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-60"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </div>
  )
}
