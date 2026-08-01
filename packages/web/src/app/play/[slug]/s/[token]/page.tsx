import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import GuestShareStickyBar from '@/components/play/guest-share/GuestShareStickyBar'
import GuestShareWeekend from '@/components/play/guest-share/GuestShareWeekend'
import { createBooking, fetchShared, type SharedPayload } from '@/hooks/usePlaySpaceDancecard'
import { buildLoginHref } from '@/lib/auth-links'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'
import {
  formatSlotDay,
  formatSlotShortContinue,
  formatSlotTimeRange,
  GUEST_SHARE_DURATIONS,
  GUEST_SHARE_SUGGESTED_COUNT,
  slotStillValid,
  slotsFromFreeGaps,
  timezoneLabel,
  type GuestTimeSlot,
} from '@/lib/guest-dancecard-share'

type Step = 'pick' | 'request' | 'done'

/** Guest share page — time-first request flow, no account required. */
export default function PlaySpaceSharePage() {
  const { slug = '', token = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<SharedPayload | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('pick')
  const [durationMin, setDurationMin] = useState(60)
  const [selected, setSelected] = useState<GuestTimeSlot | null>(null)
  const [weekendOpen, setWeekendOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const load = useCallback(async () => {
    if (!slug || !token) return
    setLoading(true)
    setLoadError(false)
    try {
      setData(await fetchShared(slug, token))
    } catch {
      setData(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [slug, token])

  useEffect(() => {
    void load()
  }, [load])

  const tz = data?.timezone ?? 'UTC'
  const gaps = data?.freeGaps ?? []
  const allSlots = useMemo(() => slotsFromFreeGaps(gaps, durationMin), [gaps, durationMin])
  const suggested = allSlots.slice(0, GUEST_SHARE_SUGGESTED_COUNT)

  const prefill = useMemo(() => {
    const startsAt = searchParams.get('startsAt')
    const endsAt = searchParams.get('endsAt')
    const location = searchParams.get('location')?.trim() || ''
    if (!startsAt || !endsAt) return null
    const s = Date.parse(startsAt)
    const e = Date.parse(endsAt)
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
    return {
      startsAt: new Date(s).toISOString(),
      endsAt: new Date(e).toISOString(),
      location,
      durationMin: Math.round((e - s) / 60_000),
    }
  }, [searchParams])

  useEffect(() => {
    if (!prefill || !data) return
    const mins = prefill.durationMin
    if (GUEST_SHARE_DURATIONS.includes(mins as (typeof GUEST_SHARE_DURATIONS)[number])) {
      setDurationMin(mins)
    }
  }, [prefill, data])

  useEffect(() => {
    if (!prefill || allSlots.length === 0) return
    const match = allSlots.find((s) => s.startsAt === prefill.startsAt && s.endsAt === prefill.endsAt)
    if (match) setSelected(match)
  }, [prefill, allSlots])

  useEffect(() => {
    if (!selected) return
    if (!slotStillValid(selected, gaps, durationMin)) {
      setSelected(null)
    }
  }, [durationMin, gaps, selected])

  const host = data?.sharer.displayName || data?.sharer.username || 'the host'
  const eventName = data?.playSpaceName ?? 'this event'

  async function onReserve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('guestDisplayName') || '').trim()
    const contact = String(fd.get('guestContact') || '').trim()
    const description = String(fd.get('description') || '').trim()
    const location = String(fd.get('location') || '').trim()
    if (!name) {
      setFormError('Please enter a name.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await createBooking(slug, {
        shareToken: token,
        startsAt: selected.startsAt,
        endsAt: selected.endsAt,
        ...(location ? { location } : {}),
        description: description || 'Guest time request',
        guestDisplayName: name,
        guestContact: contact || undefined,
      })
      setStep('done')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send request')
    } finally {
      setBusy(false)
    }
  }

  const shell = (children: ReactNode) => (
    <div
      className="dc-gold-chrome min-h-dvh text-dc-text"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      data-dc-theme="event"
      style={themeStyle as CSSProperties}
    >
      {children}
    </div>
  )

  if (loading) {
    return shell(
      <div className="mx-auto max-w-xl px-4 py-10 text-dc-muted sm:px-6">Loading Dancecard…</div>,
    )
  }

  if (loadError || !data) {
    return shell(
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <header className="text-[13px] text-dc-muted">kink.social · Dancecard</header>
        <h1 className="mt-6 text-[24px] font-semibold text-dc-text">This Dancecard link is not available</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-dc-text-muted">
          The host may have turned it off or replaced it. Ask them for a new link.
        </p>
        <Link
          to="/play"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
        >
          Go to Dancecard
        </Link>
      </div>,
    )
  }

  if (step === 'done' && selected) {
    return shell(
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <header className="text-[13px] text-dc-muted">kink.social · Dancecard</header>
        <div className="mt-10 text-center">
          <p className="text-3xl text-dc-accent" aria-hidden>
            ✓
          </p>
          <h1 className="mt-3 text-[26px] font-semibold text-dc-text">Request sent</h1>
          <p className="mt-3 text-[15px] text-dc-text-muted">
            {host} received your request for:
          </p>
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4 text-left">
            <p className="text-[17px] font-semibold text-dc-text">{formatSlotDay(selected.startsAt, tz)}</p>
            <p className="mt-1 text-[15px] text-dc-text-muted">
              {formatSlotTimeRange(selected.startsAt, selected.endsAt, tz)}
            </p>
            <p className="mt-2 text-[14px] text-dc-muted">{eventName}</p>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-dc-text-muted">
            This time is not confirmed yet. {host} will accept or decline the request in Dancecard.
          </p>
          <button
            type="button"
            onClick={() => {
              setStep('pick')
              setSelected(null)
            }}
            className="mt-8 min-h-12 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('pick')
              setSelected(null)
            }}
            className="mt-3 min-h-11 w-full text-sm font-medium text-dc-accent"
          >
            Request another time
          </button>
        </div>
        <p className="mt-10 text-center text-[12px] text-dc-muted">
          Dancecard is part of kink.social Play Spaces
        </p>
      </div>,
    )
  }

  if (step === 'request' && selected) {
    return shell(
      <div className="mx-auto max-w-xl px-4 pb-28 pt-3 sm:px-6">
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="min-h-11 text-sm font-medium text-dc-text-muted"
          >
            ‹ Change time
          </button>
          <p className="text-sm font-semibold text-dc-text">Ask for a time</p>
          <span className="w-16" />
        </header>

        <p className="mt-5 text-[12px] font-medium uppercase tracking-wide text-dc-muted">Your request</p>
        <div className="mt-2 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
          <p className="text-[17px] font-semibold text-dc-text">{formatSlotDay(selected.startsAt, tz)}</p>
          <p className="mt-1 text-[15px] text-dc-text-muted">
            {formatSlotTimeRange(selected.startsAt, selected.endsAt, tz)} · {durationMin} minutes
          </p>
          <p className="mt-1 text-[14px] text-dc-muted">{eventName}</p>
        </div>

        <form id="guest-request-form" onSubmit={onReserve} className="mt-6 space-y-4">
          <div>
            <label htmlFor="guestDisplayName" className="block text-[14px] font-medium text-dc-text">
              What should {host} call you?
            </label>
            <input
              id="guestDisplayName"
              name="guestDisplayName"
              required
              autoComplete="name"
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            />
          </div>
          <div>
            <label htmlFor="guestContact" className="block text-[14px] font-medium text-dc-text">
              How can {host} reach you?
            </label>
            <p id="contact-hint" className="mt-0.5 text-[13px] text-dc-muted">
              Optional, but recommended if you are not signed in.
            </p>
            <input
              id="guestContact"
              name="guestContact"
              aria-describedby="contact-hint contact-warn"
              placeholder="Phone, Discord, email…"
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text placeholder:text-dc-muted"
            />
            <p id="contact-warn" className="mt-1.5 text-[13px] text-dc-muted">
              Without contact information, {host} may not be able to tell you when the request is accepted.
            </p>
          </div>
          <div>
            <label htmlFor="location" className="block text-[14px] font-medium text-dc-text">
              Where would you like to meet?
            </label>
            <p className="mt-0.5 text-[13px] text-dc-muted">Optional</p>
            <input
              id="location"
              name="location"
              defaultValue={prefill?.location ?? ''}
              maxLength={512}
              placeholder="Dungeon, fire circle…"
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text placeholder:text-dc-muted"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-[14px] font-medium text-dc-text">
              Anything {host} should know?
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-[15px] text-dc-text"
            />
          </div>
          <p className="text-[13px] leading-relaxed text-dc-muted">
            This sends a request. The time is not confirmed until {host} accepts.
          </p>
          {formError ? (
            <p className="text-sm text-[var(--dc-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
        </form>

        <GuestShareStickyBar
          label={`Send request to ${host}`}
          busy={busy}
          onClick={() => {
            const form = document.getElementById('guest-request-form') as HTMLFormElement | null
            form?.requestSubmit()
          }}
        />
      </div>,
    )
  }

  // Pick step
  return shell(
    <div className="mx-auto max-w-xl px-4 pb-28 pt-3 sm:px-6">
      <header className="text-[13px] text-dc-muted">kink.social · Dancecard</header>

      <div className="mt-6 flex items-start gap-3">
        {data.sharer.avatarUrl ? (
          <img
            src={data.sharer.avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover border border-dc-border"
          />
        ) : (
          <PlaceholderAvatar size="md" className="rounded-full" />
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight text-dc-text sm:text-[26px]">
            {host} is free at {eventName}
          </h1>
        </div>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-dc-text-muted">
        Choose a time and send a request. No account needed. {host} will accept or decline it.
      </p>
      <p className="mt-2 text-[13px] text-dc-muted">Event time · {timezoneLabel(tz)}</p>

      <section className="mt-6">
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">How long?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GUEST_SHARE_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={durationMin === m}
              onClick={() => setDurationMin(m)}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-surface)] ${
                durationMin === m
                  ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] font-semibold text-dc-text'
                  : 'border-dc-border bg-dc-elevated-muted text-dc-text-muted'
              }`}
            >
              {durationMin === m ? '✓ ' : ''}
              {m} min
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">
          {suggested.length ? 'Next available' : 'Pick a time'}
        </p>
        <p className="mt-0.5 text-[13px] text-dc-muted">Times are shown in the event’s time zone.</p>

        {suggested.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-5">
            <p className="text-[17px] font-semibold text-dc-text">No open times right now</p>
            <p className="mt-1 text-[14px] text-dc-text-muted">
              {host} does not have any available times on this shared Dancecard. They may add more later.
            </p>
            <p className="mt-2 text-[13px] text-dc-muted">
              Ask the host whether they have another time or a newer link.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {suggested.map((slot) => {
              const isSelected =
                selected?.startsAt === slot.startsAt && selected?.endsAt === slot.endsAt
              return (
                <li key={slot.startsAt}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(slot)}
                    className={`flex min-h-14 w-full flex-col justify-center rounded-2xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-surface)] ${
                      isSelected
                        ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))]'
                        : 'border-dc-border bg-dc-elevated'
                    }`}
                  >
                    <span className={`text-[15px] ${isSelected ? 'font-semibold text-dc-text' : 'font-medium text-dc-text'}`}>
                      {isSelected ? '✓ ' : ''}
                      {formatSlotDay(slot.startsAt, tz)}
                    </span>
                    <span className="text-[15px] text-dc-text-muted">
                      {formatSlotTimeRange(slot.startsAt, slot.endsAt, tz)}
                    </span>
                    {isSelected ? (
                      <span className="mt-0.5 text-[12px] font-medium text-dc-accent">Selected</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {allSlots.length > 0 ? (
        <button
          type="button"
          onClick={() => setWeekendOpen(true)}
          className="mt-5 min-h-11 text-sm font-medium text-dc-accent"
        >
          See the whole weekend
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setWhyOpen((v) => !v)}
        className="mt-3 block min-h-11 text-left text-sm text-dc-muted underline-offset-2 hover:underline"
      >
        Why am I seeing these times?
      </button>
      {whyOpen ? (
        <p className="mt-1 text-[13px] leading-relaxed text-dc-muted">
          This link only shows times {host} marked as free for {eventName}. You cannot see their full calendar. Sending
          a request asks them to hold that slot — it is not confirmed until they accept.
        </p>
      ) : null}

      <p className="mt-10 text-center text-[12px] text-dc-muted">
        Already use kink.social?{' '}
        <Link to={buildLoginHref(`/play/${slug}`)} className="text-dc-accent hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-[12px] text-dc-muted">Dancecard is part of kink.social Play Spaces</p>

      <GuestShareStickyBar
        label={
          selected
            ? `Continue with ${formatSlotShortContinue(selected.startsAt, tz)}`
            : 'Select a time'
        }
        disabled={!selected}
        onClick={() => {
          if (selected) setStep('request')
        }}
      />

      <GuestShareWeekend
        open={weekendOpen}
        gaps={gaps}
        slots={allSlots}
        timezone={tz}
        selected={selected}
        onSelect={(slot) => {
          setSelected(slot)
          setWeekendOpen(false)
        }}
        onClose={() => setWeekendOpen(false)}
      />
    </div>,
  )
}
