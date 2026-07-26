import type { ReactNode } from 'react'

export type QuestionnaireField = {
  id: string
  type: string
  label: string
  required: boolean
  sortOrder: number
  options: unknown
}

const inputClass =
  'mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted-input px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none disabled:opacity-50'

export function renderQuestionInput(
  q: QuestionnaireField,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled: boolean,
): ReactNode {
  if (q.type === 'long_text') {
    return (
      <textarea
        rows={4}
        className={inputClass}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  if (q.type === 'single_choice' || q.type === 'dropdown') {
    const opts = Array.isArray(q.options) ? (q.options as Array<{ id?: string; label?: string } | string>) : []
    return (
      <select
        className={inputClass}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select one</option>
        {opts.map((o, i) => {
          const v = typeof o === 'string' ? o : o.id ?? o.label ?? `option-${i}`
          const label = typeof o === 'string' ? o : o.label ?? v
          return (
            <option key={`${v}-${i}`} value={v}>
              {label}
            </option>
          )
        })}
      </select>
    )
  }
  if (q.type === 'multi_choice') {
    const opts = Array.isArray(q.options) ? (q.options as Array<{ id?: string; label?: string } | string>) : []
    const current = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="mt-1 space-y-2">
        {opts.map((o, i) => {
          const v = typeof o === 'string' ? o : o.id ?? o.label ?? `option-${i}`
          const label = typeof o === 'string' ? o : o.label ?? v
          const checked = current.includes(v)
          return (
            <label key={`${v}-${i}`} className="flex items-center gap-2 text-sm text-dc-text">
              <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked ? [...current, v] : current.filter((x) => x !== v)
                  onChange(next)
                }}
              />
              {label}
            </label>
          )
        })}
      </div>
    )
  }
  if (q.type === 'date') {
    return (
      <input
        type="date"
        className={inputClass}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <input
      type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
      className={inputClass}
      value={typeof value === 'string' ? value : ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
