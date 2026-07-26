import { useCallback, useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type Pending = {
  title: string
  description?: string
  destructive?: boolean
  confirmLabel?: string
  resolve: (ok: boolean) => void
}

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (title: string, description?: string, opts?: { destructive?: boolean; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) => {
        setPending({
          title,
          description,
          destructive: opts?.destructive,
          confirmLabel: opts?.confirmLabel,
          resolve,
        })
      }),
    [],
  )

  const confirmDialog = pending ?
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      destructive={pending.destructive}
      confirmLabel={pending.confirmLabel ?? (pending.destructive ? 'Delete' : 'Confirm')}
      onConfirm={() => {
        pending.resolve(true)
        setPending(null)
      }}
      onCancel={() => {
        pending.resolve(false)
        setPending(null)
      }}
    />
  : null

  return { confirm, confirmDialog }
}
