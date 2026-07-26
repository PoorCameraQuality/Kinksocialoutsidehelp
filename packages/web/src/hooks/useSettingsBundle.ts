import { useCallback, useEffect, useState } from 'react'
import type { UserSettingsBundle } from '@c2k/shared'
import { notificationPreferencesFromMatrix, applyNotificationPreferencesToMatrix, parseProfileFieldVisibility, type ProfileFieldVisibilityLevel } from '@c2k/shared'

export type SettingsLoadState = 'idle' | 'loading' | 'ready' | 'error'

type UseSettingsBundleOptions = {
  enabled: boolean
  viewerUsername: string | null
}

export function useSettingsBundle({ enabled, viewerUsername }: UseSettingsBundleOptions) {
  const [loadState, setLoadState] = useState<SettingsLoadState>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [privacy, setPrivacy] = useState<UserSettingsBundle['privacy'] | null>(null)
  const [notifications, setNotifications] = useState<UserSettingsBundle['notifications'] | null>(null)
  const [feed, setFeed] = useState<UserSettingsBundle['feed'] | null>(null)
  const [hideStoryInput, setHideStoryInput] = useState('')

  const [profSectionLoading, setProfSectionLoading] = useState(true)
  const [profGender, setProfGender] = useState('')
  const [profLocationLabel, setProfLocationLabel] = useState<string | null>(null)
  const [profDisplayName, setProfDisplayName] = useState<string | null>(null)
  const [profDiscoverable, setProfDiscoverable] = useState(true)
  const [profVisibility, setProfVisibility] = useState<'PUBLIC' | 'MEMBERS' | 'PRIVATE'>('MEMBERS')
  const [fvGender, setFvGender] = useState<ProfileFieldVisibilityLevel>('public')
  const [fvAge, setFvAge] = useState<ProfileFieldVisibilityLevel>('public')
  const [fvSexuality, setFvSexuality] = useState<ProfileFieldVisibilityLevel>('public')
  const [fvPronouns, setFvPronouns] = useState<ProfileFieldVisibilityLevel>('public')
  const [fvLocation, setFvLocation] = useState<ProfileFieldVisibilityLevel>('public')
  const [profPrivacySaving, setProfPrivacySaving] = useState(false)
  const [profPrivacyError, setProfPrivacyError] = useState<string | null>(null)
  const [profPrivacySaved, setProfPrivacySaved] = useState(false)
  const [showModerationLink, setShowModerationLink] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const r = await fetch('/api/settings/me', { credentials: 'include' })
      const data = (await r.json()) as { error?: string } & Partial<UserSettingsBundle>
      if (r.status === 401) {
        setLoadState('error')
        setLoadError('Sign in with a registered account to load settings.')
        return
      }
      if (r.status === 503) {
        setLoadState('error')
        setLoadError(data.error ?? 'API database mode is off (USE_DATABASE=true required).')
        return
      }
      if (!r.ok) {
        setLoadState('error')
        setLoadError(typeof data.error === 'string' ? data.error : 'Failed to load settings')
        return
      }
      if (!data.privacy || !data.notifications || !data.feed) {
        setLoadState('error')
        setLoadError('Invalid settings response')
        return
      }
      setPrivacy(data.privacy)
      setNotifications(data.notifications)
      setFeed(data.feed)
      setHideStoryInput(data.feed.hideStoryTypes.join(', '))
      try {
        const prefRes = await fetch('/api/v1/me/notification-preferences', { credentials: 'include' })
        if (prefRes.ok) {
          const prefs = (await prefRes.json()) as {
            orgDigestEmailWeekly?: boolean
            pinnedDigestEmailWeekly?: boolean
            pushHubAnnouncements?: boolean
            pushHubChat?: boolean
          }
          setNotifications(applyNotificationPreferencesToMatrix(data.notifications, prefs))
        }
      } catch {
        /* optional merge */
      }
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setLoadError('Network error')
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoadState('ready')
      return
    }
    void load()
  }, [enabled, load])

  useEffect(() => {
    if (loadState !== 'ready' || !enabled || !viewerUsername) return
    let cancelled = false
    setProfSectionLoading(true)
    void (async () => {
      try {
        const r = await fetch('/api/profile/me', { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setProfSectionLoading(false)
          return
        }
        const data = (await r.json()) as {
          profile?: {
            gender?: string | null
            discoverableInPeopleSearch?: boolean
            fieldVisibility?: unknown
            visibility?: 'PUBLIC' | 'MEMBERS' | 'PRIVATE'
            location?: string | null
            customLocation?: string | null
            displayName?: string | null
          } | null
          customLocation?: string | null
          location?: string | null
          displayName?: string | null
        }
        const p = data.profile
        if (p) {
          setProfGender(p.gender ?? '')
          setProfLocationLabel(p.customLocation ?? data.customLocation ?? p.location ?? data.location ?? null)
          setProfDisplayName(p.displayName ?? data.displayName ?? null)
          setProfDiscoverable(p.discoverableInPeopleSearch !== false)
          if (p.visibility === 'PUBLIC' || p.visibility === 'MEMBERS' || p.visibility === 'PRIVATE') {
            setProfVisibility(p.visibility)
          }
          const m = parseProfileFieldVisibility(p.fieldVisibility)
          setFvGender(m.gender ?? 'public')
          setFvAge(m.age ?? 'public')
          setFvSexuality(m.sexuality ?? 'public')
          setFvPronouns(m.pronouns ?? 'public')
          setFvLocation(m.location ?? 'public')
        }
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setProfSectionLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadState, enabled, viewerUsername])

  const patchProfilePrivacy = useCallback(async (): Promise<string | null> => {
    const r = await fetch('/api/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        discoverableInPeopleSearch: profDiscoverable,
        visibility: profVisibility,
        fieldVisibility: {
          gender: fvGender,
          age: fvAge,
          sexuality: fvSexuality,
          pronouns: fvPronouns,
          location: fvLocation,
        },
      }),
    })
    const data = (await r.json()) as { error?: string }
    if (!r.ok) {
      return typeof data.error === 'string' ? data.error : 'Profile privacy save failed'
    }
    window.dispatchEvent(new Event('c2k:profile-privacy-saved'))
    return null
  }, [profDiscoverable, profVisibility, fvGender, fvAge, fvSexuality, fvPronouns, fvLocation])

  useEffect(() => {
    if (loadState !== 'ready' || !enabled) {
      setShowModerationLink(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/moderation/me', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { moderator?: boolean }
        if (!cancelled && data.moderator) setShowModerationLink(true)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadState, enabled])

  const saveSettings = useCallback(async () => {
    if (!privacy || !notifications || !feed) return
    setSaveError(null)
    setSaving(true)
    setSaved(false)
    try {
      const feedPayload = { ...feed, hideStoryTypes: feed.hideStoryTypes }
      const r = await fetch('/api/settings/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          privacy,
          notifications,
          feed: feedPayload,
        }),
      })
      const data = (await r.json()) as { error?: string } & Partial<UserSettingsBundle>
      if (!r.ok) {
        setSaveError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      if (data.privacy && data.notifications && data.feed) {
        setPrivacy(data.privacy)
        setNotifications(data.notifications)
        setFeed(data.feed)
        setHideStoryInput(data.feed.hideStoryTypes.join(', '))
      }
      try {
        await fetch('/api/v1/me/notification-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(notificationPreferencesFromMatrix(notifications)),
        })
      } catch {
        /* digest/push columns also stored on preferences row */
      }
      const profilePrivacyError = await patchProfilePrivacy()
      if (profilePrivacyError) {
        setSaveError(profilePrivacyError)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }, [privacy, notifications, feed, patchProfilePrivacy])

  const saveProfilePrivacy = useCallback(async () => {
    setProfPrivacyError(null)
    setProfPrivacySaving(true)
    setProfPrivacySaved(false)
    try {
      const error = await patchProfilePrivacy()
      if (error) {
        setProfPrivacyError(error)
        return
      }
      setProfPrivacySaved(true)
      setTimeout(() => setProfPrivacySaved(false), 2000)
    } catch {
      setProfPrivacyError('Network error')
    } finally {
      setProfPrivacySaving(false)
    }
  }, [patchProfilePrivacy])

  const bundleReady = privacy !== null && notifications !== null && feed !== null

  return {
    loadState,
    loadError,
    load,
    saveError,
    saving,
    saved,
    saveSettings,
    privacy,
    setPrivacy,
    notifications,
    setNotifications,
    feed,
    setFeed,
    hideStoryInput,
    setHideStoryInput,
    bundleReady,
    profSectionLoading,
    profGender,
    setProfGender,
    profLocationLabel,
    profDisplayName,
    profDiscoverable,
    setProfDiscoverable,
    profVisibility,
    setProfVisibility,
    fvGender,
    setFvGender,
    fvAge,
    setFvAge,
    fvSexuality,
    setFvSexuality,
    fvPronouns,
    setFvPronouns,
    fvLocation,
    setFvLocation,
    profPrivacySaving,
    profPrivacyError,
    profPrivacySaved,
    saveProfilePrivacy,
    showModerationLink,
  }
}
