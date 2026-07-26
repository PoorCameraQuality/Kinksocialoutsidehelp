'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { CommandContext } from './commandRegistry'

const Ctx = createContext<CommandContext | null>(null)

export function OrganizerCommandProvider({ value, children }: { value: CommandContext | null; children: ReactNode }) {
  const memo = useMemo(() => value, [value])
  return <Ctx.Provider value={memo}>{children}</Ctx.Provider>
}

export function useOrganizerCommandContext() {
  return useContext(Ctx)
}
