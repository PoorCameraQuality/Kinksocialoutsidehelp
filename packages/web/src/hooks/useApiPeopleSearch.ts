import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { toggleArrayItem } from '@/lib/utils/toggleArrayItem'
import { mockPeople } from '@/data/mock-data'
import { MAX_DISTANCE_MI, rankPeople } from '@/lib/discovery-utils'
import { getSortBy } from '@/lib/discovery-sort-config'
import { usePersistedGeoText } from '@/hooks/usePersistedGeoText'
import { filterPeopleByCommunityRoles, isAuditDemoUsername } from '@/lib/people-directory-utils'
import {
  PEOPLE_PAGE_SIZE,
  PEOPLE_STREAM_TABS,
  type CommunityRoleFilterId,
} from '@/lib/people-search-constants'
import type { MockPerson } from '@/data/mock-data'

export type UseApiPeopleSearchReturn = {
  streamTab: string
  setStreamTab: (value: string) => void
  distance: number
  setDistance: (value: number) => void
  country: string
  setCountry: (value: string) => void
  city: string
  setCity: (value: string) => void
  selectedRoles: string[]
  setSelectedRoles: (roles: string[]) => void
  toggleRole: (role: string) => void
  communityRoleFilters: CommunityRoleFilterId[]
  setCommunityRoleFilters: (ids: CommunityRoleFilterId[]) => void
  toggleCommunityRole: (id: CommunityRoleFilterId) => void
  experienceLevel: string
  setExperienceLevel: (value: string) => void
  verifiedOnly: boolean
  setVerifiedOnly: (value: boolean) => void
  eventActiveOnly: boolean
  setEventActiveOnly: (value: boolean) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  peopleGender: string
  setPeopleGender: (v: string) => void
  displayPeople: MockPerson[]
  totalCount: number
  peopleApiBacked: boolean
  useDemoFallback: boolean
  peopleLoading: boolean
  peopleLoadError: boolean
  reloadPeople: () => void
  hasMore: boolean
  loadMore: () => void
  viewerMissingStateId: boolean
}

export function useApiPeopleSearch(): UseApiPeopleSearchReturn {
  const [searchParams] = useSearchParams()
  const { status: authStatus, isAuthenticated, isFallback, viewerUsername } = useAuth()
  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated
  const [distance, setDistance] = useState(50)
  const { country, setCountry, city, setCity } = usePersistedGeoText()
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [communityRoleFilters, setCommunityRoleFilters] = useState<CommunityRoleFilterId[]>([])
  const [experienceLevel, setExperienceLevel] = useState('any')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [eventActiveOnly, setEventActiveOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [peopleGender, setPeopleGender] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [streamTab, setStreamTab] = useState<string>(PEOPLE_STREAM_TABS[0])
  const [dbPeople, setDbPeople] = useState<MockPerson[] | null>(null)
  const [peopleLoading, setPeopleLoading] = useState(true)
  const [peopleLoadError, setPeopleLoadError] = useState(false)
  const [peopleReloadToken, setPeopleReloadToken] = useState(0)
  const reloadPeople = useCallback(() => setPeopleReloadToken((n) => n + 1), [])
  const [viewerStateId, setViewerStateId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const q = searchParams.get('q')?.trim() ?? ''
    setSearchQuery((prev) => (prev === q ? prev : q))
  }, [searchParams])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchQuery.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (authStatus !== 'ready' || !isAuthenticated || isFallback || !viewerUsername) {
      setViewerStateId(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/profile/${encodeURIComponent(viewerUsername)}`, { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setViewerStateId(null)
          return
        }
        const data = (await r.json()) as { profile?: { stateId?: string | null } | null }
        setViewerStateId(data.profile?.stateId ?? null)
      } catch {
        if (!cancelled) setViewerStateId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authStatus, isAuthenticated, isFallback, viewerUsername])

  useEffect(() => {
    if (useDemoFallback) {
      setDbPeople(null)
      setPeopleLoading(false)
      setPeopleLoadError(false)
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setPeopleLoading(true)
      setPeopleLoadError(false)
      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        const g = peopleGender.trim()
        if (g) params.set('gender', g)
        if (debouncedQ) params.set('q', debouncedQ)
        const r = await fetch(`/api/v1/profiles?${params}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) {
            setDbPeople(null)
            setPeopleLoadError(true)
          }
          return
        }
        const data = (await r.json()) as {
          items: Array<{
            userId: string
            username: string
            displayName: string | null
            bio: string | null
            roles: string[] | null
            verified: boolean | null
            location: string | null
            age: number | null
            gender: string | null
            sexuality: string | null
            pronouns: string | null
            avatarUrl: string | null
            lastActiveAt: string | null
            photoCount?: number
            videoCount?: number
            writingCount?: number
            groupsLedCount?: number
            vendorShopSlug?: string | null
            badges?: string[] | null
          }>
        }
        if (cancelled) return
        const mapped: MockPerson[] = data.items.map((row) => {
          const badges =
            Array.isArray(row.badges) ?
              row.badges.filter((b): b is NonNullable<MockPerson['badges']>[number] => b === 'vendor_verified')
            : undefined
          return {
            id: row.userId,
            username: row.username,
            sceneName: row.displayName ?? undefined,
            age: row.age ?? undefined,
            gender: row.gender ?? undefined,
            sexuality: row.sexuality ?? undefined,
            lastActiveAt: row.lastActiveAt ?? undefined,
            roles: row.roles ?? [],
            trustScore: 0,
            trustTier: 'bronze',
            verified: !!row.verified,
            mutualCount: 0,
            distance: '',
            location: row.location ?? undefined,
            bio: row.bio ?? undefined,
            avatarUrl: row.avatarUrl ?? undefined,
            photoCount: row.photoCount,
            videoCount: row.videoCount,
            writingCount: row.writingCount,
            groupsLedCount: row.groupsLedCount,
            vendorShopSlug: row.vendorShopSlug ?? null,
            badges,
          }
        })
        setDbPeople(mapped)
      } catch {
        if (!cancelled) {
          setDbPeople(null)
          setPeopleLoadError(true)
        }
      } finally {
        if (!cancelled) setPeopleLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [peopleGender, debouncedQ, peopleReloadToken, useDemoFallback])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedQ,
    selectedRoles,
    communityRoleFilters,
    verifiedOnly,
    eventActiveOnly,
    distance,
    country,
    city,
    experienceLevel,
    streamTab,
    peopleGender,
  ])

  const toggleRole = useCallback((role: string) => {
    setSelectedRoles((previousRoles) => toggleArrayItem(previousRoles, role))
  }, [])

  const toggleCommunityRole = useCallback((id: CommunityRoleFilterId) => {
    setCommunityRoleFilters((previous) => toggleArrayItem(previous, id))
  }, [])

  const distanceMi = streamTab === 'Near you' ? distance : MAX_DISTANCE_MI

  const people = useMemo(() => {
    const peopleSource = useDemoFallback ? mockPeople : (dbPeople ?? [])
    const peopleSortBy = getSortBy('People', streamTab)
    let ranked = rankPeople(peopleSource, {
      searchQuery: debouncedQ,
      roles: selectedRoles.length ? selectedRoles : undefined,
      genderFilter: peopleGender.trim() || undefined,
      verifiedOnly,
      eventActiveOnly,
      distanceMi,
      cityFilter: city.trim() || undefined,
      countryFilter: country.trim() || undefined,
      sortBy: peopleSortBy as 'relevance' | 'trust' | 'diverse' | 'nearby' | 'new' | 'active',
    })
    if (communityRoleFilters.length) {
      ranked = filterPeopleByCommunityRoles(ranked, communityRoleFilters)
    }
    ranked = ranked.filter((p) => !isAuditDemoUsername(p.username))
    return ranked
  }, [
    dbPeople,
    debouncedQ,
    peopleGender,
    selectedRoles,
    communityRoleFilters,
    verifiedOnly,
    eventActiveOnly,
    distanceMi,
    streamTab,
    country,
    city,
  ])

  const totalCount = people.length
  const displayPeople = people.slice(0, page * PEOPLE_PAGE_SIZE)
  const hasMore = displayPeople.length < people.length
  const loadMore = useCallback(() => setPage((pageNum) => pageNum + 1), [])

  const viewerMissingStateId =
    isAuthenticated && !isFallback && viewerStateId !== undefined && viewerStateId === null

  return {
    streamTab,
    setStreamTab,
    distance,
    setDistance,
    country,
    setCountry,
    city,
    setCity,
    selectedRoles,
    setSelectedRoles,
    toggleRole,
    communityRoleFilters,
    setCommunityRoleFilters,
    toggleCommunityRole,
    experienceLevel,
    setExperienceLevel,
    verifiedOnly,
    setVerifiedOnly,
    eventActiveOnly,
    setEventActiveOnly,
    searchQuery,
    setSearchQuery,
    peopleGender,
    setPeopleGender,
    displayPeople,
    totalCount,
    peopleApiBacked: !useDemoFallback && dbPeople !== null,
    useDemoFallback,
    peopleLoading,
    peopleLoadError,
    reloadPeople,
    hasMore,
    loadMore,
    viewerMissingStateId,
  }
}
