'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { DancecardPanelSkeleton, InlineSuccessBanner, useConfirmDialog } from '@/components/dancecard/organizer/ui'
import type { ConventionCommandPermissions } from '@c2k/shared'
import type { DancecardModules } from '@/lib/dancecard/eventEntitlements'
import { EmbedSkinPreview } from '@/components/dancecard/organizer/integrations/EmbedSkinPreview'
import { IsoBoardModerationPanel } from '@/components/dancecard/organizer/IsoBoardModerationPanel'
import { KitchenMealPanel } from '@/components/dancecard/organizer/KitchenMealPanel'
import { ExhibitorsOrganizerPanel } from '@/components/dancecard/organizer/ExhibitorsOrganizerPanel'
import { AttendeeGroupsModerationPanel } from '@/components/dancecard/organizer/AttendeeGroupsModerationPanel'
import { SessionFeedbackConfigPanel } from '@/components/dancecard/organizer/SessionFeedbackConfigPanel'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import ConventionEckePanel from '@/components/organizer/ConventionEckePanel'

const MODULE_KEYS: { key: keyof DancecardModules; label: string }[] = [
  { key: 'schedule_embed', label: 'Schedule embed' },
  { key: 'map_embed', label: 'Map embed' },
  { key: 'shift_swaps', label: 'Shift swaps' },
  { key: 'vetting_applications', label: 'Vetting applications' },
  { key: 'policy_public_summary', label: 'Public policy summary' },
  { key: 'iso_board', label: 'ISO / practice partner board' },
  { key: 'session_feedback', label: 'Post-event session feedback' },
  { key: 'attendee_groups', label: 'Attendee groups' },
  { key: 'meal_signups', label: 'Meal signups (kitchen)' },
  { key: 'exhibitor_directory', label: 'Exhibitor directory' },
  { key: 'attendee_directory', label: 'Attendee directory' },
]

type ApiKeyRow = {
  id: string
  name: string
  scopes: string[]
  created_at: string
  revoked_at: string | null
  last_used_at: string | null
}
type WebhookRow = { id: string; url: string; event_types: string[]; created_at: string; revoked_at: string | null }
type EmbedTokenRow = {
  id: string
  embedKind: string
  label: string | null
  allowedOrigins: string[] | null
  createdAt: string
}

export function IntegrationsPanel({
  eventSlug,
  permissions,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
}) {
  const importHref = useOrganizerTabHref('import')
  const ownerOrAdmin = permissions.isFullAdmin
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [hooks, setHooks] = useState<WebhookRow[]>([])
  const [inbound, setInbound] = useState<{
    configured: boolean
    secrets: { id: string; label: string; created_at: string }[]
  } | null>(null)
  const [keyName, setKeyName] = useState('Automation')
  const [keyScopes, setKeyScopes] = useState<string[]>(['read:program'])
  const [hookUrl, setHookUrl] = useState('')
  const [hookTypes, setHookTypes] = useState('registrants.imported')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastMintedKey, setLastMintedKey] = useState<string | null>(null)
  const [lastMintedInbound, setLastMintedInbound] = useState<string | null>(null)
  const [lastHookSecret, setLastHookSecret] = useState<string | null>(null)
  const [embedTokens, setEmbedTokens] = useState<EmbedTokenRow[]>([])
  const [embedNeedsMigration, setEmbedNeedsMigration] = useState(false)
  const [lastEmbedToken, setLastEmbedToken] = useState<string | null>(null)
  const [embedLabel, setEmbedLabel] = useState('Site embed')
  const [embedOriginsText, setEmbedOriginsText] = useState('')
  const [modules, setModules] = useState<DancecardModules | null>(null)
  const [entitlementsBusy, setEntitlementsBusy] = useState(false)
  const [usage, setUsage] = useState<{
    windowDays: number
    activeApiKeys: number
    apiKeysUsedInWindow: number
    webhookDeliveries30d: number
  } | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const { dialog } = useConfirmDialog()

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inboundUrl = `${origin}/api/webhooks/dancecard/${encodeURIComponent(eventSlug)}/registrants`

  const loadEntitlements = useCallback(async () => {
    if (!ownerOrAdmin) return
    // Load entitlements and usage independently so a slow / missing usage endpoint
    // does not prevent the module-flag editor from rendering (and vice versa).
    const [entResult, meterResult] = await Promise.allSettled([
      organizerDancecardFetch<{ modules: DancecardModules }>(eventSlug, '/event-entitlements'),
      organizerDancecardFetch<{
        windowDays: number
        activeApiKeys: number
        apiKeysUsedInWindow: number
        webhookDeliveries30d: number
      }>(eventSlug, '/usage-meter'),
    ])
    if (entResult.status === 'fulfilled') {
      setModules(entResult.value.modules)
    } else {
      setErr(entResult.reason instanceof Error ? entResult.reason.message : 'Could not load module settings')
    }
    if (meterResult.status === 'fulfilled') {
      setUsage(meterResult.value)
    } else {
      // Usage is non-critical; show zeros rather than blocking the integrations UI.
      setUsage({ windowDays: 30, activeApiKeys: 0, apiKeysUsedInWindow: 0, webhookDeliveries30d: 0 })
    }
  }, [eventSlug, ownerOrAdmin])

  const load = useCallback(async () => {
    if (!ownerOrAdmin) return
    setErr(null)
    try {
      const [k, w, i, et] = await Promise.all([
        organizerDancecardFetch<{ keys: ApiKeyRow[] }>(eventSlug, '/api-keys'),
        organizerDancecardFetch<{ webhooks: WebhookRow[] }>(eventSlug, '/webhooks'),
        organizerDancecardFetch<{ configured: boolean; secrets: { id: string; label: string; created_at: string }[] }>(
          eventSlug,
          '/registrant-inbound-secret',
        ),
        organizerDancecardFetch<{ tokens: EmbedTokenRow[]; needsMigration?: boolean }>(eventSlug, '/embed-tokens'),
      ])
      setKeys((k.keys ?? []).filter((x) => !x.revoked_at))
      setHooks((w.webhooks ?? []).filter((x) => !x.revoked_at))
      setInbound(i)
      setEmbedTokens(et.tokens ?? [])
      setEmbedNeedsMigration(Boolean(et.needsMigration))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load integrations')
    }
  }, [eventSlug, ownerOrAdmin])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.all([load(), loadEntitlements()])
      if (!cancelled) setInitialLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load, loadEntitlements])

  async function toggleModule(key: keyof DancecardModules, enabled: boolean) {
    if (!modules) return
    setEntitlementsBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ modules: DancecardModules }>(eventSlug, '/event-entitlements', {
        method: 'PATCH',
        body: JSON.stringify({ modules: { [key]: enabled } }),
      })
      setModules(res.modules)
      if (key === 'session_feedback' && enabled) {
        try {
          await organizerDancecardFetch(eventSlug, '/session-feedback', {
            method: 'PATCH',
            body: JSON.stringify({
              feedbackConfig: { enabled: true, windowHoursAfterEnd: 24, showAggregatesToOrganizers: true },
            }),
          })
        } catch {
          /* config patch is best-effort when column exists */
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update module')
    } finally {
      setEntitlementsBusy(false)
    }
  }

  async function mintKey() {
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ key: ApiKeyRow; secret: string }>(eventSlug, '/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName.trim() || 'Key', scopes: keyScopes }),
      })
      setLastMintedKey(res.secret)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Mint failed')
    } finally {
      setBusy(false)
    }
  }

  async function mintInbound() {
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ secret: string }>(eventSlug, '/registrant-inbound-secret', {
        method: 'POST',
      })
      setLastMintedInbound(res.secret)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Mint failed')
    } finally {
      setBusy(false)
    }
  }

  async function createHook() {
    setBusy(true)
    setErr(null)
    try {
      const types = hookTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await organizerDancecardFetch<{ subscription: WebhookRow; signingSecret: string }>(
        eventSlug,
        '/webhooks',
        {
          method: 'POST',
          body: JSON.stringify({ url: hookUrl.trim(), eventTypes: types.length ? types : ['registrants.imported'] }),
        },
      )
      setLastHookSecret(res.signingSecret)
      setHookUrl('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Webhook create failed')
    } finally {
      setBusy(false)
    }
  }

  async function mintEmbed(kind: 'schedule' | 'map' | 'ops_summary') {
    setBusy(true)
    setErr(null)
    setLastEmbedToken(null)
    try {
      const origins = embedOriginsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await organizerDancecardFetch<{ token: string }>(eventSlug, '/embed-tokens', {
        method: 'POST',
        body: JSON.stringify({
          embedKind: kind,
          label: embedLabel.trim() || `${kind} embed`,
          allowedOrigins: origins.length ? origins : undefined,
        }),
      })
      setLastEmbedToken(res.token)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Embed mint failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ownerOrAdmin) {
    return <p className="text-sm text-dc-muted">Integrations are limited to event owners and site admins.</p>
  }

  if (initialLoading) {
    return (
      <div className="space-y-6 text-sm text-dc-text" aria-busy="true">
        <p className="text-dc-muted">Loading integrations and module settings…</p>
        <DancecardPanelSkeleton lines={4} />
        <DancecardPanelSkeleton lines={3} />
      </div>
    )
  }

  return (
    <div className="space-y-8 text-sm text-dc-text dc-tab-content-enter">
      {dialog}
      {successBanner ? (
        <InlineSuccessBanner message={successBanner} onDismiss={() => setSuccessBanner(null)} />
      ) : null}
      <p className="text-dc-muted">
        Connect your event to other tools. Each section below explains what it does before you create keys or tokens.
      </p>

      {ownerOrAdmin ?
        <ConventionEckePanel conventionSlug={eventSlug} />
      : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          <h3 className="text-sm font-semibold text-dc-text">Embeds</h3>
          <p className="mt-2 text-xs leading-relaxed text-dc-muted">
            Put a live schedule or map on your festival website with a simple iframe snippet. You control which parent
            sites may use the token.
          </p>
        </div>
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          <h3 className="text-sm font-semibold text-dc-text">API keys</h3>
          <p className="mt-2 text-xs leading-relaxed text-dc-muted">
            Let trusted scripts read the program or import registrants without using the organizer UI. Keys are scoped so
            automation only gets the access you choose.
          </p>
        </div>
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          <h3 className="text-sm font-semibold text-dc-text">Google Sheets</h3>
          <p className="mt-2 text-xs leading-relaxed text-dc-muted">
            Pull schedule drafts from a spreadsheet you already maintain. Setup lives on the Import tab; this page covers
            API keys and webhooks.
          </p>
        </div>
      </div>

      {err ? <p className="text-dc-danger whitespace-pre-wrap">{err}</p> : null}

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Optional features for this event</h2>
        <p className="mt-1 text-xs text-dc-muted">Turn on extra attendee-facing tools (embeds, applications, swaps, etc.).</p>
        {modules ? (
          <ul className="mt-4 space-y-2">
            {MODULE_KEYS.map(({ key, label }) => (
              <li key={key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-dc-text">{label}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(modules[key])}
                    disabled={entitlementsBusy}
                    onChange={(e) => void toggleModule(key, e.target.checked)}
                  />
                  <span className="text-dc-muted">{modules[key] ? 'On' : 'Off'}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-dc-muted">Loading module flags…</p>
        )}
      </section>

      {modules?.meal_signups ? <KitchenMealPanel eventSlug={eventSlug} readOnly={!ownerOrAdmin} /> : null}
      {modules?.exhibitor_directory ? (
        <ExhibitorsOrganizerPanel eventSlug={eventSlug} readOnly={!ownerOrAdmin} />
      ) : null}
      {modules?.iso_board ? <IsoBoardModerationPanel eventSlug={eventSlug} readOnly={false} /> : null}
      {modules?.attendee_groups ? (
        <AttendeeGroupsModerationPanel eventSlug={eventSlug} readOnly={!ownerOrAdmin} />
      ) : null}
      {modules?.session_feedback ? <SessionFeedbackConfigPanel eventSlug={eventSlug} readOnly={false} /> : null}

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Usage (30 days)</h2>
        {usage ? (
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2">
              <dt className="text-dc-muted">Active API keys</dt>
              <dd className="mt-1 text-lg font-semibold text-dc-text">{usage.activeApiKeys}</dd>
            </div>
            <div className="rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2">
              <dt className="text-dc-muted">Keys used</dt>
              <dd className="mt-1 text-lg font-semibold text-dc-text">{usage.apiKeysUsedInWindow}</dd>
            </div>
            <div className="rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2">
              <dt className="text-dc-muted">Webhook deliveries</dt>
              <dd className="mt-1 text-lg font-semibold text-dc-text">{usage.webhookDeliveries30d}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-xs text-dc-muted">Loading usage…</p>
        )}
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Automation keys</h2>
        <p className="mt-1 text-xs leading-relaxed text-dc-muted">
          For spreadsheets or custom tools that read your schedule or upload registrants without using this website.
          Create a key, copy it once, and choose what it may access below.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[10rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
            placeholder="Key label"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={keyScopes.includes('read:program')}
              onChange={(e) =>
                setKeyScopes((s) =>
                  e.target.checked
                    ? s.includes('read:program')
                      ? s
                      : [...s, 'read:program']
                    : s.filter((x) => x !== 'read:program'),
                )
              }
            />
            Read published schedule
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={keyScopes.includes('write:registrants')}
              onChange={(e) =>
                setKeyScopes((s) =>
                  e.target.checked
                    ? s.includes('write:registrants')
                      ? s
                      : [...s, 'write:registrants']
                    : s.filter((x) => x !== 'write:registrants'),
                )
              }
            />
            Upload / update registrants
          </label>
          <button
            type="button"
            disabled={busy || !keyScopes.length}
            className="rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
            onClick={() => void mintKey()}
          >
            Create automation key
          </button>
        </div>
        {lastMintedKey ? (
          <p className="mt-3 rounded-lg border border-dc-warning/30 bg-dc-warning-muted p-2 text-xs text-dc-warning">
            Copy now (shown once): <code className="break-all">{lastMintedKey}</code>
          </p>
        ) : null}
        <ul className="mt-4 space-y-1 text-xs text-dc-muted">
          {keys.map((k) => (
            <li key={k.id}>
              {k.name} · {k.scopes.join(', ')} · {k.last_used_at ? `last used ${k.last_used_at}` : 'never used'}
            </li>
          ))}
          {!keys.length ? <li>No active keys.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Notify another website when something changes</h2>
        <p className="mt-1 text-xs leading-relaxed text-dc-muted">
          We can POST to your URL when registrants are imported (more event types later). You verify each message with the
          signing secret we show once when you add a webhook.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
            placeholder="https://example.com/hooks/dancecard"
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
          />
          <input
            className="sm:w-56 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
            placeholder="event types, comma-separated"
            value={hookTypes}
            onChange={(e) => setHookTypes(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !hookUrl.trim()}
            className="rounded-full border border-dc-border px-4 py-2 text-xs text-dc-text hover:bg-white/5"
            onClick={() => void createHook()}
          >
            Add webhook
          </button>
        </div>
        {lastHookSecret ? (
          <p className="mt-3 rounded-lg border border-dc-warning/30 bg-dc-warning-muted p-2 text-xs text-dc-warning">
            Signing secret (once): <code className="break-all">{lastHookSecret}</code>
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {hooks.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-dc-muted">
              <span className="break-all">{h.url}</span>
              <span>{h.event_types.join(', ')}</span>
              <span className="text-dc-muted" title="Revoke is not available yet. Create a new webhook and retire the old URL at your endpoint.">
                Active
              </span>
            </li>
          ))}
          {!hooks.length ? <li className="text-dc-muted">No webhooks.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Embed schedule or map on your website</h2>
        <p className="mt-1 text-xs leading-relaxed text-dc-muted">
          Create an embed code you paste into your festival site (iframe). Optional allowed domains (one per line) stop
          other sites from reusing your link.
        </p>
        {embedNeedsMigration ? (
          <p className="mt-2 text-xs text-dc-warning">
            {supportCopy.embedTokensNotReady}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            className="min-w-[10rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
            placeholder="Label (e.g. Marketing site)"
            value={embedLabel}
            onChange={(e) => setEmbedLabel(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || embedNeedsMigration}
            className="rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
            onClick={() => void mintEmbed('schedule')}
          >
            Mint schedule embed
          </button>
          <button
            type="button"
            disabled={busy || embedNeedsMigration}
            className="rounded-full border border-dc-border px-4 py-2 text-xs text-dc-text hover:bg-white/5 disabled:opacity-40"
            onClick={() => void mintEmbed('map')}
          >
            Mint map embed
          </button>
          <button
            type="button"
            disabled={busy || embedNeedsMigration}
            className="rounded-full border border-dc-border px-4 py-2 text-xs text-dc-text hover:bg-white/5 disabled:opacity-40"
            onClick={() => void mintEmbed('ops_summary')}
          >
            Mint ops summary embed
          </button>
        </div>
        <label className="mt-3 block text-xs text-dc-muted">
          Allowed parent origins (optional, one per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-xs text-dc-text"
            rows={2}
            value={embedOriginsText}
            onChange={(e) => setEmbedOriginsText(e.target.value)}
            placeholder="https://example.com"
          />
        </label>
        {lastEmbedToken ? (
          <p className="mt-3 rounded-lg border border-dc-warning/30 bg-dc-warning-muted p-2 text-xs text-dc-warning">
            Embed token (once): <code className="break-all">{lastEmbedToken}</code>
            <span className="mt-1 block text-dc-muted">
              Example:{' '}
              <code className="break-all text-dc-text">
                {`${origin}/embed/dancecard/${encodeURIComponent(eventSlug)}/schedule?token=${lastEmbedToken}`}
              </code>
            </span>
          </p>
        ) : null}
        <EmbedSkinPreview eventSlug={eventSlug} token={lastEmbedToken} kind="schedule" />
        <ul className="mt-4 space-y-2 text-xs text-dc-muted">
          {embedTokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-mono text-dc-text">{t.embedKind}</span>
                {t.label ? <span> · {t.label}</span> : null}
                {t.allowedOrigins?.length ? (
                  <span className="block text-dc-muted">origins: {t.allowedOrigins.join(', ')}</span>
                ) : null}
              </span>
              <span className="text-dc-muted" title="Revoke is not available yet. Mint a new token and update your site embed.">
                Active
              </span>
            </li>
          ))}
          {!embedTokens.length && !embedNeedsMigration ? <li className="text-dc-muted">No active embed tokens.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">RabbitSign (inbound)</h2>
        <p className="mt-1 text-xs text-dc-muted">
          POST signed-status updates to the URL below. Use the same webhook secret as your event agreements settings (
          see <span className="text-dc-text">docs/ORGANIZER_CONSOLE.md</span> for server env fallback).
        </p>
        <p className="mt-3 break-all text-xs text-dc-accent/80">{`${origin}/api/webhooks/rabbitsign`}</p>
        <pre className="mt-2 max-w-full overflow-x-auto rounded-lg border border-dc-border bg-dc-surface-muted p-3 text-[11px] text-dc-muted">
          {`{ "eventSlug": "${eventSlug}", "registrantId": "<uuid>", "status": "signed", "secret": "<secret>" }`}
        </pre>
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Inbound registrant webhook</h2>
        <p className="mt-1 break-all text-xs text-dc-accent/80">{inboundUrl}</p>
        <p className="mt-2 text-xs text-dc-muted">
          Send <code>Authorization: Bearer &lt;minted secret&gt;</code> with registrant import rows. Payload examples are
          in <span className="text-dc-text">docs/ORGANIZER_CONSOLE.md</span>.
        </p>
        <p className="mt-2 text-xs">Status: {inbound?.configured ? 'secret configured' : 'not configured yet'}</p>
        <button
          type="button"
          disabled={busy}
          className="mt-3 rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
          onClick={() => void mintInbound()}
        >
          Mint / rotate inbound secret
        </button>
        {lastMintedInbound ? (
          <p className="mt-3 rounded-lg border border-dc-warning/30 bg-dc-warning-muted p-2 text-xs text-dc-warning">
            Bearer token (once): <code className="break-all">{lastMintedInbound}</code>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
        <h2 className="text-lg font-semibold text-dc-text">Google Sheets (schedule)</h2>
        <p className="mt-2 text-xs leading-relaxed text-dc-muted">
          Connect Google, link your workbook, and load program or staff drafts on the{' '}
          <a
            href={importHref}
            className="font-semibold text-dc-accent underline underline-offset-2 hover:text-dc-accent-hover"
          >
            Import
          </a>{' '}
          tab. Same preview board and publish flow as file upload.
        </p>
        <a
          className="mt-4 inline-block rounded-full border border-dc-border px-4 py-2 text-xs text-dc-accent hover:bg-dc-accent-muted"
          href={importHref}
        >
          Open Import → Google Sheets
        </a>
      </section>
    </div>
  )
}
