'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { commandPermissionIncludes } from '@c2k/shared'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'

export type PeopleOpsMetric = {
  id: string
  label: string
  value: number | string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  tab?: string
}

export function usePeopleOpsSummary(
  eventSlug: string,
  permissions: ConventionCommandPermissions,
  shifts: OrganizerStaffShiftDto[],
) {
  const [metrics, setMetrics] = useState<PeopleOpsMetric[]>([])
  const [loading, setLoading] = useState(true)

  const canRegistration = commandPermissionIncludes('registration', permissions)
  const canStaffOps = commandPermissionIncludes('staff_ops', permissions)

  const load = useCallback(async () => {
    setLoading(true)
    const next: PeopleOpsMetric[] = []

    const countRegistrants = async (qs: string) => {
      const res = await organizerDancecardFetch<{ total?: number }>(eventSlug, `/registrants?limit=1&offset=0${qs}`)
      return res.total ?? 0
    }

    try {
      if (canRegistration) {
        const [total, checkedIn, pendingVetting] = await Promise.all([
          countRegistrants(''),
          countRegistrants('&status=checked_in'),
          countRegistrants('&vetting=pending'),
        ])
        next.push({ id: 'signups', label: 'Signups', value: total, tab: 'signups' })
        if (total > 0) {
          next.push({
            id: 'checked_in',
            label: 'Checked in',
            value: checkedIn,
            hint: total ? `${Math.round((checkedIn / total) * 1000) / 10}% of signups` : undefined,
            tone: 'success',
            tab: 'signups',
          })
        }
        if (pendingVetting > 0) {
          next.push({
            id: 'vetting',
            label: 'Pending vetting',
            value: pendingVetting,
            hint: 'Needs review',
            tone: 'warning',
            tab: 'signups',
          })
        }

        try {
          const apps = await organizerDancecardFetch<{ applications: { status: string }[] }>(
            eventSlug,
            '/vetting-applications',
          )
          const pendingApps = (apps.applications ?? []).filter(
            (a) => a.status === 'pending' || a.status === 'review',
          ).length
          if (pendingApps > 0) {
            next.push({
              id: 'applications',
              label: 'Applications',
              value: pendingApps,
              hint: 'Pending review',
              tone: 'warning',
              tab: 'applications',
            })
          }
        } catch {
          /* omit */
        }
      }

      if (canRegistration || canStaffOps) {
        try {
          const people = await organizerDancecardFetch<{ people: unknown[] }>(eventSlug, '/people')
          const rosterCount = people.people?.length ?? 0
          if (rosterCount > 0) {
            next.push({ id: 'roster', label: 'Roster people', value: rosterCount, tab: 'roster' })
          }
        } catch {
          /* omit */
        }
      }

      if (canStaffOps && shifts.length > 0) {
        const open = shifts.filter((s) => s.shiftStatus === 'open').length
        const unassigned = shifts.filter(
          (s) => s.shiftStatus === 'open' || s.shiftStatus === 'draft' || !s.personName.trim(),
        ).length
        next.push({ id: 'shifts', label: 'Staff shifts', value: shifts.length, tab: 'staff' })
        if (open > 0) {
          next.push({
            id: 'open_shifts',
            label: 'Open shifts',
            value: open,
            hint: 'Need coverage',
            tone: 'warning',
            tab: 'staff',
          })
        } else if (unassigned > 0) {
          next.push({
            id: 'unstaffed',
            label: 'Unstaffed',
            value: unassigned,
            hint: 'Need assignment',
            tone: 'warning',
            tab: 'staff',
          })
        }

        try {
          const incidents = await organizerDancecardFetch<{ incidents: { status: string }[] }>(
            eventSlug,
            '/safety-incidents',
          )
          const openIncidents = (incidents.incidents ?? []).filter((i) => i.status !== 'resolved').length
          if (openIncidents > 0) {
            next.push({
              id: 'incidents',
              label: 'Incidents',
              value: openIncidents,
              hint: 'Open',
              tone: 'danger',
              tab: 'incidents',
            })
          }
        } catch {
          /* omit */
        }

        try {
          const compliance = await organizerDancecardFetch<{ rows: unknown[] }>(eventSlug, '/volunteer-compliance')
          const deficits = compliance.rows?.length ?? 0
          if (deficits > 0) {
            next.push({
              id: 'compliance',
              label: 'Compliance',
              value: deficits,
              hint: 'Below hours',
              tone: 'warning',
              tab: 'compliance',
            })
          }
        } catch {
          /* omit */
        }
      }
    } catch {
      /* leave partial metrics */
    } finally {
      setMetrics(next)
      setLoading(false)
    }
  }, [canRegistration, canStaffOps, eventSlug, shifts])

  useEffect(() => {
    void load()
  }, [load])

  return { metrics, loading, refresh: load }
}
