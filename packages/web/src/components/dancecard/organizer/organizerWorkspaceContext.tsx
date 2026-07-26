'use client'

import { createContext, useContext, type ReactNode } from 'react'
import {
  PEOPLE_SUB_TAB_PARAM,
  type OrganizerTab,
  type PeopleSubTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'

type OrganizerWorkspaceContextValue = {
  /** Path without query string, e.g. `/organizer/orgs/acme/conventions/paf26`. */
  basePath: string
}

const Ctx = createContext<OrganizerWorkspaceContextValue | null>(null)

export function OrganizerWorkspaceProvider({
  basePath,
  children,
}: {
  basePath: string
  children: ReactNode
}) {
  return <Ctx.Provider value={{ basePath }}>{children}</Ctx.Provider>
}

/** Workspace base from context, or `/organizer/conventions/:slug` redirect path. */
export function useOrganizerWorkspaceBase(): string | null {
  return useContext(Ctx)?.basePath ?? null
}

export function useOrganizerWorkspacePath(_eventSlug?: string): string {
  const ctx = useContext(Ctx)
  if (ctx?.basePath) return ctx.basePath
  const slug = (_eventSlug ?? '').toLowerCase()
  return slug ? `/organizer/conventions/${encodeURIComponent(slug)}` : '/organizer/conventions'
}

export const VETTING_ROLE_PARAM = 'vettingRoleId'
export const VETTING_APPLICATION_PARAM = 'applicationId'
export const PERSON_PARAM = 'person'
export const REGISTRANT_PARAM = 'registrant'

export function organizerTabHref(
  workspaceBase: string,
  tab: OrganizerTab,
  opts?: {
    peopleTab?: PeopleSubTab
    settingsPanel?: string
    slot?: string
    publishFilter?: string
    vettingRoleId?: string
    applicationId?: string
    personId?: string
    registrantId?: string
  },
): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (opts?.peopleTab) params.set(PEOPLE_SUB_TAB_PARAM, opts.peopleTab)
  if (opts?.settingsPanel) params.set('settingsPanel', opts.settingsPanel)
  if (opts?.slot) params.set('slot', opts.slot)
  if (opts?.publishFilter) params.set('publishFilter', opts.publishFilter)
  if (opts?.vettingRoleId) params.set(VETTING_ROLE_PARAM, opts.vettingRoleId)
  if (opts?.applicationId) params.set(VETTING_APPLICATION_PARAM, opts.applicationId)
  if (opts?.personId) params.set(PERSON_PARAM, opts.personId)
  if (opts?.registrantId) params.set(REGISTRANT_PARAM, opts.registrantId)
  return `${workspaceBase}?${params.toString()}`
}

export function useOrganizerTabHref(
  tab: OrganizerTab,
  opts?: {
    peopleTab?: PeopleSubTab
    settingsPanel?: string
    slot?: string
    publishFilter?: string
    vettingRoleId?: string
    applicationId?: string
    personId?: string
    registrantId?: string
  },
): string {
  const base = useOrganizerWorkspacePath()
  return organizerTabHref(base, tab, opts)
}

export function useOrganizerSubPath(suffix: string): string {
  const base = useOrganizerWorkspacePath()
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${base}${path}`
}
