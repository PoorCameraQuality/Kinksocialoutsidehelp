'use client'

import { useId, useRef } from 'react'
import {
  SETTINGS_FIELD_CLASS,
  SETTINGS_LABEL_CLASS,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'

const INPUT_CLASS =
  'dc-datetime-local-input dc-field-input w-full cursor-pointer rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 pr-11 text-sm text-dc-text hover:border-dc-accent-border focus:border-dc-accent-border focus:outline-none focus:ring-1 focus:ring-dc-accent-border/40 disabled:cursor-not-allowed disabled:opacity-50'

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function openPicker(input: HTMLInputElement | null) {
  if (!input || input.disabled) return
  try {
    input.showPicker?.()
  } catch {
    input.focus()
  }
}

export function DatetimeLocalField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  className,
  variant = 'default',
  hint = 'Click the calendar icon or field to pick date and time.',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'settings'
  hint?: string
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const isSettings = variant === 'settings'
  const labelClass = isSettings ? SETTINGS_LABEL_CLASS : 'block text-xs text-dc-muted'
  const inputClass = isSettings ? `${SETTINGS_FIELD_CLASS} dc-datetime-local-input !pr-11` : INPUT_CLASS

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {isSettings ? (
          <>
            {label}
            {!disabled ? (
              <span className="mt-0.5 block text-[10px] font-semibold normal-case tracking-normal text-dc-accent">
                Click calendar to pick
              </span>
            ) : null}
          </>
        ) : (
          <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span>{label}</span>
            {!disabled ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
                Click to pick
              </span>
            ) : null}
          </span>
        )}
      </label>
      <div
        className="relative mt-1"
        onClick={() => openPicker(inputRef.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker(inputRef.current)
          }
        }}
        role="presentation"
      >
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          className={inputClass}
          value={value}
          disabled={disabled}
          title={disabled ? undefined : 'Open date and time picker'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onClick={(e) => {
            e.stopPropagation()
            openPicker(e.currentTarget)
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-dc-accent transition-colors hover:bg-dc-accent-muted hover:text-dc-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dc-accent-border disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Open date and time picker for ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            openPicker(inputRef.current)
          }}
        >
          <CalendarIcon className="h-5 w-5 text-dc-accent" />
        </button>
      </div>
      {!disabled && hint ? (
        <p
          className={
            isSettings
              ? 'mt-1 text-xs font-normal normal-case text-dc-muted'
              : 'mt-1 text-[10px] leading-snug text-dc-muted'
          }
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
