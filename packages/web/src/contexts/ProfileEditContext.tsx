import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ageFromBirthDate,
  formatProfileBirthDateForInput,
  formatPronounDisplay,
  pickPrimaryProfilePhoto,
  PROFILE_GENDER_VALUES,
  PROFILE_ROLE_MAX,
  PROFILE_ROLE_VALUES,
  PROFILE_ROMANTIC_ORIENTATION_GROUPS,
  PROFILE_SEXUAL_ORIENTATION_GROUPS,
  parsePronounTags,
  parseLegacySexualityLabels,
  DEFAULT_PROFILE_PHOTO_DISPLAY,
  normalizeProfilePhotoDisplaySettings,
  type ProfilePhotoDisplaySettings,
} from '@c2k/shared'
import type { MediaAttestationTarget } from '@/components/media/MediaAttestationModal'
import { attachUploadedProfilePhoto, uploadProfilePhotoFile } from '@/lib/profile-photo-upload'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import { useAuth, useViewerUsername } from '@/contexts/AuthContext'
import {
  PLACE_CUSTOM,
  PLACE_STATE_ONLY,
  formatProfileLocationDisplay,
  type ZipPlaceCandidate,
} from '@/lib/profile-edit-location'

export type KinkEditorRow = {
  kinkTagId: string
  interestStatus: 'into' | 'curious' | 'soft_limit' | 'hard_limit' | 'not_into'
  activity: string
  note: string
  slug: string
  displayName: string
}

export type ProfileLinkRow = {
  id: string
  url: string
  label: string | null
  sortOrder: number
}

export type ProfileRelationshipRow = {
  id: string
  kind: 'relationship' | 'ds'
  label: string
  partnerUserId: string | null
  partnerUsername: string | null
  customText: string | null
  status: 'pending' | 'active'
  visibility: string
  sortOrder: number
}

type ProfileEditContextValue = {
  loading: boolean
  saving: boolean
  photoUploading: boolean
  photoUploadStage: 'idle' | 'uploading' | 'processing' | null
  photoUploadError: string | null
  cancelPhotoUpload: () => void
  saveNotice: string | null
  hasUnsavedChanges: boolean
  viewerUsername: string | null
  displayName: string
  setDisplayName: (v: string) => void
  bio: string
  setBio: (v: string) => void
  genders: string[]
  setGenders: (v: string[]) => void
  sexualOrientations: string[]
  setSexualOrientations: (v: string[]) => void
  romanticOrientations: string[]
  setRomanticOrientations: (v: string[]) => void
  pronounTags: string[]
  setPronounTags: (v: string[]) => void
  roles: string[]
  setRoles: (v: string[]) => void
  birthDate: string
  setBirthDate: (v: string) => void
  lifestyleActivity: string
  setLifestyleActivity: (v: string) => void
  lookingFor: string[]
  setLookingFor: (v: string[]) => void
  homeZip: string
  setHomeZip: (v: string) => void
  zipLookupError: string | null
  zipLocationHint: string | null
  zipCandidates: ZipPlaceCandidate[]
  zipLocality: string | null
  lookupZip: () => Promise<void>
  selectZipCandidate: (placeId: string) => void
  locationLabel: string
  locationsMode: 'loading' | 'ok' | 'off'
  placeSelect: string
  setPlaceSelect: (v: string) => void
  stateId: string
  setStateId: (v: string) => void
  states: { id: string; fips: string; name: string }[]
  places: { id: string; name: string }[]
  customLocation: string
  setCustomLocation: (v: string) => void
  location: string
  setLocation: (v: string) => void
  kinks: KinkEditorRow[]
  setKinks: React.Dispatch<React.SetStateAction<KinkEditorRow[]>>
  kinksError: string | null
  tagQuery: string
  setTagQuery: (v: string) => void
  tagBrowseRange: { sortOrderMin: number; sortOrderMax: number } | null
  setTagBrowseRange: (v: { sortOrderMin: number; sortOrderMax: number } | null) => void
  tagHits: { id: string; slug: string; displayName: string; sortOrder?: number }[]
  addKinkTag: (tag: { id: string; slug: string; displayName: string }) => void
  removeKink: (id: string) => void
  updateKink: (id: string, patch: Partial<Pick<KinkEditorRow, 'interestStatus' | 'activity' | 'note'>>) => void
  links: ProfileLinkRow[]
  reloadLinks: () => Promise<void>
  relationships: ProfileRelationshipRow[]
  reloadRelationships: () => Promise<void>
  hasPhoto: boolean
  photoPreviewUrl: string | null
  photoPendingReview: boolean
  primaryPhotoId: string | null
  photoCaption: string
  setPhotoCaption: (v: string) => void
  photoDisplaySettings: ProfilePhotoDisplaySettings
  setPhotoDisplaySettings: (v: ProfilePhotoDisplaySettings) => void
  photoMetaSaving: boolean
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSave: () => Promise<void>
  discardChanges: () => void
  attestationTarget: MediaAttestationTarget | null
  setAttestationTarget: (target: MediaAttestationTarget | null) => void
  onAttestationCompleted: () => void
  profileMe: ReturnType<typeof useApiProfileMe>
  genderSuggestions: readonly string[]
  roleSuggestions: readonly string[]
  sexualSuggestions: readonly string[]
  romanticSuggestions: readonly string[]
}

const ProfileEditContext = createContext<ProfileEditContextValue | null>(null)

function savedGendersFromProfile(p: Record<string, unknown>): string[] {
  const genders = p.genders as string[] | undefined
  if (genders?.length) return genders
  const gender = p.gender as string | null | undefined
  return gender ? [gender] : []
}

function savedSexualOrientationsFromProfile(p: Record<string, unknown>): string[] {
  const arr = p.sexualOrientations as string[] | undefined
  if (arr?.length) return arr
  return parseLegacySexualityLabels((p.sexuality as string) ?? '')
}

function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].map((s) => s.toLowerCase()).sort()
  const right = [...b].map((s) => s.toLowerCase()).sort()
  return left.every((v, i) => v === right[i])
}

export function useProfileEdit() {
  const ctx = useContext(ProfileEditContext)
  if (!ctx) throw new Error('useProfileEdit must be used within ProfileEditProvider')
  return ctx
}

function draftPlaceIdFromSelect(placeSelect: string): string | null {
  if (!placeSelect || placeSelect === PLACE_CUSTOM || placeSelect === PLACE_STATE_ONLY) return null
  return placeSelect
}

function savedPlaceIdFromProfile(p: Record<string, unknown>): string | null {
  const id = p.placeId as string | null | undefined
  return id?.trim() ? id : null
}

function kinkDraftKey(
  rows: { kinkTagId: string; interestStatus: string; activity?: string | null; note?: string | null }[],
): string {
  return rows
    .map((k) => `${k.kinkTagId}:${k.interestStatus}:${(k.activity ?? '').trim()}:${(k.note ?? '').trim()}`)
    .sort()
    .join('|')
}

function mapServerKinks(
  rows: {
    kinkTagId: string
    interestStatus: string
    activity: string | null
    note: string | null
    slug: string
    displayName: string
  }[],
): KinkEditorRow[] {
  return rows.map((row) => ({
    kinkTagId: row.kinkTagId,
    interestStatus: row.interestStatus as KinkEditorRow['interestStatus'],
    activity: row.activity ?? '',
    note: row.note ?? '',
    slug: row.slug,
    displayName: row.displayName,
  }))
}

function syncPrimaryPhotoDraftFromPhotos(
  photos: { id: string; url: string; caption?: string | null; order: number; displaySettings?: unknown; pendingReview?: boolean }[],
  setters: {
    setPrimaryPhotoId: (v: string | null) => void
    setPhotoCaption: (v: string) => void
    setPhotoDisplaySettings: (v: ProfilePhotoDisplaySettings) => void
    setPhotoPreviewUrl: (v: string | null) => void
    setHasPhoto: (v: boolean) => void
    setPhotoPendingReview: (v: boolean) => void
  },
) {
  const primary = pickPrimaryProfilePhoto(photos.map((p) => ({ ...p, order: p.order })))
  if (!primary) {
    setters.setPrimaryPhotoId(null)
    return
  }
  setters.setPrimaryPhotoId(primary.id)
  setters.setPhotoCaption((primary as { caption?: string | null }).caption ?? '')
  setters.setPhotoDisplaySettings(
    normalizeProfilePhotoDisplaySettings((primary as { displaySettings?: unknown }).displaySettings),
  )
  applyPrimaryPhotoFromMe(photos, {
    setPhotoPreviewUrl: setters.setPhotoPreviewUrl,
    setHasPhoto: setters.setHasPhoto,
    setPhotoPendingReview: setters.setPhotoPendingReview,
  })
}

function applyPrimaryPhotoFromMe(
  photos: { url: string; pendingReview?: boolean; order: number }[],
  setters: {
    setPhotoPreviewUrl: (v: string | null) => void
    setHasPhoto: (v: boolean) => void
    setPhotoPendingReview: (v: boolean) => void
  },
) {
  const primaryPhoto = pickPrimaryProfilePhoto(photos)
  if (primaryPhoto?.url) {
    setters.setPhotoPreviewUrl(primaryPhoto.url)
    setters.setHasPhoto(true)
    setters.setPhotoPendingReview(Boolean(primaryPhoto.pendingReview))
  } else {
    setters.setPhotoPreviewUrl(null)
    setters.setHasPhoto(false)
    setters.setPhotoPendingReview(false)
  }
}

export function ProfileEditProvider({ children }: { children: ReactNode }) {
  const viewerUsername = useViewerUsername()
  const { isAuthenticated, isFallback, status: authStatus } = useAuth()
  const profileMe = useApiProfileMe(authStatus === 'ready' && isAuthenticated && !isFallback)
  const lastHydratedReloadToken = useRef<number | null>(null)
  /** When true, the next profileMe reload only refreshes photo fields (preserves in-progress identity edits). */
  const photoOnlyReloadRef = useRef(false)
  /** Blocks autosave until identity fields are hydrated from the server (prevents wiping arrays). */
  const identityHydratedRef = useRef(false)
  /** Blocks stale photo hydration between upload complete and profileMe.reload(). */
  const photoHydrateLockRef = useRef(false)
  const [kinkBaseline, setKinkBaseline] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [genders, setGenders] = useState<string[]>([])
  const [sexualOrientations, setSexualOrientations] = useState<string[]>([])
  const [romanticOrientations, setRomanticOrientations] = useState<string[]>([])
  const [pronounTags, setPronounTags] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [birthDate, setBirthDate] = useState('')
  const [lifestyleActivity, setLifestyleActivity] = useState('')
  const [lookingFor, setLookingFor] = useState<string[]>([])
  const [homeZip, setHomeZip] = useState('')
  const [zipLookupError, setZipLookupError] = useState<string | null>(null)
  const [zipLocationHint, setZipLocationHint] = useState<string | null>(null)
  const [zipCandidates, setZipCandidates] = useState<ZipPlaceCandidate[]>([])
  const [zipLocality, setZipLocality] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [locationsMode, setLocationsMode] = useState<'loading' | 'ok' | 'off'>('loading')
  const [states, setStates] = useState<{ id: string; fips: string; name: string }[]>([])
  const [places, setPlaces] = useState<{ id: string; name: string }[]>([])
  const [stateId, setStateId] = useState('')
  const [placeSelect, setPlaceSelect] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [hasPhoto, setHasPhoto] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoPendingReview, setPhotoPendingReview] = useState(false)
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoDisplaySettings, setPhotoDisplaySettings] = useState<ProfilePhotoDisplaySettings>(
    DEFAULT_PROFILE_PHOTO_DISPLAY,
  )
  const [photoMetaSaving, setPhotoMetaSaving] = useState(false)
  const photoMetaSaveSkipRef = useRef(true)
  const photoUploadInFlight = useRef(false)
  const photoBlobUrlRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUploadStage, setPhotoUploadStage] = useState<'idle' | 'uploading' | 'processing' | null>(null)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [kinks, setKinks] = useState<KinkEditorRow[]>([])
  const [kinksError, setKinksError] = useState<string | null>(null)
  const [tagQuery, setTagQuery] = useState('')
  const [tagBrowseRange, setTagBrowseRange] = useState<{ sortOrderMin: number; sortOrderMax: number } | null>(null)
  const [allKinkTags, setAllKinkTags] = useState<
    { id: string; slug: string; displayName: string; sortOrder: number }[]
  >([])
  const [links, setLinks] = useState<ProfileLinkRow[]>([])
  const [relationships, setRelationships] = useState<ProfileRelationshipRow[]>([])
  const [attestationTarget, setAttestationTarget] = useState<MediaAttestationTarget | null>(null)

  const sexualSuggestions = useMemo(
    () =>
      PROFILE_SEXUAL_ORIENTATION_GROUPS.flatMap((g) => g.options).filter(
        (o) => o !== 'Other (describe below)',
      ),
    [],
  )
  const romanticSuggestions = useMemo(
    () =>
      PROFILE_ROMANTIC_ORIENTATION_GROUPS.flatMap((g) => g.options).filter(
        (o) => o !== 'Other (describe below)',
      ),
    [],
  )
  const genderSuggestions = useMemo(
    () => PROFILE_GENDER_VALUES.filter((o) => o !== 'Other (describe below)'),
    [],
  )
  const roleSuggestions = useMemo(
    () => PROFILE_ROLE_VALUES.filter((o) => o !== 'Other (describe below)'),
    [],
  )

  const reloadLinks = useCallback(async () => {
    const r = await fetch('/api/profile/me/links', { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { links?: ProfileLinkRow[] }
    setLinks(d.links ?? [])
  }, [])

  const reloadRelationships = useCallback(async () => {
    const r = await fetch('/api/profile/me/relationships', { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { relationships?: ProfileRelationshipRow[] }
    setRelationships(d.relationships ?? [])
  }, [])

  // Keep avatar preview aligned with server photos (e.g. after upload on another tab or page reload).
  useEffect(() => {
    if (profileMe.status !== 'ready' || !profileMe.data || photoUploading || photoHydrateLockRef.current) {
      return
    }
    applyPrimaryPhotoFromMe(profileMe.data.photos, {
      setPhotoPreviewUrl,
      setHasPhoto,
      setPhotoPendingReview,
    })
  }, [profileMe.status, profileMe.data?.photos, profileMe.reloadToken, photoUploading])

  useLayoutEffect(() => {
    if (profileMe.status !== 'ready' || !profileMe.data) return
    if (lastHydratedReloadToken.current === profileMe.reloadToken) return
    lastHydratedReloadToken.current = profileMe.reloadToken

    if (photoOnlyReloadRef.current) {
      photoOnlyReloadRef.current = false
      applyPrimaryPhotoFromMe(profileMe.data.photos, {
        setPhotoPreviewUrl,
        setHasPhoto,
        setPhotoPendingReview,
      })
      photoHydrateLockRef.current = false
      identityHydratedRef.current = true
      return
    }
    setZipLocationHint(null)
    setZipCandidates([])
    setZipLocality(null)
    const p = profileMe.data.profile as Record<string, unknown>
    setKinks(mapServerKinks(profileMe.data.kinks))
    setKinkBaseline(kinkDraftKey(profileMe.data.kinks))
    syncPrimaryPhotoDraftFromPhotos(profileMe.data.photos, {
      setPrimaryPhotoId,
      setPhotoCaption,
      setPhotoDisplaySettings,
      setPhotoPreviewUrl,
      setHasPhoto,
      setPhotoPendingReview,
    })
    photoMetaSaveSkipRef.current = true
    setDisplayName((p.displayName as string) ?? '')
    setBio((p.bio as string) ?? '')
    setGenders((p.genders as string[]) ?? (p.gender ? [String(p.gender)] : []))
    setSexualOrientations(savedSexualOrientationsFromProfile(p))
    setRomanticOrientations((p.romanticOrientations as string[]) ?? [])
    setPronounTags(parsePronounTags((p.pronounTags as string[]) ?? p.pronouns))
    setRoles((p.roles as string[]) ?? [])
    setBirthDate(formatProfileBirthDateForInput(p.birthDate as string | null))
    setLifestyleActivity((p.lifestyleActivity as string) ?? '')
    setLookingFor((p.lookingFor as string[]) ?? [])
    setHomeZip((p.homeZip as string) ?? '')
    setLocation((p.location as string) ?? '')
    identityHydratedRef.current = true
    void reloadLinks()
    void reloadRelationships()
  }, [profileMe.status, profileMe.data, profileMe.reloadToken, reloadLinks, reloadRelationships])

  useEffect(() => {
    const onPrivacySaved = async () => {
      try {
        const r = await fetch('/api/profile/me', { credentials: 'include' })
        if (!r.ok) return
        const data = (await r.json()) as {
          profile?: {
            fieldVisibility?: unknown
            discoverableInPeopleSearch?: boolean | null
            visibility?: string | null
          }
        }
        if (data.profile) {
          profileMe.applyProfilePatch({
            fieldVisibility: data.profile.fieldVisibility,
            discoverableInPeopleSearch: data.profile.discoverableInPeopleSearch ?? null,
            ...(data.profile.visibility === 'PUBLIC' ||
            data.profile.visibility === 'MEMBERS' ||
            data.profile.visibility === 'PRIVATE' ?
              { visibility: data.profile.visibility }
            : {}),
          })
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('c2k:profile-privacy-saved', onPrivacySaved)
    return () => window.removeEventListener('c2k:profile-privacy-saved', onPrivacySaved)
  }, [profileMe.applyProfilePatch])

  useEffect(() => {
    if (authStatus !== 'ready' || !isAuthenticated || isFallback || profileMe.status !== 'ready') return
    const p = profileMe.data?.profile as Record<string, unknown> | undefined
    if (!p) return
    let cancelled = false
    void (async () => {
      setLocationsMode('loading')
      try {
        const countriesRes = await fetch('/api/locations/countries', { credentials: 'include' })
        if (!countriesRes.ok || cancelled) {
          setLocationsMode('off')
          return
        }
        const cdata = (await countriesRes.json()) as { countries?: { id: string; code: string; name: string }[] }
        const us = cdata.countries?.find((c) => c.code === 'US') ?? cdata.countries?.[0]
        if (!us || cancelled) {
          setLocationsMode('off')
          return
        }
        const sres = await fetch(`/api/locations/states?country_id=${encodeURIComponent(us.id)}`, {
          credentials: 'include',
        })
        if (!sres.ok || cancelled) {
          setLocationsMode('off')
          return
        }
        const sdata = (await sres.json()) as { states?: { id: string; fips: string; name: string }[] }
        setStates(sdata.states ?? [])
        setLocationsMode('ok')
        const sid = (p.stateId as string) ?? ''
        if (p.customLocation) {
          setStateId(sid)
          setPlaceSelect(PLACE_CUSTOM)
          setCustomLocation(String(p.customLocation))
        } else if (p.placeId) {
          setStateId(sid)
          setPlaceSelect(String(p.placeId))
        } else if (sid) {
          setStateId(sid)
          setPlaceSelect(PLACE_STATE_ONLY)
        }
      } catch {
        if (!cancelled) setLocationsMode('off')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authStatus, isAuthenticated, isFallback, profileMe.status, profileMe.data])

  useEffect(() => {
    if (!stateId) {
      setPlaces([])
      return
    }
    let cancelled = false
    void (async () => {
      const r = await fetch(`/api/locations/places?state_id=${encodeURIComponent(stateId)}`, { credentials: 'include' })
      if (!r.ok || cancelled) return
      const d = (await r.json()) as { places?: { id: string; name: string }[] }
      if (!cancelled) setPlaces(d.places ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [stateId])

  useEffect(() => {
    if (authStatus !== 'ready' || !isAuthenticated || isFallback) return
    let cancelled = false
    void (async () => {
      const r = await fetch('/api/kink-tags?limit=250', { credentials: 'include' })
      const data = (await r.json()) as {
        tags?: { id: string; slug: string; displayName: string; sortOrder?: number }[]
      }
      if (!cancelled && r.ok && data.tags) {
        setAllKinkTags(
          data.tags.map((tag) => ({
            ...tag,
            sortOrder: tag.sortOrder ?? 0,
          })),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authStatus, isAuthenticated, isFallback])

  const tagHits = useMemo(() => {
    const selected = new Set(kinks.map((k) => k.kinkTagId))
    let list = allKinkTags.filter((tag) => !selected.has(tag.id))
    const q = tagQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (tag) => tag.displayName.toLowerCase().includes(q) || tag.slug.toLowerCase().includes(q),
      )
    } else if (tagBrowseRange) {
      list = list.filter(
        (tag) => tag.sortOrder >= tagBrowseRange.sortOrderMin && tag.sortOrder <= tagBrowseRange.sortOrderMax,
      )
    }
    return list.slice(0, q || tagBrowseRange ? 80 : 40)
  }, [allKinkTags, kinks, tagQuery, tagBrowseRange])

  const locationLabel = useMemo(() => {
    const structured = formatProfileLocationDisplay({
      locationsMode: states.length > 0 ? 'ok' : locationsMode,
      location,
      placeSelect,
      customLocation,
      stateId,
      states,
      places: places.map((p) => ({ ...p, population: 0 })),
    })
    if (structured.trim()) return structured
    if (zipLocationHint?.trim() && draftPlaceIdFromSelect(placeSelect)) return zipLocationHint
    return location
  }, [locationsMode, location, placeSelect, customLocation, stateId, states, places, zipLocationHint])

  const setHomeZipDraft = useCallback((value: string) => {
    setHomeZip(value)
    setZipCandidates([])
    setZipLocality(null)
    setZipLookupError(null)
    const digits = value.replace(/\D/g, '').slice(0, 5)
    if (digits.length < 5) {
      setPlaceSelect('')
      setZipLocationHint(null)
    }
  }, [])

  const selectZipCandidate = useCallback(
    (candidatePlaceId: string) => {
      const hit = zipCandidates.find((c) => c.placeId === candidatePlaceId)
      if (!hit) return
      setPlaceSelect(candidatePlaceId)
      setZipLocationHint(hit.display)
      setCustomLocation('')
    },
    [zipCandidates],
  )

  const lookupZip = useCallback(async () => {
    const zip = homeZip.replace(/\D/g, '').slice(0, 5)
    if (zip.length < 5) {
      setZipLookupError('Enter a 5-digit ZIP code.')
      return
    }
    setZipLookupError(null)
    setZipLocationHint(null)
    setZipCandidates([])
    setZipLocality(null)
    setPlaceSelect('')
    const r = await fetch(`/api/locations/by-zip?zip=${encodeURIComponent(zip)}`, { credentials: 'include' })
    const data = (await r.json().catch(() => ({}))) as {
      error?: string
      placeId?: string
      stateId?: string
      display?: string
      zipLocality?: string
      candidates?: ZipPlaceCandidate[]
    }
    if (!r.ok) {
      setZipLookupError(data.error ?? 'ZIP not found.')
      return
    }
    const candidates = data.candidates ?? []
    setZipCandidates(candidates)
    setZipLocality(data.zipLocality ?? null)
    if (data.stateId) setStateId(data.stateId)
    setCustomLocation('')
    setHomeZip(zip)
    setLocation('')
    const savedPlaceId =
      profileMe.status === 'ready' && profileMe.data
        ? savedPlaceIdFromProfile(profileMe.data.profile as Record<string, unknown>)
        : null
    if (savedPlaceId && candidates.some((c) => c.placeId === savedPlaceId)) {
      const hit = candidates.find((c) => c.placeId === savedPlaceId)!
      setPlaceSelect(savedPlaceId)
      setZipLocationHint(hit.display)
    } else if (data.placeId) {
      setPlaceSelect(data.placeId)
      setZipLocationHint(data.display ?? null)
    } else if (candidates.length === 1) {
      setPlaceSelect(candidates[0]!.placeId)
      setZipLocationHint(candidates[0]!.display)
    }
  }, [homeZip, profileMe.status, profileMe.data])

  const onAttestationCompleted = useCallback(() => {
    setAttestationTarget(null)
    photoOnlyReloadRef.current = false
    profileMe.reload()
  }, [profileMe])

  const revertPhotoPreview = useCallback(() => {
    if (photoBlobUrlRef.current) {
      URL.revokeObjectURL(photoBlobUrlRef.current)
      photoBlobUrlRef.current = null
    }
    if (profileMe.status === 'ready' && profileMe.data) {
      applyPrimaryPhotoFromMe(profileMe.data.photos, {
        setPhotoPreviewUrl,
        setHasPhoto,
        setPhotoPendingReview,
      })
    } else {
      setPhotoPreviewUrl(null)
      setHasPhoto(false)
      setPhotoPendingReview(false)
    }
  }, [profileMe])

  const cancelPhotoUpload = useCallback(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    photoUploadInFlight.current = false
    setPhotoUploading(false)
    setPhotoUploadStage(null)
    setPhotoUploadError(null)
    revertPhotoPreview()
  }, [revertPhotoPreview])

  useEffect(
    () => () => {
      uploadAbortRef.current?.abort()
      photoUploadInFlight.current = false
    },
    [],
  )

  const hasUnsavedKinkChanges = useMemo(() => {
    return kinkDraftKey(kinks) !== kinkBaseline
  }, [kinks, kinkBaseline])

  const hasUnsavedProfileChanges = useMemo(() => {
    if (profileMe.status !== 'ready' || !profileMe.data) return false
    const p = profileMe.data.profile as Record<string, unknown>
    const savedRomantic = (p.romanticOrientations as string[] | undefined) ?? []
    const savedRoles = (p.roles as string[] | undefined) ?? []
    const savedLookingFor = (p.lookingFor as string[] | undefined) ?? []
    const savedPlaceId = savedPlaceIdFromProfile(p)
    const draftPlaceId = draftPlaceIdFromSelect(placeSelect)
    const savedStateId = ((p.stateId as string) ?? '').trim()
    const savedCustomLocation = ((p.customLocation as string) ?? '').trim()
    const draftCustomLocation = customLocation.trim()
    const savedUsesStateOnly = !savedPlaceId && Boolean(savedStateId) && !savedCustomLocation
    const draftUsesStateOnly = placeSelect === PLACE_STATE_ONLY
    const savedUsesCustom = Boolean(savedCustomLocation)
    const draftUsesCustom = placeSelect === PLACE_CUSTOM
    return (
      (p.displayName ?? '') !== displayName.trim() ||
      (p.bio ?? '') !== bio ||
      !stringArraysEqual(savedGendersFromProfile(p), genders) ||
      !stringArraysEqual(savedSexualOrientationsFromProfile(p), sexualOrientations) ||
      !stringArraysEqual(savedRomantic, romanticOrientations) ||
      formatPronounDisplay(p.pronounTags as string[] ?? parsePronounTags(p.pronouns as string)) !==
        formatPronounDisplay(pronounTags) ||
      (p.location ?? '') !== locationLabel ||
      draftPlaceId !== savedPlaceId ||
      stateId.trim() !== savedStateId ||
      draftCustomLocation !== savedCustomLocation ||
      draftUsesStateOnly !== savedUsesStateOnly ||
      draftUsesCustom !== savedUsesCustom ||
      !stringArraysEqual(savedRoles, roles) ||
      formatProfileBirthDateForInput(p.birthDate as string | null) !== birthDate.trim() ||
      (p.lifestyleActivity ?? '') !== lifestyleActivity ||
      !stringArraysEqual(savedLookingFor, lookingFor) ||
      (p.homeZip ?? '') !== homeZip.replace(/\D/g, '').slice(0, 5)
    )
  }, [
    profileMe.status,
    profileMe.data,
    displayName,
    bio,
    genders,
    sexualOrientations,
    romanticOrientations,
    pronounTags,
    locationLabel,
    placeSelect,
    stateId,
    customLocation,
    roles,
    birthDate,
    lifestyleActivity,
    lookingFor,
    homeZip,
  ])

  const hasUnsavedChanges = hasUnsavedProfileChanges || hasUnsavedKinkChanges

  const handleSaveRef = useRef<() => Promise<void>>(async () => {})
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Serializes concurrent save attempts so autosaves cannot clobber dirty fields. */
  const saveChainRef = useRef(Promise.resolve())
  /** True while focus is in a text field — autosave waits until blur to avoid interrupting typing. */
  const autosavePausedRef = useRef(false)

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable)

    const syncPause = () => {
      autosavePausedRef.current = isEditable(document.activeElement)
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) autosavePausedRef.current = true
    }
    const onFocusOut = () => {
      window.setTimeout(syncPause, 0)
    }
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    return () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
    }
  }, [])

  async function saveKinksToApi(): Promise<{ error: string | null; kinks: KinkEditorRow[] | null }> {
    const body = kinks.map((k) => ({
      kinkTagId: k.kinkTagId,
      interestStatus: k.interestStatus,
      activity: k.activity.trim() || null,
      note: k.note.trim() || null,
    }))
    const r = await fetch('/api/profile/me/kinks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = (await r.json().catch(() => ({}))) as {
      error?: string
      kinks?: {
        kinkTagId: string
        interestStatus: string
        activity: string | null
        note: string | null
        slug: string
        displayName: string
      }[]
    }
    if (!r.ok) {
      return {
        error: typeof data.error === 'string' ? data.error : 'Could not save interests.',
        kinks: null,
      }
    }
    return { error: null, kinks: mapServerKinks(data.kinks ?? []) }
  }

  const handleSave = useCallback(async () => {
    setSaveNotice(null)
    if (birthDate.trim()) {
      const computedAge = ageFromBirthDate(birthDate)
      if (computedAge == null || computedAge < 18) {
        setSaveNotice('Birth date must indicate you are at least 18 years old.')
        return
      }
    }
    if (!hasUnsavedProfileChanges && !hasUnsavedKinkChanges) return

    setSaving(true)
    let profileSaved = !hasUnsavedProfileChanges
    let profileSaveError: string | null = null
    let profileSyncedFromResponse = false
    let kinksSaved = !hasUnsavedKinkChanges
    try {
      if (hasUnsavedProfileChanges) {
        const p = profileMe.data!.profile as Record<string, unknown>
        const savedZip = String(p.homeZip ?? '').replace(/\D/g, '').slice(0, 5)
        const draftZip = homeZip.replace(/\D/g, '').slice(0, 5)
        const payload: Record<string, unknown> = {
          displayName: displayName.trim() || null,
          bio: bio ?? '',
          birthDate: birthDate.trim() ? birthDate.trim() : null,
          lifestyleActivity: lifestyleActivity || null,
          genders,
          sexualOrientations,
          romanticOrientations,
          pronounTags,
          roles: roles.slice(0, PROFILE_ROLE_MAX),
          lookingFor,
        }
        if (draftZip !== savedZip) {
          if (draftZip.length === 0) payload.homeZip = null
          else if (draftZip.length === 5) payload.homeZip = draftZip
        }
        if (placeSelect === PLACE_CUSTOM) {
          payload.placeId = null
          payload.stateId = stateId || null
          payload.customLocation = customLocation.trim() || null
        } else if (placeSelect === PLACE_STATE_ONLY) {
          payload.placeId = null
          payload.stateId = stateId || null
          payload.customLocation = null
        } else if (placeSelect) {
          payload.placeId = placeSelect
          payload.stateId = stateId || null
          payload.customLocation = null
        } else if (stateId) {
          payload.stateId = stateId
        } else if (location.trim()) {
          payload.location = location.trim()
        }
        const r = await fetch('/api/profile/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { error?: string }
          const message = data.error ?? `Could not save profile (${r.status}).`
          profileSaveError = message
          setSaveNotice(message)
          profileSaved = false
        } else {
          profileSaved = true
          const data = (await r.json().catch(() => ({}))) as {
            profile?: Record<string, unknown>
          }
          const saved = data.profile
          if (saved) {
            const serverSexual = savedSexualOrientationsFromProfile(saved)
            const serverRomantic = (saved.romanticOrientations as string[] | undefined) ?? []
            const serverGenders = savedGendersFromProfile(saved)
            const serverPronouns = parsePronounTags(
              (saved.pronounTags as string[] | undefined) ?? (saved.pronouns as string | undefined),
            )
            const serverRoles = (saved.roles as string[] | undefined) ?? []
            setSexualOrientations(serverSexual)
            setRomanticOrientations(serverRomantic)
            setGenders(serverGenders)
            setPronounTags(serverPronouns)
            setRoles(serverRoles)
            profileMe.applyProfilePatch({
              displayName: (saved.displayName as string | null) ?? null,
              bio: (saved.bio as string | null) ?? null,
              genders: serverGenders,
              gender: serverGenders[0] ?? null,
              sexualOrientations: serverSexual,
              romanticOrientations: serverRomantic,
              sexuality: (saved.sexuality as string | null) ?? null,
              pronounTags: serverPronouns,
              pronouns: (saved.pronouns as string | null) ?? null,
              roles: serverRoles,
              birthDate: (saved.birthDate as string | null) ?? null,
              lifestyleActivity: (saved.lifestyleActivity as string | null) ?? null,
              lookingFor: (saved.lookingFor as string[] | undefined) ?? [],
              homeZip: (saved.homeZip as string | null) ?? null,
              location: (saved.location as string | null) ?? null,
              placeId: (saved.placeId as string | null) ?? null,
              stateId: (saved.stateId as string | null) ?? null,
              customLocation: (saved.customLocation as string | null) ?? null,
            })
            setLookingFor((saved.lookingFor as string[] | undefined) ?? [])
            setBio((saved.bio as string | null) ?? '')
            setDisplayName((saved.displayName as string) ?? '')
            setLifestyleActivity((saved.lifestyleActivity as string) ?? '')
            setBirthDate(formatProfileBirthDateForInput(saved.birthDate as string | null))
            setHomeZip((saved.homeZip as string) ?? '')
            profileSyncedFromResponse = true
            window.dispatchEvent(new Event('c2k:profile-saved'))
          }
        }
      }

      if (hasUnsavedKinkChanges) {
        const kinkResult = await saveKinksToApi()
        if (kinkResult.error) {
          setKinksError(kinkResult.error)
          kinksSaved = false
        } else {
          setKinksError(null)
          if (kinkResult.kinks) {
            setKinks(kinkResult.kinks)
            setKinkBaseline(kinkDraftKey(kinkResult.kinks))
          }
          kinksSaved = true
        }
      }

      if (!profileSaved && !kinksSaved) return
      if (!profileSaved && kinksSaved) {
        setSaveNotice(
          profileSaveError ?
            `Interests saved. ${profileSaveError}`
          : 'Interests saved. Fix profile fields above, then save again for the rest.',
        )
      } else if (profileSaved && !kinksSaved) {
        setSaveNotice('Profile saved, but interests did not sync.')
        return
      } else if (hasUnsavedProfileChanges && hasUnsavedKinkChanges) {
        setSaveNotice('Profile and interests saved.')
      } else if (hasUnsavedKinkChanges) {
        setSaveNotice('Interests saved.')
      } else {
        setSaveNotice('Profile saved.')
      }

      if (profileSaved && !profileSyncedFromResponse) {
        const zipDigits = homeZip.replace(/\D/g, '').slice(0, 5)
        const draftPlaceId = draftPlaceIdFromSelect(placeSelect)
        profileMe.applyProfilePatch({
          displayName: displayName.trim() || null,
          bio: bio || null,
          genders,
          gender: genders[0] ?? null,
          sexualOrientations,
          romanticOrientations,
          pronounTags,
          roles: roles.slice(0, PROFILE_ROLE_MAX),
          birthDate: birthDate.trim() ? birthDate.trim() : null,
          lifestyleActivity: lifestyleActivity || null,
          lookingFor,
          homeZip: zipDigits || null,
          location: locationLabel.trim() || location.trim() || null,
          placeId: draftPlaceId,
          stateId: stateId.trim() || null,
          customLocation:
            placeSelect === PLACE_CUSTOM ? customLocation.trim() || null : null,
        })
        window.dispatchEvent(new Event('c2k:profile-saved'))
      }
      setTimeout(() => setSaveNotice(null), 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error.'
      setSaveNotice(message)
    } finally {
      setSaving(false)
    }
  }, [
    displayName,
    bio,
    genders,
    sexualOrientations,
    romanticOrientations,
    pronounTags,
    roles,
    birthDate,
    lifestyleActivity,
    lookingFor,
    homeZip,
    placeSelect,
    stateId,
    customLocation,
    location,
    kinks,
    profileMe,
    hasUnsavedProfileChanges,
    hasUnsavedKinkChanges,
  ])

  const runSerializedSave = useCallback(() => {
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        await handleSaveRef.current()
      })
      .catch(() => {
        /* handleSave sets user-visible errors */
      })
    return saveChainRef.current
  }, [])

  handleSaveRef.current = handleSave

  useEffect(() => {
    if (profileMe.status !== 'ready' || !hasUnsavedChanges || saving || photoUploading) {
      return
    }
    if (!identityHydratedRef.current) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(function attemptAutoSave() {
      if (autosavePausedRef.current) {
        autoSaveTimerRef.current = setTimeout(attemptAutoSave, 800)
        return
      }
      void runSerializedSave()
    }, 2500)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [
    profileMe.status,
    hasUnsavedChanges,
    saving,
    photoUploading,
    displayName,
    bio,
    genders,
    sexualOrientations,
    romanticOrientations,
    pronounTags,
    roles,
    birthDate,
    lifestyleActivity,
    lookingFor,
    homeZip,
    placeSelect,
    stateId,
    customLocation,
    location,
    kinks,
    runSerializedSave,
  ])

  const uploadProfilePhotoFromFile = useCallback(
    async (file: File) => {
      if (photoUploadInFlight.current) {
        cancelPhotoUpload()
      }
      const abort = new AbortController()
      uploadAbortRef.current = abort
      photoUploadInFlight.current = true
      setPhotoUploading(true)
      setPhotoUploadStage('uploading')
      setSaveNotice(null)
      setPhotoUploadError(null)
      if (photoBlobUrlRef.current) {
        URL.revokeObjectURL(photoBlobUrlRef.current)
      }
      const blobUrl = URL.createObjectURL(file)
      photoBlobUrlRef.current = blobUrl
      setPhotoPreviewUrl(blobUrl)
      setHasPhoto(true)
      setPhotoPendingReview(false)
      try {
        const uploaded = await uploadProfilePhotoFile(file, { signal: abort.signal })
        if (abort.signal.aborted) return
        if (!uploaded.url && !uploaded.quarantineKey) {
          const message =
            uploaded.error ?? 'Could not upload photo. Check your connection or try a smaller image.'
          setPhotoUploadError(message)
          setSaveNotice(message)
          revertPhotoPreview()
          return
        }
        setPhotoUploadStage('processing')
        const attached = await attachUploadedProfilePhoto(uploaded, 0, {
          signal: abort.signal,
          caption: photoCaption,
          displaySettings: photoDisplaySettings,
        })
        if (abort.signal.aborted) return
        if (!attached.ok) {
          setPhotoUploadError(attached.error)
          setSaveNotice(attached.error)
          revertPhotoPreview()
          return
        }
        if (photoBlobUrlRef.current) {
          URL.revokeObjectURL(photoBlobUrlRef.current)
          photoBlobUrlRef.current = null
        }
        if (attached.photoUrl) setPhotoPreviewUrl(attached.photoUrl)
        else if (attached.mediaAssetId) {
          setPhotoPreviewUrl(`/api/v1/media/assets/${attached.mediaAssetId}/content`)
        }
        setPhotoPendingReview(attached.outcome === 'pending_review')
        if (attached.photoId) {
          setPrimaryPhotoId(attached.photoId)
          photoMetaSaveSkipRef.current = true
        }
        if (attached.needsAttestation && attached.mediaAssetId) {
          setAttestationTarget({ mediaAssetId: attached.mediaAssetId, label: 'profile photo' })
        }
        setSaveNotice(
          attached.outcome === 'pending_review' ?
            'Photo saved — under review. It will appear on your public profile once approved.'
          : 'Profile photo updated.',
        )
        setTimeout(() => setSaveNotice(null), 8000)
        photoOnlyReloadRef.current = true
        photoHydrateLockRef.current = true
        profileMe.reload()
      } catch (err) {
        if (abort.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Could not upload photo.'
        setPhotoUploadError(message)
        setSaveNotice(message)
        revertPhotoPreview()
      } finally {
        if (uploadAbortRef.current === abort) {
          uploadAbortRef.current = null
        }
        photoUploadInFlight.current = false
        setPhotoUploading(false)
        setPhotoUploadStage(null)
      }
    },
    [profileMe, cancelPhotoUpload, revertPhotoPreview, photoCaption, photoDisplaySettings],
  )

  useEffect(() => {
    if (!primaryPhotoId || photoUploading || profileMe.status !== 'ready') return
    if (photoMetaSaveSkipRef.current) {
      photoMetaSaveSkipRef.current = false
      return
    }
    const primary = pickPrimaryProfilePhoto(profileMe.data?.photos ?? [])
    const savedCaption = primary?.caption?.trim() ?? ''
    const savedDisplay = normalizeProfilePhotoDisplaySettings(primary?.displaySettings)
    const captionChanged = photoCaption.trim() !== savedCaption
    const displayChanged =
      photoDisplaySettings.displayFit !== savedDisplay.displayFit ||
      photoDisplaySettings.focalX !== savedDisplay.focalX ||
      photoDisplaySettings.focalY !== savedDisplay.focalY
    if (!captionChanged && !displayChanged) return

    const timer = window.setTimeout(() => {
      void (async () => {
        setPhotoMetaSaving(true)
        try {
          const r = await fetch(`/api/profile/me/photos/${encodeURIComponent(primaryPhotoId)}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caption: photoCaption.trim() || null,
              displaySettings: photoDisplaySettings,
            }),
          })
          if (!r.ok) return
          profileMe.updatePhoto(primaryPhotoId, {
            caption: photoCaption.trim() || null,
            displaySettings: photoDisplaySettings,
          })
        } finally {
          setPhotoMetaSaving(false)
        }
      })()
    }, 800)
    return () => window.clearTimeout(timer)
  }, [
    primaryPhotoId,
    photoCaption,
    photoDisplaySettings,
    photoUploading,
    profileMe,
  ])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    void uploadProfilePhotoFromFile(file)
  }

  function addKinkTag(tag: { id: string; slug: string; displayName: string }) {
    if (kinks.some((k) => k.kinkTagId === tag.id)) return
    setKinks((prev) => [
      ...prev,
      { kinkTagId: tag.id, interestStatus: 'into', activity: '', note: '', slug: tag.slug, displayName: tag.displayName },
    ])
    setTagQuery('')
  }

  function removeKink(id: string) {
    setKinks((prev) => prev.filter((k) => k.kinkTagId !== id))
  }

  function updateKink(id: string, patch: Partial<Pick<KinkEditorRow, 'interestStatus' | 'activity' | 'note'>>) {
    setKinks((prev) => prev.map((k) => (k.kinkTagId === id ? { ...k, ...patch } : k)))
  }

  const value: ProfileEditContextValue = {
    loading: profileMe.status === 'loading' && !profileMe.data,
    saving,
    photoUploading,
    photoUploadStage,
    photoUploadError,
    cancelPhotoUpload,
    saveNotice,
    hasUnsavedChanges,
    viewerUsername,
    displayName,
    setDisplayName,
    bio,
    setBio,
    genders,
    setGenders,
    sexualOrientations,
    setSexualOrientations,
    romanticOrientations,
    setRomanticOrientations,
    pronounTags,
    setPronounTags,
    roles,
    setRoles,
    birthDate,
    setBirthDate,
    lifestyleActivity,
    setLifestyleActivity,
    lookingFor,
    setLookingFor,
    homeZip,
    setHomeZip: setHomeZipDraft,
    zipLookupError,
    zipLocationHint,
    zipCandidates,
    zipLocality,
    lookupZip,
    selectZipCandidate,
    locationLabel,
    locationsMode,
    placeSelect,
    setPlaceSelect,
    stateId,
    setStateId,
    states,
    places,
    customLocation,
    setCustomLocation,
    location,
    setLocation,
    kinks,
    setKinks,
    kinksError,
    tagQuery,
    setTagQuery,
    tagBrowseRange,
    setTagBrowseRange,
    tagHits,
    addKinkTag,
    removeKink,
    updateKink,
    links,
    reloadLinks,
    relationships,
    reloadRelationships,
    hasPhoto,
    photoPreviewUrl,
    photoPendingReview,
    primaryPhotoId,
    photoCaption,
    setPhotoCaption,
    photoDisplaySettings,
    setPhotoDisplaySettings,
    photoMetaSaving,
    handleFileChange,
    handleSave: () => runSerializedSave(),
    discardChanges: () => {
      setZipLocationHint(null)
      setZipCandidates([])
      setZipLocality(null)
      identityHydratedRef.current = false
      photoOnlyReloadRef.current = false
      void profileMe.reload()
    },
    attestationTarget,
    setAttestationTarget,
    onAttestationCompleted,
    profileMe,
    genderSuggestions,
    roleSuggestions,
    sexualSuggestions,
    romanticSuggestions,
  }

  return <ProfileEditContext.Provider value={value}>{children}</ProfileEditContext.Provider>
}
