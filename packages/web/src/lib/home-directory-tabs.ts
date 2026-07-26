import { browseHref, type HomeTab } from '@/lib/community-nav'

/** Home discover tabs that redirect to standalone directory routes (UI-DISC-3). */
export const STANDALONE_DIRECTORY_TABS: readonly HomeTab[] = [
  'Events',
  'Conventions',
  'Groups',
  'Vendors',
  'Education',
  'Media',
] as const

export function isStandaloneDirectoryTab(tab: HomeTab): boolean {
  return (STANDALONE_DIRECTORY_TABS as readonly string[]).includes(tab)
}

export function standaloneDirectoryHref(tab: HomeTab): string {
  return browseHref(tab)
}
