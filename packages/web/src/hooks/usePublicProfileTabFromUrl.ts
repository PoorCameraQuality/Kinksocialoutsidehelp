import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_PUBLIC_PROFILE_TAB,
  resolveCommunitySection,
  resolvePublicProfileTab,
  type CommunitySection,
  type PublicProfileTab,
} from '@/lib/public-profile-tabs'

export function usePublicProfileTabFromUrl(
  defaultTab: PublicProfileTab = DEFAULT_PUBLIC_PROFILE_TAB,
): [PublicProfileTab, (tab: PublicProfileTab) => void, CommunitySection] {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const sectionParam = searchParams.get('section')
  const [activeTab, setActiveTab] = useState<PublicProfileTab>(() =>
    resolvePublicProfileTab(tabParam, defaultTab),
  )

  const communitySection = useMemo(
    () => resolveCommunitySection(tabParam, sectionParam),
    [tabParam, sectionParam],
  )

  useEffect(() => {
    setActiveTab(resolvePublicProfileTab(tabParam, defaultTab))
  }, [tabParam, defaultTab])

  return [activeTab, setActiveTab, communitySection]
}
