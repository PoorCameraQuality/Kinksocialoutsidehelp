import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CONTACT_TOPICS, isContactTopic, type ContactTopic } from '@/lib/contact-topics'

type Props = {
  className?: string
  defaultTopic?: ContactTopic
}

export default function ContactForm({ className = '', defaultTopic }: Props) {
  const [searchParams] = useSearchParams()
  const { viewerEmail, viewerDisplayName } = useAuth()
  const initialTopic = useMemo(() => {
    const fromUrl = searchParams.get('topic') ?? searchParams.get('category')
    if (isContactTopic(fromUrl)) return fromUrl
    if (defaultTopic) return defaultTopic
    return CONTACT_TOPICS[0].value
  }, [defaultTopic, searchParams])

  const [category, setCategory] = useState<ContactTopic>(initialTopic)
  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState(viewerDisplayName ?? '')
  const [senderEmail, setSenderEmail] = useState(viewerEmail ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)
    setBusy(true)
    try {
      const r = await fetch('/api/v1/contact/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          message: message.trim(),
        }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string; inquiry?: { id: string } }
      if (!r.ok) {
        setFeedback({ tone: 'err', text: typeof data.error === 'string' ? data.error : 'Could not send your message. Try again.' })
        return
      }
      setFeedback({
        tone: 'ok',
        text: 'Message received. We review contact submissions during business hours and will reply by email when a response is needed.',
      })
      setSubject('')
      setMessage('')
    } catch {
      setFeedback({ tone: 'err', text: 'Network error. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="contact-topic" className="block text-sm font-medium text-dc-text mb-1">
          Topic
        </label>
        <select
          id="contact-topic"
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactTopic)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
        >
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {category === 'dmca' ?
          <p className="mt-2 text-xs text-dc-muted">
            For a formal DMCA takedown notice with statutory elements, use the dedicated form on our{' '}
            <a href="/dmca" className="text-dc-accent hover:underline">
              DMCA page
            </a>
            .
          </p>
        : null}
        {category === 'law_enforcement' ?
          <p className="mt-2 text-xs text-dc-muted">
            Required: agency name, badge or employee ID, valid legal process (subpoena, court order, warrant, or
            equivalent), and specific account identifiers (username, email, or user ID). See{' '}
            <a href="/law-enforcement" className="text-dc-accent hover:underline">
              Law Enforcement Guidelines
            </a>{' '}
            before submitting. Incomplete requests may not receive a response.
          </p>
        : null}
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-dc-text mb-1">
          Subject
        </label>
        <input
          id="contact-subject"
          required
          maxLength={255}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          placeholder="Brief summary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-dc-text mb-1">
            Your name
          </label>
          <input
            id="contact-name"
            required
            maxLength={255}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-dc-text mb-1">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={320}
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-dc-text mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          maxLength={8000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          placeholder={
            category === 'law_enforcement'
              ? 'Agency, badge/ID, case number, legal process type, username/email/user ID, data scope, and date range.'
              : 'Include relevant links, usernames, or dates if this is about a report or legal request.'
          }
        />
      </div>

      <p className="text-xs text-dc-muted">
        Do not send passwords or government ID numbers through this form. For urgent in-person safety at an event,
        contact local emergency services and on-site staff first.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send message'}
      </button>

      {feedback ?
        <p
          className={`text-sm ${feedback.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}
          role="status"
        >
          {feedback.text}
        </p>
      : null}
    </form>
  )
}
