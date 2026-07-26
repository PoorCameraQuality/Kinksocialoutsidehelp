import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { startConventionCheckout } from '@/hooks/useApiOrgStripe'
import PaymentsBuyerDisclaimer from '@/components/payments/PaymentsBuyerDisclaimer'
import { buildLoginHref } from '@/lib/auth-links'
import { renderQuestionInput, type QuestionnaireField } from '@/lib/questionnaireRender'

type Category = {
  id: string
  name: string
  description: string | null
  capacity: number | null
  capacityMax: number | null
  priceCents: number | null
  roleKind: string
  roleKindLabel: string
  requiresAccessCode: boolean
  expectedHours: number | null
  grantsStaffAccess: boolean
}

type FormQuestion = QuestionnaireField & {
  visibilityRulesJson: Record<string, unknown>
  requiredForCategoryIds: string[]
}

type Form = {
  id: string
  status: 'draft' | 'published'
  introText: string
  confirmationText: string
  questions: FormQuestion[]
} | null

type Policy = {
  id: string
  title: string
  kind: string
  version: number
  bodyMarkdown: string | null
  bodyHtml: string | null
  requiredForRegistration: boolean
}

type RegisterInfo = {
  convention: { id: string; slug: string; name: string }
  categories: Category[]
  policies: Policy[]
  form: Form
  payments?: {
    processor: 'stripe' | 'external' | 'manual'
    externalPaymentUrl: string | null
    stripeReady: boolean
  }
}

type Step = 'category' | 'form' | 'policies' | 'success'

const API_BASE = '/api/v1'

async function loadRegisterInfo(slug: string): Promise<RegisterInfo> {
  const r = await fetch(`${API_BASE}/public/conventions/${encodeURIComponent(slug)}/register-info`, {
    credentials: 'include',
  })
  if (!r.ok) throw new Error(`Failed to load registration info (${r.status})`)
  return (await r.json()) as RegisterInfo
}

async function submitRegistration(
  slug: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch(`${API_BASE}/public/conventions/${encodeURIComponent(slug)}/registrations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    let err = `Registration failed (${r.status})`
    try {
      const body = (await r.json()) as { error?: string }
      if (body.error) err = body.error
    } catch {
      // ignore
    }
    return { ok: false, error: err }
  }
  return { ok: true }
}

function RegisterFlowSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading registration">
      <div className="flex items-center gap-2">
        <div className="h-3 w-16 rounded bg-dc-elevated-muted" />
        <div className="h-3 w-2 rounded bg-dc-elevated-muted" />
        <div className="h-3 w-14 rounded bg-dc-elevated-muted" />
        <div className="h-3 w-2 rounded bg-dc-elevated-muted" />
        <div className="h-3 w-16 rounded bg-dc-elevated-muted" />
      </div>
      <div className="h-40 rounded-2xl border border-dc-border bg-dc-elevated-muted" />
      <div className="h-56 rounded-2xl border border-dc-border bg-dc-elevated-muted" />
      <div className="h-32 rounded-2xl border border-dc-border bg-dc-elevated-muted" />
    </div>
  )
}

export default function RegisterFlow({
  slug,
  successConventionTab = 'Welcome',
}: {
  slug: string
  /** Convention hub tab after successful registration (parent may pass Schedule). */
  successConventionTab?: 'Welcome' | 'Schedule'
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { status, isAuthenticated, isFallback } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const [info, setInfo] = useState<RegisterInfo | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('category')
  const [busy, setBusy] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState<string>('')
  const [accessCode, setAccessCode] = useState('')
  const [badgeName, setBadgeName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [acceptedPolicies, setAcceptedPolicies] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    loadRegisterInfo(slug)
      .then((r) => {
        if (!cancelled) setInfo(r)
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const cat = searchParams.get('category')
    const code = searchParams.get('code')
    if (cat) setCategoryId(cat)
    if (code) setAccessCode(code)
  }, [searchParams])

  const selectedCategory = useMemo(
    () => info?.categories.find((c) => c.id === categoryId) ?? null,
    [info, categoryId],
  )

  const showPaidCategoryDisclaimer = useMemo(
    () => (info?.categories ?? []).some((c) => (c.priceCents ?? 0) > 0),
    [info?.categories],
  )

  const visibleQuestions = useMemo(() => {
    if (!info?.form?.questions) return [] as FormQuestion[]
    return info.form.questions.filter((q) => {
      const requiredForIds = q.requiredForCategoryIds ?? []
      // Show every question by default; if the question is required only for
      // specific categories, show it for those categories. Other visibility
      // rules are evaluated server-side.
      if (requiredForIds.length && categoryId && !requiredForIds.includes(categoryId) && !q.required) {
        return true
      }
      return true
    })
  }, [info, categoryId])

  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-center text-dc-text-muted">
        Checking your session…
      </div>
    )
  }
  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Sign in to register</h2>
        <p className="mt-2 text-sm text-dc-text-muted">
          You need a Kink Social account so the convention has one identity per attendee.
        </p>
        <Link
          to={buildLoginHref(`/conventions/${slug}/register`)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">{loadErr}</div>
    )
  }
  if (!info) {
    return <RegisterFlowSkeleton />
  }

  if (step === 'success') {
    const needsPay = (selectedCategory?.priceCents ?? 0) > 0
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-100">
        <h2 className="text-lg font-semibold">You’re registered for {info.convention.name}.</h2>
        {info.form?.confirmationText ? (
          <p className="mt-2 whitespace-pre-line text-sm text-emerald-100/90">{info.form.confirmationText}</p>
        ) : null}
        {needsPay ? (
          <div className="mt-4 space-y-2">
            {info.payments?.processor === 'external' && info.payments.externalPaymentUrl ? (
              <>
                <p className="text-sm text-emerald-100/90">
                  This category has a fee. Complete payment with the organizer&apos;s external checkout,
                  then wait for them to confirm access.
                </p>
                <a
                  href={info.payments.externalPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-on-accent"
                >
                  Open payment page
                </a>
              </>
            ) : info.payments?.processor === 'manual' ||
              (info.payments?.processor === 'external' && !info.payments.externalPaymentUrl) ? (
              <p className="text-sm text-emerald-100/90">
                This category has a fee. The organizer collects payment outside Kink Social (cash or
                their own processor) and will confirm paid access.
              </p>
            ) : (
              <>
                <p className="text-sm text-emerald-100/90">
                  This category has a fee. Pay securely through the organizer&apos;s Stripe account when
                  ready.
                </p>
                <button
                  type="button"
                  disabled={busy || !categoryId || info.payments?.stripeReady === false}
                  className="min-h-11 rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-on-accent disabled:opacity-60"
                  onClick={() => {
                    if (!categoryId) return
                    setBusy(true)
                    setSubmitErr(null)
                    void startConventionCheckout({ conventionKey: slug, categoryId })
                      .then((url) => {
                        window.location.href = url
                      })
                      .catch((e: unknown) => {
                        setBusy(false)
                        setSubmitErr(e instanceof Error ? e.message : 'Checkout failed')
                      })
                  }}
                >
                  {busy ? 'Starting checkout…' : 'Pay with Stripe'}
                </button>
                {info.payments?.stripeReady === false ? (
                  <p className="text-sm text-emerald-100/80">
                    Online card checkout is not ready yet. Contact the organizer about payment.
                  </p>
                ) : null}
              </>
            )}
            {submitErr ? <p className="text-sm text-red-200">{submitErr}</p> : null}
            <PaymentsBuyerDisclaimer
              variant="short"
              className="rounded-xl border border-emerald-500/20 bg-black/20 px-3 py-2 text-xs text-emerald-100/80"
            />
          </div>
        ) : null}
        <p className="mt-4 text-sm">
          <Link
            to={`/conventions/${encodeURIComponent(slug)}?tab=${encodeURIComponent(successConventionTab)}`}
            className="font-semibold underline hover:no-underline"
          >
            Back to {info.convention.name}
          </Link>
        </p>
      </div>
    )
  }

  async function next() {
    setSubmitErr(null)
    if (step === 'category') {
      if (!categoryId) return setSubmitErr('Pick a category to continue.')
      if (selectedCategory?.requiresAccessCode && !accessCode.trim()) {
        return setSubmitErr('This category requires a comp / access code.')
      }
      setStep(info?.form?.questions?.length ? 'form' : info?.policies?.length ? 'policies' : 'category')
      if (!info?.form?.questions?.length && !info?.policies?.length) {
        await submit()
        return
      }
      if (info?.form?.questions?.length) setStep('form')
      else if (info?.policies?.length) setStep('policies')
      return
    }
    if (step === 'form') {
      for (const q of visibleQuestions) {
        if (q.required && !answers[q.id]) {
          return setSubmitErr(`Please answer “${q.label}”.`)
        }
      }
      if (info?.policies?.length) setStep('policies')
      else await submit()
      return
    }
    if (step === 'policies') {
      const required = info?.policies.filter((p) => p.requiredForRegistration) ?? []
      for (const p of required) {
        if (!acceptedPolicies[p.id]) {
          return setSubmitErr(`Please accept “${p.title}”.`)
        }
      }
      await submit()
    }
  }

  async function submit() {
    if (!info) return
    setBusy(true)
    setSubmitErr(null)
    const payload: Record<string, unknown> = {
      categoryId,
      accessCode: accessCode.trim() || undefined,
      badgeName: badgeName.trim() || undefined,
      legalName: legalName.trim() || undefined,
      pronouns: pronouns.trim() || undefined,
      phone: phone.trim() || undefined,
      answers: Object.keys(answers).length ? answers : undefined,
      policyAcceptances: Object.entries(acceptedPolicies)
        .filter(([, v]) => v)
        .map(([policyId]) => ({ policyId, signatureMethod: 'click' as const })),
    }
    const res = await submitRegistration(slug, payload)
    setBusy(false)
    if (res.ok) {
      setStep('success')
    } else {
      setSubmitErr(res.error)
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-xs uppercase tracking-wide text-dc-muted">
        <li className={step === 'category' ? 'text-dc-text' : ''}>1. Category</li>
        <li>›</li>
        <li className={step === 'form' ? 'text-dc-text' : ''}>2. Details</li>
        <li>›</li>
        <li className={step === 'policies' ? 'text-dc-text' : ''}>3. Policies</li>
      </ol>

      {info.form?.introText && step === 'category' ? (
        <p className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4 text-sm text-dc-text-muted whitespace-pre-line">
          {info.form.introText}
        </p>
      ) : null}

      {step === 'category' ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-dc-text">Pick a category</h2>
          {showPaidCategoryDisclaimer ? (
            <div className="space-y-2">
              <p
                className="rounded-xl border border-dc-accent-border/30 bg-dc-accent/10 px-4 py-3 text-sm text-dc-text-muted"
                role="note"
              >
                <span className="font-medium text-dc-text">Paid categories.</span> After you register, you can pay
                through the organizer&apos;s Stripe account when they have Connect enabled. Cash, comps, and
                external ticket links still work when organizers mark you paid manually.
              </p>
              <PaymentsBuyerDisclaimer variant="note" />
            </div>
          ) : null}
          {info.categories.length === 0 ? (
            <p className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4 text-sm text-dc-text-muted">
              Registration isn’t open yet for this convention.
            </p>
          ) : (
            <ul className="space-y-2">
              {info.categories.map((c) => (
                <li key={c.id}>
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border bg-dc-elevated/95 p-4 hover:border-dc-accent-border/40 ${
                      categoryId === c.id ? 'border-dc-accent' : 'border-dc-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-semibold text-dc-text">{c.name}</span>
                        <span className="ml-2 text-xs uppercase tracking-wide text-dc-muted">
                          {c.roleKindLabel}
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="category"
                        value={c.id}
                        checked={categoryId === c.id}
                        onChange={() => setCategoryId(c.id)}
                      />
                    </div>
                    {c.description ? (
                      <p className="text-xs text-dc-text-muted">{c.description}</p>
                    ) : null}
                    <p className="text-[11px] text-dc-muted">
                      {c.priceCents != null ? `$${(c.priceCents / 100).toFixed(2)} · ` : ''}
                      {c.capacityMax != null ? `Capacity ${c.capacityMax}` : 'Open capacity'}
                      {c.expectedHours ? ` · ${c.expectedHours} hrs service` : ''}
                      {c.grantsStaffAccess ? ' · Staff access' : ''}
                      {c.requiresAccessCode ? ' · Requires comp code' : ''}
                    </p>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {selectedCategory?.requiresAccessCode ? (
            <label className="block text-sm text-dc-text">
              Comp / access code
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 font-mono text-sm uppercase tracking-wider text-dc-text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
            </label>
          ) : null}
        </section>
      ) : null}

      {step === 'form' ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-dc-text">Your details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-dc-text">
              Badge name
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text"
                value={badgeName}
                onChange={(e) => setBadgeName(e.target.value)}
              />
            </label>
            <label className="text-sm text-dc-text">
              Legal name
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </label>
            <label className="text-sm text-dc-text">
              Pronouns
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
              />
            </label>
            <label className="text-sm text-dc-text">
              Phone
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          {visibleQuestions.length ? (
            <ul className="space-y-3">
              {visibleQuestions.map((q) => (
                <li key={q.id}>
                  <label className="block text-sm font-medium text-dc-text">
                    {q.label} {q.required ? <span className="text-red-400">*</span> : null}
                  </label>
                  {renderQuestionInput(
                    q,
                    answers[q.id],
                    (v) => setAnswers((a) => ({ ...a, [q.id]: v })),
                    busy,
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {step === 'policies' ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-dc-text">Policies</h2>
          {info.policies.length === 0 ? (
            <p className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4 text-sm text-dc-text-muted">
              No policies to accept.
            </p>
          ) : (
            <ul className="space-y-3">
              {info.policies.map((p) => (
                <li key={p.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-dc-text">
                        {p.title}{' '}
                        <span className="text-xs uppercase text-dc-muted">
                          {p.kind} v{p.version}
                        </span>
                      </h3>
                      {p.bodyMarkdown ? (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-sans text-xs text-dc-text-muted">
                          {p.bodyMarkdown}
                        </pre>
                      ) : null}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-dc-text">
                      <input
                        type="checkbox"
                        checked={Boolean(acceptedPolicies[p.id])}
                        onChange={(e) => setAcceptedPolicies((a) => ({ ...a, [p.id]: e.target.checked }))}
                      />
                      {p.requiredForRegistration ? 'Required' : 'Accept'}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {submitErr ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{submitErr}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
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
          onClick={() => void next()}
        >
          {busy ? 'Submitting…' : step === 'policies' || (step === 'form' && !info.policies.length) ? 'Submit registration' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
