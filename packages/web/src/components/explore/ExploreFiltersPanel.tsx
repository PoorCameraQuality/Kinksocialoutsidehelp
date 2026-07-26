import { useId, type ReactNode } from 'react'
import {
  EXPLORE_CONTENT_TYPES,
  EXPLORE_TOPIC_CHIPS,
  type ExploreContentType,
  type ExploreDateFilter,
  type ExploreFilters,
} from '@/lib/explore-hub'

type Props = {
  draft: ExploreFilters
  onChange: (next: ExploreFilters) => void
  onApply: () => void
  onClear: () => void
  idPrefix?: string
  hideFooter?: boolean
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex min-h-touch cursor-pointer items-center gap-3 py-1 text-sm text-dc-text">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-dc-border text-dc-accent focus:ring-dc-accent"
      />
      {label}
    </label>
  )
}

function SectionHeading({ children, helper }: { children: ReactNode; helper?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">{children}</h3>
      {helper ? <p className="text-xs leading-relaxed text-dc-text-muted">{helper}</p> : null}
    </div>
  )
}

export default function ExploreFiltersPanel({
  draft,
  onChange,
  onApply,
  onClear,
  idPrefix = 'explore-filter',
  hideFooter = false,
}: Props) {
  const locationId = useId()

  const toggleContentType = (type: ExploreContentType) => {
    const types = [...draft.contentTypes]
    const idx = types.indexOf(type)
    if (idx >= 0) types.splice(idx, 1)
    else types.push(type)
    onChange({ ...draft, contentTypes: types })
  }

  const setDate = (value: ExploreDateFilter | null) => {
    onChange({
      ...draft,
      dateFilter: value,
      thisWeek: value === 'this-week',
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeading helper="Limit results to specific kinds of community content.">Content type</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXPLORE_CONTENT_TYPES.map((type) => (
            <CheckboxField
              key={type}
              id={`${idPrefix}-type-${type}`}
              label={type}
              checked={draft.contentTypes.includes(type)}
              onChange={() => toggleContentType(type)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading helper="Near me uses your saved location; city narrows further.">Location</SectionHeading>
        <div className="space-y-2">
          <CheckboxField
            id={`${idPrefix}-near`}
            label="Near me"
            checked={draft.nearMe}
            onChange={(nearMe) => onChange({ ...draft, nearMe })}
          />
          <label htmlFor={locationId} className="sr-only">
            City or region
          </label>
          <input
            id={locationId}
            type="text"
            value={draft.location}
            onChange={(e) => onChange({ ...draft, location: e.target.value })}
            placeholder="City or region"
            className="w-full min-h-10 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus:ring-2 focus:ring-dc-accent/30"
          />
          <CheckboxField
            id={`${idPrefix}-online`}
            label="Online only"
            checked={draft.onlineOnly}
            onChange={(onlineOnly) => onChange({ ...draft, onlineOnly })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading helper="Useful for events and time-bound gatherings.">Date</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'today' as const, label: 'Today' },
              { value: 'this-week' as const, label: 'This week' },
              { value: 'this-month' as const, label: 'This month' },
            ] as const
          ).map((opt) => {
            const active = draft.dateFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setDate(active ? null : opt.value)}
                className={`xpl-chip xpl-chip--topic ${active ? 'xpl-chip--active xpl-chip--accent-fill' : ''}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-dc-border/60 bg-dc-elevated-solid/30 p-3">
        <SectionHeading helper="Discovery comfort controls — only show what matches your boundaries.">
          Trust and safety
        </SectionHeading>
        <div className="space-y-2">
          <CheckboxField
            id={`${idPrefix}-verified`}
            label="Verified organizers"
            checked={draft.verifiedOnly}
            onChange={(verifiedOnly) => onChange({ ...draft, verifiedOnly })}
          />
          <CheckboxField
            id={`${idPrefix}-beginner`}
            label="Beginner friendly"
            checked={draft.beginnerFriendly}
            onChange={(beginnerFriendly) => onChange({ ...draft, beginnerFriendly })}
          />
          <CheckboxField
            id={`${idPrefix}-public`}
            label="Public spaces only"
            checked={draft.publicSpacesOnly}
            onChange={(publicSpacesOnly) => onChange({ ...draft, publicSpacesOnly })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading helper="Same topics as the chip row on the hub page.">Topic tags</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {EXPLORE_TOPIC_CHIPS.map((topic) => {
            const active = draft.topics.some((t) => t.toLowerCase() === topic.toLowerCase())
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const topics = [...draft.topics]
                  const idx = topics.findIndex((t) => t.toLowerCase() === topic.toLowerCase())
                  if (idx >= 0) topics.splice(idx, 1)
                  else topics.push(topic)
                  onChange({ ...draft, topics })
                }}
                className={`xpl-chip xpl-chip--topic ${active ? 'xpl-chip--active xpl-chip--accent-fill' : ''}`}
              >
                {topic}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading helper="Marketplace filters for vendor listings.">Vendors</SectionHeading>
        <div className="space-y-2">
          <CheckboxField
            id={`${idPrefix}-ships`}
            label="Ships to me"
            checked={draft.shipsToMe}
            onChange={(shipsToMe) => onChange({ ...draft, shipsToMe })}
          />
          <CheckboxField
            id={`${idPrefix}-external`}
            label="Sold externally"
            checked={draft.soldExternally}
            onChange={(soldExternally) => onChange({ ...draft, soldExternally })}
          />
        </div>
      </section>

      {hideFooter ? null : (
      <div className="flex flex-col gap-2 border-t border-dc-border pt-4 sm:flex-row">
        <button
          type="button"
          onClick={onApply}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:opacity-90"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-semibold text-dc-text hover:border-dc-accent-border/50"
        >
          Clear all
        </button>
      </div>
      )}
    </div>
  )
}
