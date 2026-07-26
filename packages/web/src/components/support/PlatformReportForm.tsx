import { useState, type FormEvent } from 'react'

import { Link } from 'react-router-dom'

import { mapLegacyReportCategoryToPolicyReason, POLICY_REASONS } from '@c2k/shared'

import { useAuth } from '@/contexts/AuthContext'

import { useSubmitReport } from '@/hooks/useSubmitReport'

import { buildLoginHref } from '@/lib/auth-links'

import { REPORT_TARGET_TYPES } from '@/lib/moderation/report-targets'



const CATEGORIES = [

  { value: 'harassment', label: 'Harassment or abuse' },

  { value: 'spam', label: 'Spam or scam' },

  { value: 'impersonation', label: 'Impersonation' },

  { value: 'safety', label: 'Safety concern' },

  { value: 'content', label: 'Inappropriate content' },

  { value: 'other', label: 'Other' },

] as const



type Props = {

  className?: string

}



export default function PlatformReportForm({ className = '' }: Props) {

  const { isAuthenticated, isFallback } = useAuth()

  const signedIn = isAuthenticated && !isFallback

  const [category, setCategory] = useState<string>(CATEGORIES[0].value)

  const [body, setBody] = useState('')

  const { submit, busy, error: submitError, resetError } = useSubmitReport()

  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    if (!signedIn) return

    setMessage(null)

    resetError()

    const mapped = mapLegacyReportCategoryToPolicyReason(category)

    if (!mapped) {

      setMessage({ tone: 'err', text: 'Invalid category' })

      return

    }

    if (mapped.reason === POLICY_REASONS.other && !body.trim()) {

      setMessage({ tone: 'err', text: 'Please describe the issue when selecting Other.' })

      return

    }

    try {

      await submit({

        targetType: REPORT_TARGET_TYPES.platform,

        targetId: 'support',

        policyReason: mapped.reason,

        body: body.trim() || undefined,

      })

      setBody('')

      setMessage({

        tone: 'ok',

        text: 'Report submitted. You can track status under Settings → Support & reports.',

      })

    } catch {

      setMessage({ tone: 'err', text: submitError ?? 'Could not submit report' })

    }

  }



  if (!signedIn) {

    return (

      <div className={`rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 ${className}`}>

        <h2 className="text-lg font-semibold text-dc-text mb-2">Report a safety or platform issue</h2>

        <p className="text-sm text-dc-text-muted mb-4">

          Sign in to submit a report. Our team reviews reports manually. AI may summarize context, but humans decide outcomes.

        </p>

        <Link

          to={buildLoginHref('/support')}

          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"

        >

          Sign in to report

        </Link>

      </div>

    )

  }



  return (

    <form

      onSubmit={handleSubmit}

      className={`rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 space-y-4 ${className}`}

    >

      <h2 className="text-lg font-semibold text-dc-text">Report a safety or platform issue</h2>

      <p className="text-sm text-dc-text-muted">

        Describe what happened. For urgent in-person danger, contact local emergency services first.

      </p>

      <div>

        <label htmlFor="platform-report-category" className="block text-sm font-medium text-dc-text mb-1">

          Category

        </label>

        <select

          id="platform-report-category"

          value={category}

          onChange={(e) => setCategory(e.target.value)}

          className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"

        >

          {CATEGORIES.map((c) => (

            <option key={c.value} value={c.value}>

              {c.label}

            </option>

          ))}

        </select>

      </div>

      <div>

        <label htmlFor="platform-report-body" className="block text-sm font-medium text-dc-text mb-1">

          Details

        </label>

        <textarea

          id="platform-report-body"

          rows={5}

          value={body}

          onChange={(e) => setBody(e.target.value)}

          placeholder="What happened, who was involved, links or usernames if helpful…"

          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder-dc-muted"

        />

      </div>

      {message ?

        <p

          className={`text-sm ${message.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}

          role={message.tone === 'err' ? 'alert' : 'status'}

        >

          {message.text}

        </p>

      : null}

      {submitError && !message ?

        <p className="text-sm text-red-300" role="alert">

          {submitError}

        </p>

      : null}

      <button

        type="submit"

        disabled={busy}

        className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"

      >

        {busy ? 'Submitting…' : 'Submit report'}

      </button>

    </form>

  )

}

