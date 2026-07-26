'use client'

import { useCallback, useRef, useState } from 'react'
import { OrganizerConfirmDialog } from './OrganizerConfirmDialog'

type ConfirmConfig = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<ConfirmConfig | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const ask = useCallback((config: ConfirmConfig) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setCfg(config)
      setOpen(true)
    })
  }, [])

  const finish = useCallback((ok: boolean) => {
    setOpen(false)
    resolveRef.current?.(ok)
    resolveRef.current = null
  }, [])

  const dialog = (
    <OrganizerConfirmDialog
      open={open && cfg !== null}
      title={cfg?.title ?? ''}
      message={cfg?.message ?? ''}
      confirmLabel={cfg?.confirmLabel}
      destructive={cfg?.destructive}
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  )

  return { ask, dialog }
}
