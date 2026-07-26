import { useCallback, useEffect, useState } from 'react'
import type { FeedSettings, PrivacySettings, UserSettingsBundle } from '@c2k/shared'
import { defaultFeedSettings, defaultPrivacySettings, mergePrivacySettings } from '@c2k/shared'
import { persistOnboardingSettings } from '@/lib/onboarding'

export function useOnboardingState(enabled: boolean) {
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedSettings>(defaultFeedSettings)
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacySettings)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/settings/me', { credentials: 'include' })
      if (!r.ok) {
        setError(r.status === 401 ? 'Sign in to continue onboarding.' : 'Could not load your settings.')
        return
      }
      const data = (await r.json()) as Partial<UserSettingsBundle>
      if (data.feed) setFeed(data.feed)
      if (data.privacy) setPrivacy(data.privacy)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: { feed?: Partial<FeedSettings>; privacy?: Partial<PrivacySettings> }) => {
      const nextFeed = patch.feed ? { ...feed, ...patch.feed } : feed
      const nextPrivacy = patch.privacy ? mergePrivacySettings(privacy, patch.privacy) : privacy
      setSaving(true)
      setError(null)
      const ok = await persistOnboardingSettings({ feed: nextFeed, privacy: nextPrivacy })
      if (ok) {
        setFeed(nextFeed)
        setPrivacy(nextPrivacy)
      } else {
        setError('Could not save progress. Try again.')
      }
      setSaving(false)
      return ok
    },
    [feed, privacy]
  )

  return { loading, error, feed, privacy, setPrivacy, saving, save, reload: load }
}
