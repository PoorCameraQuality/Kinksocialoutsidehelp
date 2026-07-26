/**
 * Signed-in viewer profile from `GET /api/v1/profile/me` (credentials).
 *
 * `enabled` false → idle. `status` includes `unavailable` when the API is down
 * or DB mode is off. Use `reload` / `reloadToken` after edits; `applyProfilePatch`
 * and `updatePhoto` merge into cache without a full refetch.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

export type ProfileMeKink = {
  kinkTagId: string
  interestStatus: string
  activity: string | null
  note: string | null
  slug: string
  displayName: string
}

export type ProfileMePhoto = {
  id: string
  url: string
  caption: string | null
  order: number
  displaySettings?: ProfilePhotoDisplaySettings
  pendingReview?: boolean
  uploadStatus?: string | null
}

export type ProfileMeData = {
  user: { id: string; username: string; email: string; memberSince: string }
  profile: {
    id: string
    bio: string | null
    location: string | null
    placeId: string | null
    stateId: string | null
    customLocation: string | null
    displayName: string | null
    roles: string[] | null
    gender: string | null
    genders?: string[] | null
    sexuality: string | null
    sexualOrientations?: string[] | null
    romanticOrientations?: string[] | null
    pronouns: string | null
    pronounTags?: string[] | null
    age: number | null
    birthDate: string | null
    lifestyleActivity?: string | null
    lookingFor?: string[] | null
    notLookingFor?: string[] | null
    homeZip?: string | null
    discoverableInPeopleSearch: boolean | null
    fieldVisibility: unknown
    visibility?: 'PUBLIC' | 'MEMBERS' | 'PRIVATE' | null
  }
  kinks: ProfileMeKink[]
  photos: ProfileMePhoto[]
}

export type UseApiProfileMeResult = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'
  data: ProfileMeData | null
  reload: () => void
  /** Merge server-shaped profile fields into cached data (e.g. after PATCH) without refetch. */
  applyProfilePatch: (patch: Partial<ProfileMeData['profile']>) => void
  /** Patch a single photo row in cached profile/me data. */
  updatePhoto: (photoId: string, patch: Partial<ProfileMePhoto>) => void
  /** Increments on each `reload()` — use to re-hydrate edit forms without clobbering in-progress drafts. */
  reloadToken: number
}

export function useApiProfileMe(enabled: boolean): UseApiProfileMeResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<UseApiProfileMeResult, 'status' | 'data'>>({
    status: 'idle',
    data: null,
  })

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const applyProfilePatch = useCallback((patch: Partial<ProfileMeData['profile']>) => {
    setState((prev) => {
      if (!prev.data) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          profile: { ...prev.data.profile, ...patch },
        },
      }
    })
  }, [])

  const updatePhoto = useCallback((photoId: string, patch: Partial<ProfileMePhoto>) => {
    setState((prev) => {
      if (!prev.data) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          photos: prev.data.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
        },
      }
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', data: null })
      return
    }
    let cancelled = false
    void (async () => {
      setState((prev) => ({
        ...prev,
        status: prev.data ? prev.status : 'loading',
      }))
      try {
        const r = await fetch('/api/profile/me', { credentials: 'include' })
        if (r.status === 503) {
          if (!cancelled) setState({ status: 'unavailable', data: null })
          return
        }
        if (!r.ok) {
          if (!cancelled) setState({ status: 'error', data: null })
          return
        }
        const raw = (await r.json()) as {
          user?: ProfileMeData['user']
          profile?: ProfileMeData['profile']
          kinks?: ProfileMeKink[]
          photos?: ProfileMePhoto[]
        }
        if (!raw.user || !raw.profile) {
          if (!cancelled) setState({ status: 'error', data: null })
          return
        }
        if (!cancelled) {
          setState({
            status: 'ready',
            data: {
              user: raw.user,
              profile: raw.profile,
              kinks: Array.isArray(raw.kinks) ? raw.kinks : [],
              photos: Array.isArray(raw.photos) ? raw.photos : [],
            },
          })
        }
      } catch {
        if (!cancelled) setState({ status: 'error', data: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { ...state, reload, applyProfilePatch, updatePhoto, reloadToken }
}
