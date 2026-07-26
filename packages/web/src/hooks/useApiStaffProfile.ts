import { useCallback, useEffect, useState } from 'react'

export type StaffProfileOrg = {
  organizationId: string
  role: string
  volunteerTags: string[] | null
  joinedAt: string
  organizationSlug: string
  organizationName: string
}

export type StaffProfileDuty = {
  dutyId?: string
  assignmentId?: string
  shiftId?: string
  conventionId: string
  conventionSlug: string
  conventionName: string
  roleLabel?: string
  role?: string
  station?: string | null
  title?: string
  location?: string | null
  startsAt: string
  endsAt: string
  slotTitle?: string
}

export type StaffProfileData = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  historyVisible?: boolean
  summary: {
    organizationCount: number
    staffDutyCount: number
    volunteerShiftCount: number
    upcomingAssignments: number
  }
  organizations: StaffProfileOrg[]
  staffDuties: StaffProfileDuty[]
  slotStaff: StaffProfileDuty[]
  volunteerShifts: StaffProfileDuty[]
}

export type UseApiStaffProfileResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  profile: StaffProfileData | null
  error: string | null
  reload: () => void
}

async function fetchStaffProfile(url: string): Promise<StaffProfileData | null> {
  const r = await fetch(url, { credentials: 'include' })
  if (r.status === 401) return null
  if (r.status === 404) return null
  if (r.status === 503) throw new Error('Staff profile requires database mode.')
  if (!r.ok) throw new Error(`Could not load staff profile (HTTP ${r.status}).`)
  return (await r.json()) as StaffProfileData
}

export function useApiStaffProfile(enabled: boolean, key?: string | null): UseApiStaffProfileResult {
  const [status, setStatus] = useState<UseApiStaffProfileResult['status']>('idle')
  const [profile, setProfile] = useState<StaffProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const url =
    key ?
      `/api/v1/staff/${encodeURIComponent(key)}`
    : '/api/v1/me/staff-profile'

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setProfile(null)
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const data = await fetchStaffProfile(url)
      setProfile(data)
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error loading staff profile.')
      setProfile(null)
    }
  }, [enabled, url])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, profile, error, reload }
}
