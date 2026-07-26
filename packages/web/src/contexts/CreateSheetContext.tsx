import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type CreateSheetContextValue = {
  open: boolean
  openCreateSheet: () => void
  closeCreateSheet: () => void
}

const CreateSheetContext = createContext<CreateSheetContextValue | null>(null)

export function CreateSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openCreateSheet = useCallback(() => setOpen(true), [])
  const closeCreateSheet = useCallback(() => setOpen(false), [])
  const value = useMemo(
    () => ({ open, openCreateSheet, closeCreateSheet }),
    [open, openCreateSheet, closeCreateSheet],
  )
  return <CreateSheetContext.Provider value={value}>{children}</CreateSheetContext.Provider>
}

export function useCreateSheet() {
  const ctx = useContext(CreateSheetContext)
  if (!ctx) throw new Error('useCreateSheet must be used within CreateSheetProvider')
  return ctx
}
