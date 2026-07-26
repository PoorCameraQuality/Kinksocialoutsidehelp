'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const panelClass =
  'rounded-2xl border border-dc-border-strong bg-dc-elevated-solid p-5 shadow-[0_16px_48px_rgba(45,38,28,0.18)] sm:p-6'

export function OrganizerConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-dc-confirm flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-dc-text/40 backdrop-blur-sm"
        aria-label="Cancel"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        className={`relative z-10 w-full max-w-md ${panelClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-confirm-title"
      >
        <h2 id="organizer-confirm-title" className="font-serif text-xl text-dc-text">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-dc-muted">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-dc-border bg-dc-surface px-4 py-2 text-sm text-dc-muted hover:bg-[#1a2332]"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className={
              destructive
                ? 'rounded-lg bg-dc-danger px-4 py-2 text-sm font-semibold text-dc-text hover:opacity-90 disabled:opacity-50'
                : 'rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50'
            }
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
