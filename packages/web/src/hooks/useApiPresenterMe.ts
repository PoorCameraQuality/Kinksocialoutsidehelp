import { useCallback, useEffect, useState } from 'react'
import type { ProfileFocus, PresenterProfileKind } from '@/lib/presenter-focus'

export type ApiPresenterProfileRow = {
  userId: string
  headline: string | null
  bioShort: string | null
  bio: string | null
  backgroundStory: string | null
  links: Record<string, string>
  profileKind: PresenterProfileKind
  expertiseTags: string[] | null
  directoryVisibility: 'PUBLIC' | 'UNLISTED'
  mentorshipOffered: boolean
  mentorshipNotes: string | null
  ratingAvg: number
  reviewCount: number
}

export type ApiPresenterOffering = {
  id: string
  title: string
  tease: string | null
  outline: string | null
  durationMinutes: number | null
  level: string | null
  format: string | null
  tags: string[] | null
  runnerMaterials?: { label: string; url: string }[] | null
  isPublic: boolean
  sortOrder: number
}

export type ApiPresenterGalleryImage = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export type ApiPresenterSkillClaim = {
  id: string
  skillLabel: string
  yearsActive: number | null
  frequency: string | null
  note: string | null
  sortOrder: number
}

export type ApiPresenterScheduleCredit = {
  slotId: string
  title: string
  startsAt: string
  conventionSlug: string
  conventionName: string
}

export type ApiPresenterMeResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  profile: ApiPresenterProfileRow | null
  profileFocuses: ProfileFocus[]
  primaryProfileFocus: ProfileFocus | null
  offerings: ApiPresenterOffering[]
  gallery: ApiPresenterGalleryImage[]
  skillClaims: ApiPresenterSkillClaim[]
  upcomingScheduleCredits: ApiPresenterScheduleCredit[]
  reload: () => void
  saveProfile: (body: Record<string, unknown>) => Promise<void>
  saveFocuses: (focuses: ProfileFocus[], primary: ProfileFocus | null) => Promise<void>
  createOffering: (body: Record<string, unknown>) => Promise<ApiPresenterOffering>
  updateOffering: (id: string, body: Record<string, unknown>) => Promise<ApiPresenterOffering>
  deleteOffering: (id: string) => Promise<void>
  createGalleryImage: (body: { imageUrl: string; caption?: string | null }) => Promise<ApiPresenterGalleryImage>
  deleteGalleryImage: (id: string) => Promise<void>
  createSkillClaim: (body: Record<string, unknown>) => Promise<ApiPresenterSkillClaim>
  updateSkillClaim: (id: string, body: Record<string, unknown>) => Promise<ApiPresenterSkillClaim>
  deleteSkillClaim: (id: string) => Promise<void>
}

async function parseJson<T>(r: Response): Promise<T> {
  return (await r.json()) as T
}

export function useApiPresenterMe(enabled = true): ApiPresenterMeResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<
    Omit<
      ApiPresenterMeResult,
      | 'reload'
      | 'saveProfile'
      | 'saveFocuses'
      | 'createOffering'
      | 'updateOffering'
      | 'deleteOffering'
      | 'createGalleryImage'
      | 'deleteGalleryImage'
      | 'createSkillClaim'
      | 'updateSkillClaim'
      | 'deleteSkillClaim'
    >
  >({
    status: 'idle',
    profile: null,
    profileFocuses: [],
    primaryProfileFocus: null,
    offerings: [],
    gallery: [],
    skillClaims: [],
    upcomingScheduleCredits: [],
  })

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({
        status: 'idle',
        profile: null,
        profileFocuses: [],
        primaryProfileFocus: null,
        offerings: [],
        gallery: [],
        skillClaims: [],
        upcomingScheduleCredits: [],
      })
      return
    }
    let cancelled = false
    void (async () => {
      setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const [pr, off, gal, skills] = await Promise.all([
          fetch('/api/v1/me/presenter-profile', { credentials: 'include' }),
          fetch('/api/v1/presenters/me/offerings', { credentials: 'include' }),
          fetch('/api/v1/presenters/me/gallery', { credentials: 'include' }),
          fetch('/api/v1/presenters/me/skill-claims', { credentials: 'include' }),
        ])
        if (pr.status === 401) {
          if (!cancelled) setState((s) => ({ ...s, status: 'error' }))
          return
        }
        const prData =
          pr.ok ?
            await parseJson<{
              presenter?: ApiPresenterProfileRow | null
              profileFocuses?: ProfileFocus[]
              primaryProfileFocus?: ProfileFocus | null
              upcomingScheduleCredits?: ApiPresenterScheduleCredit[]
            }>(pr)
          : {}
        const offData = off.ok ? await parseJson<{ items?: ApiPresenterOffering[] }>(off) : {}
        const galData = gal.ok ? await parseJson<{ items?: ApiPresenterGalleryImage[] }>(gal) : {}
        const skillData = skills.ok ? await parseJson<{ items?: ApiPresenterSkillClaim[] }>(skills) : {}
        if (!cancelled) {
          setState({
            status: 'ready',
            profile: prData.presenter ?? null,
            profileFocuses: prData.profileFocuses ?? [],
            primaryProfileFocus: prData.primaryProfileFocus ?? null,
            offerings: offData.items ?? [],
            gallery: galData.items ?? [],
            skillClaims: skillData.items ?? [],
            upcomingScheduleCredits: prData.upcomingScheduleCredits ?? [],
          })
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: 'error' }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  const saveProfile = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch('/api/v1/presenters/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = await parseJson<{ error?: string }>(r)
      throw new Error(j.error ?? 'Could not save profile')
    }
    reload()
  }, [reload])

  const saveFocuses = useCallback(
    async (focuses: ProfileFocus[], primary: ProfileFocus | null) => {
      await saveProfile({ profileFocuses: focuses, primaryProfileFocus: primary })
    },
    [saveProfile]
  )

  const createOffering = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch('/api/v1/presenters/me/offerings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await parseJson<{ offering?: ApiPresenterOffering; error?: string }>(r)
    if (!r.ok) throw new Error(j.error ?? 'Could not create offering')
    reload()
    return j.offering!
  }, [reload])

  const updateOffering = useCallback(async (id: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/v1/presenters/me/offerings/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await parseJson<{ offering?: ApiPresenterOffering; error?: string }>(r)
    if (!r.ok) throw new Error(j.error ?? 'Could not update offering')
    reload()
    return j.offering!
  }, [reload])

  const deleteOffering = useCallback(async (id: string) => {
    const r = await fetch(`/api/v1/presenters/me/offerings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) throw new Error('Could not delete offering')
    reload()
  }, [reload])

  const createGalleryImage = useCallback(async (body: { imageUrl: string; caption?: string | null }) => {
    const r = await fetch('/api/v1/presenters/me/gallery', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await parseJson<{ image?: ApiPresenterGalleryImage; error?: string }>(r)
    if (!r.ok) throw new Error(j.error ?? 'Could not add gallery image')
    reload()
    return j.image!
  }, [reload])

  const deleteGalleryImage = useCallback(async (id: string) => {
    const r = await fetch(`/api/v1/presenters/me/gallery/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) throw new Error('Could not delete gallery image')
    reload()
  }, [reload])

  const createSkillClaim = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch('/api/v1/presenters/me/skill-claims', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await parseJson<{ claim?: ApiPresenterSkillClaim; error?: string }>(r)
    if (!r.ok) throw new Error(j.error ?? 'Could not add skill claim')
    reload()
    return j.claim!
  }, [reload])

  const updateSkillClaim = useCallback(async (id: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/v1/presenters/me/skill-claims/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await parseJson<{ claim?: ApiPresenterSkillClaim; error?: string }>(r)
    if (!r.ok) throw new Error(j.error ?? 'Could not update skill claim')
    reload()
    return j.claim!
  }, [reload])

  const deleteSkillClaim = useCallback(async (id: string) => {
    const r = await fetch(`/api/v1/presenters/me/skill-claims/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) throw new Error('Could not delete skill claim')
    reload()
  }, [reload])

  return {
    ...state,
    reload,
    saveProfile,
    saveFocuses,
    createOffering,
    updateOffering,
    deleteOffering,
    createGalleryImage,
    deleteGalleryImage,
    createSkillClaim,
    updateSkillClaim,
    deleteSkillClaim,
  }
}
