'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ALL_PEOPLE_SUB_TABS,
  isPeopleSubTab,
  PEOPLE_SUB_TAB_PARAM,
  type PeopleSubTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { useOrganizerWorkspacePath } from '@/components/dancecard/organizer/organizerWorkspaceContext'

export function usePeopleSubTab(
  eventSlug: string,
  defaultTab: PeopleSubTab = 'signups',
  allowedTabs: PeopleSubTab[] = ALL_PEOPLE_SUB_TABS,
) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = eventSlug.toLowerCase()
  const workspacePath = useOrganizerWorkspacePath(slug)

  const peopleTab: PeopleSubTab = useMemo(() => {
    const raw = searchParams.get(PEOPLE_SUB_TAB_PARAM)
    if (isPeopleSubTab(raw) && allowedTabs.includes(raw)) return raw
    return allowedTabs.includes(defaultTab) ? defaultTab : (allowedTabs[0] ?? 'signups')
  }, [allowedTabs, defaultTab, searchParams])

  const setPeopleTab = useCallback(
    (next: PeopleSubTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'people')
      params.set(PEOPLE_SUB_TAB_PARAM, next)
      const href = `${workspacePath}?${params.toString()}`
      router.replace(href, { scroll: false })
    },
    [router, searchParams, workspacePath],
  )

  return { peopleTab, setPeopleTab, allTabs: allowedTabs }
}
