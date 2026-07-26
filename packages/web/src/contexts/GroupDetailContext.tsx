import { createContext, useContext, type ReactNode } from 'react'
import type { MockGroup } from '@/data/mock-data'
import type { GroupRole } from '@/data/mock-data'

export interface GroupDetailContextValue {
  group: MockGroup
  viewerRole: GroupRole | undefined
  canManage: boolean
  canModerate: boolean
  isMember: boolean
  refreshPhotos: () => void
  refreshChannels: () => void
  refreshResources: () => void
  refreshMembers: () => void
}

const GroupDetailContext = createContext<GroupDetailContextValue | null>(null)

export function GroupDetailProvider({
  value,
  children,
}: {
  value: GroupDetailContextValue
  children: ReactNode
}) {
  return (
    <GroupDetailContext.Provider value={value}>
      {children}
    </GroupDetailContext.Provider>
  )
}

export function useGroupDetailContext(): GroupDetailContextValue {
  const ctx = useContext(GroupDetailContext)
  if (!ctx) {
    throw new Error('useGroupDetailContext must be used within GroupDetailProvider')
  }
  return ctx
}
