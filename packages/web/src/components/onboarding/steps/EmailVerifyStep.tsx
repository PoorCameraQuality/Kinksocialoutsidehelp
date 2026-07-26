import { useEffect, useState, type FormEvent } from 'react'
import { WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const MailIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

type Props = {
  onVerified: () => void
}

export default function EmailVerifyStep({ onVerified }: Props) {
  const [emailMasked, setEmailMasked] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/auth/email/status', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const j = (await r.json()) as { verified?: boolean; emailMasked?: string | null }
        if (cancelled) return
        setEmailMasked(j.emailMasked ?? null)
        if (j.verified) {
          setVerified(true)
          onVerified()
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onVerified])

  async function sendCode() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/auth/email/send-verification', {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; emailMasked?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not send code')
        return
      }
      if (j.emailMasked) setEmailMasked(j.emailMasked)
      setMsg('Verification code sent. Check your inbox (and Mailpit in local dev).')
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/auth/email/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Invalid code')
        return
      }
      setVerified(true)
      setMsg('Email verified.')
      onVerified()
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Any email works', body: 'We do not restrict Gmail, Hotmail, Proton, or custom domains.' },
        { title: 'Optional for now', body: 'You can skip and verify later from settings. We will gently remind you.' },
      ]}
    >
      <WizardStepHeader
        icon={MailIcon}
        eyebrow="Email"
        title="Verify your email"
        description="We only use email verification — no SMS. Confirming your address helps with account recovery."
      />

      {verified ?
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Your email is verified{emailMasked ? ` (${emailMasked})` : ''}.
        </p>
      : <div className="space-y-4">
          <p className="text-sm text-dc-text-muted">
            We will send a code to {emailMasked ? <strong className="text-dc-text">{emailMasked}</strong> : 'your account email'}.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendCode()}
            className="min-h-11 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          <form onSubmit={(e) => void submitCode(e)} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-dc-text-muted">Enter code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                className="w-full max-w-xs rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-sm text-dc-text"
              />
            </label>
            <button
              type="submit"
              disabled={busy || code.trim().length < 4}
              className="min-h-11 rounded-xl border border-dc-border px-4 text-sm font-semibold text-dc-text disabled:opacity-50"
            >
              Verify code
            </button>
          </form>
          {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
          {err ? <p className="text-sm text-red-200">{err}</p> : null}
        </div>
      }
    </OnboardingStepLayout>
  )
}
