import {
  VENDOR_CATEGORY_DESCRIPTIONS,
  VENDOR_CATEGORY_SELECT_MAX,
  VENDOR_CATEGORY_VALUES,
  type VendorCategory,
} from '@c2k/shared'
import { cn } from '@/lib/cn'
import { fieldErrorClass } from '@/lib/api-errors'

type Props = {
  selected: VendorCategory[]
  onChange: (next: VendorCategory[]) => void
  error?: string | null
  variant?: 'chips' | 'cards'
  id?: string
}

export function toggleVendorCategory(selected: VendorCategory[], cat: VendorCategory): VendorCategory[] {
  if (selected.includes(cat)) return selected.filter((c) => c !== cat)
  if (selected.length >= VENDOR_CATEGORY_SELECT_MAX) return selected
  return [...selected, cat]
}

export default function VendorCategoryPicker({
  selected,
  onChange,
  error,
  variant = 'chips',
  id = 'vendor-categories',
}: Props) {
  const atCap = selected.length >= VENDOR_CATEGORY_SELECT_MAX

  if (variant === 'cards') {
    return (
      <div id={id} role="group" aria-labelledby={`${id}-label`} aria-invalid={error ? true : undefined}>
        <p id={`${id}-label`} className="text-sm font-medium text-dc-text">
          Shop categories
        </p>
        <p className="mt-1 text-xs text-dc-text-muted">
          Choose up to {VENDOR_CATEGORY_SELECT_MAX} categories that describe your shop.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {VENDOR_CATEGORY_VALUES.map((cat) => {
            const isSelected = selected.includes(cat)
            const disabled = !isSelected && atCap
            return (
              <button
                key={cat}
                type="button"
                title={VENDOR_CATEGORY_DESCRIPTIONS[cat]}
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => onChange(toggleVendorCategory(selected, cat))}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  isSelected ?
                    'border-dc-accent bg-dc-accent/15 text-dc-accent'
                  : 'border-dc-border text-dc-text-muted hover:text-dc-text',
                  disabled && 'opacity-50 cursor-not-allowed',
                  error && !isSelected && fieldErrorClass(true),
                )}
              >
                <span className="font-medium">{cat}</span>
                <span className="mt-0.5 block text-xs opacity-80">{VENDOR_CATEGORY_DESCRIPTIONS[cat]}</span>
              </button>
            )
          })}
        </div>
        {error ? (
          <p className="mt-2 text-xs text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div id={id} role="group" aria-labelledby={`${id}-label`} aria-invalid={error ? true : undefined}>
      <p id={`${id}-label`} className="text-xs text-dc-muted mb-1">
        Shop categories <span className="text-dc-text-muted">(up to {VENDOR_CATEGORY_SELECT_MAX})</span>
      </p>
      <div className={cn('flex flex-wrap gap-2', error && 'rounded-lg ring-1 ring-red-500/40 p-1')}>
        {VENDOR_CATEGORY_VALUES.map((cat) => {
          const isSelected = selected.includes(cat)
          const disabled = !isSelected && atCap
          return (
            <button
              key={cat}
              type="button"
              title={VENDOR_CATEGORY_DESCRIPTIONS[cat]}
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(toggleVendorCategory(selected, cat))}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs border',
                isSelected ?
                  'border-dc-accent bg-dc-accent/15 text-dc-accent'
                : 'border-dc-border text-dc-text-muted',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {cat}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
