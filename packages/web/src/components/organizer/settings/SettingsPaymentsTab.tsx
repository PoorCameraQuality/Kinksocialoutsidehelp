import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import {
  useApiOrgStripe,
  type PaymentProcessor,
} from '@/hooks/useApiOrgStripe'
import { PAYMENTS_POLICY_HREF, PAYMENTS_SELLER_NOTE } from '@/lib/payments-disclaimer'

type Props = {
  orgSlug: string
}

type PickerMember = {
  userId: string
  role: string
  username: string | null
  displayName: string | null
  canManagePayments?: boolean
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

const PROCESSOR_OPTIONS: { id: PaymentProcessor; label: string; blurb: string }[] = [
  {
    id: 'stripe',
    label: 'Stripe Connect',
    blurb: 'Card checkout in Kink Social. Money settles to your Stripe account.',
  },
  {
    id: 'external',
    label: 'External processor',
    blurb: 'Eventbrite, PayPal, Square, your own store — we link out; you mark paid.',
  },
  {
    id: 'manual',
    label: 'Cash / manual only',
    blurb: 'No online checkout. Registration desk or organizers confirm paid access.',
  },
]

export default function SettingsPaymentsTab({ orgSlug }: Props) {
  const {
    status,
    processor,
    externalPaymentUrl,
    platformStripeConfigured,
    plans,
    managers,
    isOwner,
    canManage,
    loading,
    error,
    refresh,
    updatePayments,
    setManager,
    startConnect,
    openDashboard,
    createMembershipPlan,
  } = useApiOrgStripe(orgSlug)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [planName, setPlanName] = useState('Member dues')
  const [planDollars, setPlanDollars] = useState('10')
  const [planInterval, setPlanInterval] = useState<'month' | 'year'>('month')
  const [externalUrlDraft, setExternalUrlDraft] = useState('')
  const [members, setMembers] = useState<PickerMember[]>([])
  const [grantUserId, setGrantUserId] = useState('')

  useEffect(() => {
    setExternalUrlDraft(externalPaymentUrl ?? '')
  }, [externalPaymentUrl])

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/members`, {
          credentials: 'include',
        })
        if (!res.ok || cancelled) return
        const j = (await res.json()) as { items: PickerMember[] }
        if (!cancelled) setMembers(Array.isArray(j.items) ? j.items : [])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner, orgSlug])

  const onProcessor = async (next: PaymentProcessor) => {
    setBusy(true)
    setActionError(null)
    try {
      await updatePayments({ processor: next })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update processor')
    } finally {
      setBusy(false)
    }
  }

  const onSaveExternalUrl = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await updatePayments({
        externalPaymentUrl: externalUrlDraft.trim() || null,
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save URL')
    } finally {
      setBusy(false)
    }
  }

  const onConnect = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await startConnect()
      if (result.accountLinkUrl) {
        window.location.href = result.accountLinkUrl
        return
      }
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Connect failed')
    } finally {
      setBusy(false)
    }
  }

  const onDashboard = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const url = await openDashboard()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open dashboard')
    } finally {
      setBusy(false)
    }
  }

  const onCreatePlan = async () => {
    const dollars = Number(planDollars)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setActionError('Enter a valid dollar amount')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      await createMembershipPlan({
        name: planName.trim() || 'Member dues',
        amountCents: Math.round(dollars * 100),
        interval: planInterval,
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not create plan')
    } finally {
      setBusy(false)
    }
  }

  const onGrant = async () => {
    if (!grantUserId) return
    setBusy(true)
    setActionError(null)
    try {
      await setManager(grantUserId, true)
      setGrantUserId('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not grant access')
    } finally {
      setBusy(false)
    }
  }

  const grantCandidates = members.filter(
    (m) => m.role !== 'OWNER' && !managers.some((g) => g.userId === m.userId),
  )

  if (!loading && error && !canManage && !status) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dc-text">Ticketing & payments</h3>
        <p className="rounded-xl border border-dc-border bg-dc-elevated/40 px-4 py-3 text-sm text-dc-text-muted">
          Only the organization owner (or someone they grant payment management to) can change payment
          processing. Ask the owner if you need access.
        </p>
        {error ? <p className="text-sm text-dc-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-dc-text">Ticketing & payments</h3>
        <p className="mt-1 text-sm text-dc-text-muted">
          Choose how your organization collects money. Stripe Connect uses <em>your</em> Stripe account
          (Kink Social holds only platform keys). Or use an external processor / cash and mark paid
          manually.
        </p>
        <p className="mt-2 text-xs text-dc-muted">{PAYMENTS_SELLER_NOTE}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=payments-setup`}
            className="font-medium text-dc-accent hover:underline"
          >
            Payments setup →
          </Link>
          <Link to={PAYMENTS_POLICY_HREF} className="font-medium text-dc-accent hover:underline">
            Payments policy →
          </Link>
        </div>
      </div>

      {loading && !status ? (
        <p className="text-sm text-dc-text-muted">Loading payment settings…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-dc-danger/40 bg-dc-danger/10 px-4 py-3 text-sm text-dc-text">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-xl border border-dc-danger/40 bg-dc-danger/10 px-4 py-3 text-sm text-dc-text">
          {actionError}
        </p>
      ) : null}

      <div className="rounded-xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-dc-text">Payment processor</h4>
        <div className="grid gap-2">
          {PROCESSOR_OPTIONS.map((opt) => {
            const selected = processor === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                disabled={busy || !canManage}
                onClick={() => void onProcessor(opt.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-dc-accent bg-dc-accent/10'
                    : 'border-dc-border bg-dc-surface/40 hover:border-dc-border/80'
                } disabled:opacity-50`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-dc-text">{opt.label}</span>
                  {selected ? <Badge variant="accent">Active</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-dc-text-muted">{opt.blurb}</p>
              </button>
            )
          })}
        </div>
      </div>

      {processor === 'external' ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated/40 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-dc-text">External checkout URL</h4>
          <p className="text-sm text-dc-text-muted">
            Shown after registration when a category has a fee. You still confirm paid access in
            Event Systems (or rely on your own reconciliation).
          </p>
          <label className="block text-xs text-dc-text-muted">
            URL
            <input
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
              value={externalUrlDraft}
              onChange={(e) => setExternalUrlDraft(e.target.value)}
              placeholder="https://…"
              disabled={busy || !canManage}
            />
          </label>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => void onSaveExternalUrl()}
            className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-on-accent disabled:opacity-50"
          >
            Save URL
          </button>
        </div>
      ) : null}

      {processor === 'manual' ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated/40 p-4">
          <p className="text-sm text-dc-text-muted">
            Attendees will not see an online pay button. Use Registration / door tools to mark{' '}
            <span className="text-dc-text">paid confirmed</span> for cash, Venmo, or comps.
          </p>
        </div>
      ) : null}

      {processor === 'stripe' ? (
        <>
          {!platformStripeConfigured ? (
            <p className="rounded-xl border border-dc-border bg-dc-elevated/40 px-4 py-3 text-sm text-dc-text-muted">
              Stripe Connect is not configured on this server yet (platform keys). You can still choose
              External or Manual above.
            </p>
          ) : null}

          {status ? (
            <div className="rounded-xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-dc-text">Stripe connection</span>
                {status.readyForCheckout ? (
                  <Badge variant="success">Ready for checkout</Badge>
                ) : status.configured ? (
                  <Badge variant="neutral">Onboarding incomplete</Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>
              <ul className="text-sm text-dc-text-muted space-y-1">
                <li>Charges enabled: {status.chargesEnabled ? 'yes' : 'no'}</li>
                <li>Payouts enabled: {status.payoutsEnabled ? 'yes' : 'no'}</li>
                <li>Details submitted: {status.detailsSubmitted ? 'yes' : 'no'}</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || !canManage || !platformStripeConfigured}
                  onClick={() => void onConnect()}
                  className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-on-accent disabled:opacity-50"
                >
                  {status.configured ? 'Continue Stripe onboarding' : 'Connect with Stripe'}
                </button>
                {status.configured ? (
                  <button
                    type="button"
                    disabled={busy || !canManage}
                    onClick={() => void onDashboard()}
                    className="rounded-lg border border-dc-border px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
                  >
                    Open Stripe Dashboard
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refresh()}
                  className="rounded-lg border border-dc-border px-4 py-2 text-sm font-medium text-dc-text-muted disabled:opacity-50"
                >
                  Refresh status
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-dc-border bg-dc-elevated/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-dc-text">Membership / dues plans</h4>
            <p className="text-sm text-dc-text-muted">
              Create recurring plans on your connected Stripe account. Members check out on
              Stripe-hosted pages.
            </p>
            {!status?.readyForCheckout ? (
              <p className="text-sm text-dc-text-muted">Finish Connect onboarding before creating plans.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-dc-text-muted sm:col-span-1">
                  Name
                  <input
                    className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </label>
                <label className="text-xs text-dc-text-muted">
                  Amount (USD)
                  <input
                    className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
                    value={planDollars}
                    onChange={(e) => setPlanDollars(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-dc-text-muted">
                  Interval
                  <select
                    className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value as 'month' | 'year')}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </label>
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    disabled={busy || !canManage}
                    onClick={() => void onCreatePlan()}
                    className="rounded-lg border border-dc-border px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
                  >
                    Create plan
                  </button>
                </div>
              </div>
            )}
            {plans.length > 0 ? (
              <ul className="divide-y divide-dc-border rounded-lg border border-dc-border">
                {plans.map((p) => (
                  <li key={p.priceId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-dc-text">{p.name}</span>
                    <span className="text-dc-text-muted">
                      {money(p.amountCents, p.currency)} / {p.interval}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {isOwner ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated/40 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-dc-text">Who can manage payments</h4>
          <p className="text-sm text-dc-text-muted">
            Only you (owner) can change this. Grant carefully — managers can connect Stripe and change
            the processor.
          </p>
          {managers.length > 0 ? (
            <ul className="divide-y divide-dc-border rounded-lg border border-dc-border">
              {managers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-dc-text">
                    {m.displayName || m.username || m.userId}
                    <span className="ml-2 text-dc-text-muted">({m.role})</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm text-dc-danger hover:underline disabled:opacity-50"
                    onClick={() => {
                      setBusy(true)
                      setActionError(null)
                      void setManager(m.userId, false)
                        .catch((e: unknown) => {
                          setActionError(e instanceof Error ? e.message : 'Revoke failed')
                        })
                        .finally(() => setBusy(false))
                    }}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-dc-text-muted">No delegates yet.</p>
          )}
          {grantCandidates.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[12rem] flex-1 text-xs text-dc-text-muted">
                Grant to member
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {grantCandidates.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {(m.displayName || m.username || m.userId) + ` (${m.role})`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !grantUserId}
                onClick={() => void onGrant()}
                className="rounded-lg border border-dc-border px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
              >
                Grant access
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
