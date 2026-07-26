import { useState } from 'react'

import TextInput from '@/components/ui/TextInput'

import {

  COMMUNITY_ROLE_FILTERS,

  INTEREST_ROLE_TAGS,

  PEOPLE_COUNTRY_OPTIONS,

  PEOPLE_GENDER_FILTER_OPTIONS,

  PEOPLE_MIN_DISTANCE_MI,

} from '@/lib/people-search-constants'

import { MAX_DISTANCE_MI } from '@/lib/discovery-utils'

import type { CommunityRoleFilterId } from '@/lib/people-search-constants'



export type FindPeopleFilterDraft = {

  distance: number

  country: string

  city: string

  peopleGender: string

  communityRoles: CommunityRoleFilterId[]

  interestRoles: string[]

  experienceLevel: string

  verifiedOnly: boolean

  eventActiveOnly: boolean

}



type Props = {

  idPrefix?: string

  draft: FindPeopleFilterDraft

  onDraftChange: (patch: Partial<FindPeopleFilterDraft>) => void

  onToggleCommunityRole: (id: CommunityRoleFilterId) => void

  onToggleInterestRole: (role: string) => void

  onResetAll: () => void

  onApply: () => void

  memberCount: number

  showHeading?: boolean

  streamTab?: string
  peopleApiBacked?: boolean
  /** When true, FilterSheet footer owns Apply — hide panel footer button. */
  hideFooter?: boolean
}



const VISIBLE_INTEREST_COUNT = 8



export default function FindPeopleFiltersPanel({

  idPrefix = 'find-people',

  draft,

  onDraftChange,

  onToggleCommunityRole,

  onToggleInterestRole,

  onResetAll,

  onApply,

  memberCount,

  showHeading = true,

  streamTab = '',

  peopleApiBacked = false,

  hideFooter = false,

}: Props) {

  const nearYouTab = streamTab === 'Near you'

  const showRadius = !peopleApiBacked || nearYouTab

  const [interestsOpen, setInterestsOpen] = useState(false)

  const [showAllInterestRoles, setShowAllInterestRoles] = useState(false)

  const distanceId = `${idPrefix}-distance`

  const cityId = `${idPrefix}-city`

  const countryId = `${idPrefix}-country`

  const interestsId = `${idPrefix}-interests`

  const interestList = showAllInterestRoles ? INTEREST_ROLE_TAGS : INTEREST_ROLE_TAGS.slice(0, VISIBLE_INTEREST_COUNT)



  return (

    <div className="space-y-5">

      {showHeading ?

        <div className="flex items-center justify-between gap-2">

          <h3 className="text-sm font-semibold text-dc-text">Refine search</h3>

          <button type="button" onClick={onResetAll} className="text-xs font-medium text-dc-accent hover:underline">

            Reset all

          </button>

        </div>

      : null}



      <section aria-labelledby={`${idPrefix}-location-heading`}>

        <h4 id={`${idPrefix}-location-heading`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-dc-muted">
          Location
        </h4>
        <div className="space-y-3">

          <div>

            <label htmlFor={countryId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">

              Country

            </label>

            <select

              id={countryId}

              value={draft.country}

              onChange={(e) => onDraftChange({ country: e.target.value })}

              className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"

            >

              {PEOPLE_COUNTRY_OPTIONS.map((opt) => (

                <option key={opt.value || 'any'} value={opt.value}>

                  {opt.label}

                </option>

              ))}

            </select>

          </div>

          <div>

            <label htmlFor={cityId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">

              City or region

            </label>

            <TextInput

              id={cityId}

              type="text"

              value={draft.city}

              onChange={(e) => onDraftChange({ city: e.target.value })}

              placeholder="e.g. Philadelphia, PA"

              autoComplete="address-level2"

              className="min-h-11 rounded-xl"

            />

          </div>

          {showRadius ?
            <div>
              <label htmlFor={distanceId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
                {peopleApiBacked ? 'Sort radius (approx.)' : 'Radius'}:{' '}
                {draft.distance >= MAX_DISTANCE_MI ? 'Any' : `${draft.distance} mi`}
              </label>
              <input
                id={distanceId}
                type="range"
                min={PEOPLE_MIN_DISTANCE_MI}
                max={MAX_DISTANCE_MI}
                step={5}
                value={draft.distance}
                onChange={(e) => onDraftChange({ distance: Number(e.target.value) })}
                className="w-full accent-dc-accent"
              />
              <div className="mt-1 flex justify-between text-[10px] text-dc-muted">
                <span>{PEOPLE_MIN_DISTANCE_MI} mi</span>
                <span>{MAX_DISTANCE_MI} mi</span>
              </div>
              {peopleApiBacked ?
                <p className="mt-1 text-[10px] text-dc-muted">Demo geography. Profile-based nearby ships later.</p>
              : null}
            </div>
          : null}

        </div>

      </section>



      <section aria-labelledby={`${idPrefix}-community-heading`}>

        <h4 id={`${idPrefix}-community-heading`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-dc-muted">

          Community role &amp; discoverability

        </h4>

        <div className="space-y-3">

          <div className="space-y-2">

            <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">

              <input

                type="checkbox"

                checked={draft.verifiedOnly}

                onChange={(e) => onDraftChange({ verifiedOnly: e.target.checked })}

                className="rounded border-dc-border-strong text-dc-accent focus:ring-dc-accent"

              />

              Verified only

            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">

              <input

                type="checkbox"

                checked={draft.eventActiveOnly}

                onChange={(e) => onDraftChange({ eventActiveOnly: e.target.checked })}

                className="rounded border-dc-border-strong text-dc-accent focus:ring-dc-accent"

              />

              Event active users

            </label>

          </div>

          <div>

            <span className="mb-2 block text-sm font-medium text-dc-text-muted">Community role</span>

            <div className="space-y-2">

              {COMMUNITY_ROLE_FILTERS.map(({ id, label }) => (

                <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">

                  <input

                    type="checkbox"

                    checked={draft.communityRoles.includes(id)}

                    onChange={() => onToggleCommunityRole(id)}

                    className="rounded border-dc-border-strong text-dc-accent focus:ring-dc-accent"

                  />

                  {label}

                </label>

              ))}

            </div>

          </div>

        </div>
      </section>



      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted/40">

        <button

          type="button"

          id={interestsId}

          aria-expanded={interestsOpen}

          aria-controls={`${idPrefix}-interests-panel`}

          onClick={() => setInterestsOpen((open) => !open)}

          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"

        >

          <span>

            <span className="block text-sm font-semibold text-dc-text">Interests &amp; roles</span>

            <span className="mt-0.5 block text-xs text-dc-muted">Filter by roles and dynamics</span>

          </span>

          <svg

            className={`h-4 w-4 shrink-0 text-dc-muted transition-transform ${interestsOpen ? 'rotate-180' : ''}`}

            fill="none"

            stroke="currentColor"

            viewBox="0 0 24 24"

            aria-hidden

          >

            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />

          </svg>

        </button>

        {interestsOpen ?

          <div id={`${idPrefix}-interests-panel`} className="space-y-3 border-t border-dc-border px-3 pb-3 pt-3">

            <div>

              <span className="mb-2 block text-sm font-medium text-dc-text-muted">Roles</span>

              <div className="flex flex-wrap gap-2">

                {interestList.map((role) => {

                  const selected = draft.interestRoles.includes(role)

                  return (

                    <button

                      key={role}

                      type="button"

                      onClick={() => onToggleInterestRole(role)}

                      aria-pressed={selected}

                      className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface ${

                        selected ?

                          'bg-dc-accent text-dc-accent-foreground'

                        : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:border-dc-accent-border/50 hover:text-dc-text'

                      }`}

                    >

                      {role}

                    </button>

                  )

                })}

                {!showAllInterestRoles && INTEREST_ROLE_TAGS.length > VISIBLE_INTEREST_COUNT ?

                  <button

                    type="button"

                    onClick={() => setShowAllInterestRoles(true)}

                    className="min-h-9 rounded-full border border-dashed border-dc-accent-border/60 px-3 py-1.5 text-xs font-medium text-dc-accent"

                  >

                    + Add role

                  </button>

                : null}

              </div>

            </div>

            <div>

              <label className="mb-1.5 block text-sm font-medium text-dc-text-muted">Gender</label>

              <select

                value={draft.peopleGender}

                onChange={(e) => onDraftChange({ peopleGender: e.target.value })}

                className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"

                aria-label="Filter people by gender"

              >

                {PEOPLE_GENDER_FILTER_OPTIONS.map((opt) => (

                  <option key={opt.value || 'any'} value={opt.value}>

                    {opt.label}

                  </option>

                ))}

              </select>

            </div>

          </div>

        : null}

      </section>



      {!hideFooter ?
        <>
          <button

            type="button"

            onClick={onApply}

            className="w-full min-h-11 rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"

          >

            Apply filters

          </button>

          <p className="text-center text-xs text-dc-muted">

            <span className="font-semibold text-dc-text">{memberCount.toLocaleString()}</span> members found

          </p>
        </>
      : null}

    </div>

  )

}


