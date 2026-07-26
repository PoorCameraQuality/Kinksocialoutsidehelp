'use client'

import { useCallback, useEffect, useState } from 'react'
import { CampaignBodyEditor } from '@/components/dancecard/organizer/CampaignBodyEditor'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { DancecardPanelSkeleton, useOrganizerToast } from '@/components/dancecard/organizer/ui'
import { supportCopy } from '@/lib/dancecard/supportCopy'

type AudienceMode = 'going' | 'interested' | 'going_and_interested'

type Campaign = {
  id: string
  templateId: string
  templateName: string
  status: string
  createdAt: string
  sentAt: string | null
  deliveryTotal: number
  deliverySent: number
  audienceFilter?: { audience?: string }
}

type TemplateRow = { id: string; name: string; subject: string; bodyText: string; bodyHtml?: string }

type AudienceCounts = {
  audience: AudienceMode
  emailReach: number
  inboxReach: number
  goingCount: number
  interestedCount: number
}

type PublishResult = {
  sent?: number
  failed?: number
  skipped?: number
  recipientCount?: number
  audience?: AudienceMode
  channel?: string
}

const AUDIENCE_OPTIONS: { id: AudienceMode; label: string; hint: string }[] = [
  { id: 'going', label: 'Going', hint: 'Registrants + RSVP going' },
  { id: 'interested', label: 'Interested', hint: 'RSVP interested / maybe' },
  { id: 'going_and_interested', label: 'Going + Interested', hint: 'Everyone who marked either' },
]

const STARTER_MESSAGES = [
  {
    id: 'welcome',
    label: 'Welcome',
    subject: 'Welcome — next steps for the event',
    bodyHtml:
      '<p>Hi there,</p><p>We are glad you are joining us. Here is what to know next.</p><p>See you soon!</p>',
  },
  {
    id: 'schedule',
    label: 'Schedule update',
    subject: 'Schedule update',
    bodyHtml:
      '<p>Hi there,</p><p>We updated the program. Open the event on kink.social for the latest class times and rooms.</p><p>Thanks for your flexibility.</p>',
  },
  {
    id: 'promo',
    label: 'Promo / reminder',
    subject: 'A note from the organizers',
    bodyHtml:
      '<p>Hi there,</p><p>A quick update from the organizers — details below.</p><p>Reply in this thread if you have questions.</p>',
  },
  {
    id: 'thanks',
    label: 'Thank you / post-event',
    subject: 'Thank you for joining us',
    bodyHtml:
      '<p>Hi there,</p><p>Thank you for being part of the event. We hope you had a great time.</p><p>Stay tuned for photos and next-year news.</p>',
  },
] as const

type ConfirmStep = 'compose' | 'confirm' | 'success'

function bodyLooksEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text.length === 0
}

export function MessagingPanel({ eventSlug, readOnly }: { eventSlug: string; readOnly: boolean }) {
  const slug = eventSlug.toLowerCase()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templatesById, setTemplatesById] = useState<Record<string, TemplateRow>>({})
  const [needsMigration, setNeedsMigration] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('<p></p>')
  const [starterId, setStarterId] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('going_and_interested')
  const [busy, setBusy] = useState(false)
  const [testUsername, setTestUsername] = useState('')
  const [step, setStep] = useState<ConfirmStep>('compose')
  const [audience, setAudience] = useState<AudienceCounts | null>(null)
  const [audienceErr, setAudienceErr] = useState<string | null>(null)
  const [lastPublish, setLastPublish] = useState<PublishResult | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const toast = useOrganizerToast()

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [t, c] = await Promise.all([
        organizerDancecardFetch<{ templates: TemplateRow[]; needsMigration?: boolean }>(slug, '/message-templates'),
        organizerDancecardFetch<{ campaigns: Campaign[]; needsMigration?: boolean }>(slug, '/message-campaigns'),
      ])
      const map: Record<string, TemplateRow> = {}
      for (const row of t.templates ?? []) map[row.id] = row
      setTemplatesById(map)
      setCampaigns(c.campaigns ?? [])
      setNeedsMigration(Boolean(t.needsMigration || c.needsMigration))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load campaigns')
    } finally {
      setInitialLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const loadAudience = useCallback(
    async (mode: AudienceMode) => {
      setAudience(null)
      setAudienceErr(null)
      try {
        const res = await organizerDancecardFetch<AudienceCounts>(
          slug,
          `/message-campaigns/audience?audience=${encodeURIComponent(mode)}`,
        )
        setAudience(res)
      } catch (e) {
        setAudienceErr(e instanceof Error ? e.message : 'Could not estimate recipients')
      }
    },
    [slug],
  )

  useEffect(() => {
    if (step !== 'compose') return
    void loadAudience(audienceMode)
  }, [audienceMode, loadAudience, step])

  function applyStarter(id: string) {
    setStarterId(id)
    if (!id) return
    const preset = STARTER_MESSAGES.find((p) => p.id === id)
    if (!preset) return
    setSubject(preset.subject)
    setBodyHtml(preset.bodyHtml)
  }

  function reuseFromCampaign(c: Campaign) {
    const tpl = templatesById[c.templateId]
    if (!tpl) return
    setSubject(tpl.subject)
    setBodyHtml(tpl.bodyHtml ?? tpl.bodyText)
    const mode = c.audienceFilter?.audience
    if (mode === 'going' || mode === 'interested' || mode === 'going_and_interested') {
      setAudienceMode(mode)
    }
    setStarterId('')
    setStep('compose')
    setErr(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function openConfirm() {
    if (readOnly || !subject.trim() || bodyLooksEmpty(bodyHtml)) return
    setErr(null)
    setStep('confirm')
    await loadAudience(audienceMode)
  }

  async function publishNow() {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      const label =
        subject.trim().slice(0, 72) ||
        `Campaign ${new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
      const tplRes = await organizerDancecardFetch<{ template: { id: string } }>(slug, '/message-templates', {
        method: 'POST',
        body: JSON.stringify({ name: label, subject: subject.trim(), bodyHtml: bodyHtml.trim() }),
      })
      const campRes = await organizerDancecardFetch<{ campaign: { id: string } }>(slug, '/message-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          templateId: tplRes.template.id,
          name: label,
          audienceFilter: { audience: audienceMode },
        }),
      })
      const res = await organizerDancecardFetch<PublishResult>(
        slug,
        `/message-campaigns/${campRes.campaign.id}/send`,
        { method: 'POST' },
      )
      setLastPublish(res)
      setStep('success')
      setSubject('')
      setBodyHtml('<p></p>')
      setStarterId('')
      await load()
      toast.push(`Inbox messages: ${res.sent ?? 0} sent, ${res.failed ?? 0} failed.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Send failed')
      setStep('confirm')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    if (readOnly || !testUsername.trim() || !subject.trim() || bodyLooksEmpty(bodyHtml)) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(slug, '/message-templates/test-send', {
        method: 'POST',
        body: JSON.stringify({
          toUsername: testUsername.trim().replace(/^@/, ''),
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
        }),
      })
      toast.push(`Test message sent to @${testUsername.trim().replace(/^@/, '')} — check Messaging`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Test send failed')
    } finally {
      setBusy(false)
    }
  }

  const sentCampaigns = campaigns.filter((c) => c.status === 'sent')
  const canPublish = Boolean(subject.trim() && !bodyLooksEmpty(bodyHtml))
  const audienceLabel = AUDIENCE_OPTIONS.find((o) => o.id === audienceMode)?.label ?? audienceMode

  if (initialLoading) {
    return (
      <div className="space-y-6 text-sm text-dc-text" aria-busy="true">
        <div>
          <h2 className="font-serif text-xl text-dc-text sm:text-2xl">Message campaign</h2>
          <p className="mt-2 text-sm text-dc-muted">Loading templates and recent campaigns…</p>
        </div>
        <DancecardPanelSkeleton lines={5} />
        <DancecardPanelSkeleton lines={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6 text-sm text-dc-text dc-tab-content-enter">
      <div>
        <h2 className="font-serif text-xl text-dc-text sm:text-2xl">Message campaign</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-muted">
          Message people who marked <strong className="font-medium text-dc-text">going</strong> or{' '}
          <strong className="font-medium text-dc-text">interested</strong> in their kink.social{' '}
          <strong className="font-medium text-dc-text">Messaging</strong> inbox. Rich text and images render in the
          thread.
        </p>
      </div>

      {needsMigration ? <p className="text-xs text-dc-warning">{supportCopy.messagingNotReady}</p> : null}
      {err ? (
        <p className="rounded-lg border border-dc-danger-border bg-dc-danger-muted px-3 py-2 text-sm text-dc-danger">{err}</p>
      ) : null}

      {step === 'compose' ? (
        <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4 sm:p-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Audience</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {AUDIENCE_OPTIONS.map((opt) => {
                const selected = audienceMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={readOnly || busy}
                    onClick={() => setAudienceMode(opt.id)}
                    className={`min-h-11 rounded-xl border px-4 py-2 text-left text-sm transition ${
                      selected
                        ? 'border-dc-accent bg-dc-accent-muted text-dc-text'
                        : 'border-dc-border bg-dc-elevated-solid text-dc-muted hover:bg-dc-surface-muted'
                    }`}
                  >
                    <span className="block font-semibold text-dc-text">{opt.label}</span>
                    <span className="block text-[11px]">{opt.hint}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-dc-muted">
              {audienceErr ? (
                <span className="text-dc-danger">{audienceErr}</span>
              ) : audience ? (
                <>
                  Messaging inbox reach:{' '}
                  <strong className="text-dc-text">{audience.inboxReach ?? audience.emailReach}</strong> members
                  <span className="text-dc-muted">
                    {' '}
                    (going {audience.goingCount} · interested {audience.interestedCount})
                  </span>
                </>
              ) : (
                'Counting recipients…'
              )}
            </p>
          </fieldset>

          <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Start from a starter (optional)
            <select
              className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base font-normal normal-case text-dc-text"
              value={starterId}
              disabled={readOnly || busy}
              onChange={(e) => applyStarter(e.target.value)}
            >
              <option value="">Blank message</option>
              {STARTER_MESSAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Subject (shown as heading in the message)
            <input
              className="min-h-11 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-base font-normal normal-case text-dc-text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={readOnly || busy}
              placeholder="e.g. Schedule update — Saturday rooms"
            />
          </label>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dc-muted">Message body</p>
            <CampaignBodyEditor
              valueHtml={bodyHtml}
              disabled={readOnly || busy}
              onChangeHtml={setBodyHtml}
              placeholder="Write what going / interested people should know…"
            />
          </div>

          <details
            className="mt-4 rounded-lg border border-dc-border bg-dc-surface-muted/80 px-3 py-2"
            open={showPreview}
            onToggle={(e) => setShowPreview((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-xs font-medium text-dc-accent">Messaging inbox preview</summary>
            <div className="mt-3 flex justify-start">
              <div className="max-w-[min(100%,28rem)] rounded-2xl rounded-bl-md border border-dc-border bg-dc-elevated-solid px-4 py-3 text-dc-text">
                <div
                  className="text-sm prose prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-img:my-2 prose-img:rounded-lg"
                  dangerouslySetInnerHTML={{
                    __html: bodyLooksEmpty(bodyHtml)
                      ? '<p>(empty)</p>'
                      : `${subject.trim() ? `<h2>${subject.trim()}</h2>` : ''}${bodyHtml}`,
                  }}
                />
                <p className="mt-2 text-xs text-dc-muted">Just now · kink.social Messaging</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-dc-muted">Audience: {audienceLabel}</p>
          </details>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={readOnly || busy || !canPublish}
              className="min-h-12 w-full rounded-xl bg-dc-accent px-5 py-3 text-base font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40 sm:w-auto"
              onClick={() => void openConfirm()}
            >
              Review &amp; send to Messaging
            </button>
            <p className="text-xs text-dc-muted sm:max-w-xs">
              Recipients get a DM in Messaging (not SMTP email).
            </p>
          </div>

          <details className="mt-4 rounded-lg border border-dc-border bg-dc-surface-muted/80 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-dc-accent">Send a test DM first</summary>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-dc-muted">
                Teammate username
                <input
                  className="min-h-10 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  disabled={readOnly || busy}
                  placeholder="username (not yourself)"
                />
              </label>
              <button
                type="button"
                disabled={readOnly || busy || !testUsername.trim() || !canPublish}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-4 py-2 text-sm font-medium hover:bg-dc-accent-muted disabled:opacity-40"
                onClick={() => void sendTest()}
              >
                Send test DM
              </button>
            </div>
            <p className="mt-2 text-[11px] text-dc-muted">
              Opens / updates a Messaging thread with that member so you can confirm layout and images.
            </p>
          </details>
        </section>
      ) : null}

      {step === 'confirm' || step === 'success' ? (
        <div
          className="fixed inset-0 z-dc-modal flex items-end justify-center bg-dc-surface/85 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="campaign-confirm-title"
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            {step === 'success' ? (
              <>
                <h3 id="campaign-confirm-title" className="font-serif text-xl text-dc-text">
                  Campaign sent
                </h3>
                <p className="mt-2 text-sm text-dc-muted">Messages landed in recipients&apos; Messaging inboxes.</p>
                <ul className="mt-4 space-y-2 rounded-xl border border-dc-border bg-dc-surface-muted p-4 text-sm">
                  <li>
                    <span className="text-dc-muted">Audience: </span>
                    <strong className="text-dc-text">{lastPublish?.audience ?? audienceLabel}</strong>
                  </li>
                  <li>
                    <span className="text-dc-muted">Delivered: </span>
                    <strong className="text-dc-text">
                      {lastPublish?.sent ?? 0} sent, {lastPublish?.failed ?? 0} failed
                      {lastPublish?.skipped ? `, ${lastPublish.skipped} skipped` : ''}
                    </strong>
                  </li>
                </ul>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl bg-dc-accent px-4 py-2.5 font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                    onClick={() => {
                      setStep('compose')
                      setLastPublish(null)
                    }}
                  >
                    New campaign
                  </button>
                  <a
                    href="/messaging"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 py-2.5 text-dc-muted hover:bg-dc-surface-muted"
                  >
                    Open Messaging
                  </a>
                </div>
              </>
            ) : (
              <>
                <h3 id="campaign-confirm-title" className="font-serif text-xl text-dc-text">
                  Send this campaign?
                </h3>
                <p className="mt-2 text-sm text-dc-muted">
                  Each recipient gets a DM in <strong className="text-dc-text">Messaging</strong> for audience{' '}
                  <strong className="text-dc-text">{audienceLabel}</strong>.
                </p>
                <dl className="mt-4 space-y-3 rounded-xl border border-dc-border bg-dc-surface-muted p-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Subject</dt>
                    <dd className="mt-1 font-medium text-dc-text">{subject.trim()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Preview</dt>
                    <dd
                      className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-dc-elevated-solid px-3 py-2 text-sm prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Recipients</dt>
                    <dd className="mt-1 text-dc-muted">
                      {audienceErr ? (
                        <span className="text-dc-danger">{audienceErr}</span>
                      ) : audience ? (
                        <>
                          <strong className="text-dc-text">{audience.inboxReach ?? audience.emailReach}</strong>{' '}
                          members with accounts
                          <span className="mt-1 block text-xs">
                            going {audience.goingCount} · interested {audience.interestedCount}
                          </span>
                        </>
                      ) : (
                        'Calculating…'
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-xl border border-dc-border px-4 py-2.5 text-sm text-dc-muted hover:bg-dc-surface-muted disabled:opacity-40"
                    onClick={() => setStep('compose')}
                  >
                    Back to edit
                  </button>
                  <button
                    type="button"
                    disabled={
                      readOnly ||
                      busy ||
                      Boolean(audienceErr) ||
                      (audience?.inboxReach ?? audience?.emailReach) === 0
                    }
                    className="min-h-11 rounded-xl bg-dc-accent px-5 py-2.5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
                    onClick={() => void publishNow()}
                  >
                    {busy ? 'Sending…' : 'Send to Messaging'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {sentCampaigns.length ? (
        <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          <h3 className="text-sm font-semibold text-dc-text">Recent campaigns</h3>
          <p className="mt-1 text-xs text-dc-muted">Previously sent to Messaging inboxes.</p>
          <ul className="mt-3 space-y-2">
            {sentCampaigns.slice(0, 8).map((c) => {
              const tpl = templatesById[c.templateId]
              const mode = c.audienceFilter?.audience
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-dc-text">{tpl?.subject ?? c.templateName}</p>
                    <p className="mt-0.5 text-xs text-dc-muted">
                      {c.sentAt ? new Date(c.sentAt).toLocaleString() : new Date(c.createdAt).toLocaleString()}
                      {c.deliveryTotal ? ` · ${c.deliverySent}/${c.deliveryTotal} delivered` : ''}
                      {mode ? ` · ${mode.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  {!readOnly && tpl ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-dc-accent hover:underline"
                      onClick={() => reuseFromCampaign(c)}
                    >
                      Reuse message
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
