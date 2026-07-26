import { useState } from 'react'
import { cn } from '@/lib/cn'
import { premiumInputClass } from '@/lib/card-surface'

type PasswordFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  className?: string
  inputClassName?: string
}

export default function PasswordField({
  id,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder,
  className,
  inputClassName,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(premiumInputClass, 'min-h-11 w-full pr-11', inputClassName)}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 inline-flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-lg text-dc-muted"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ?
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 3.029a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        : <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        }
      </button>
    </div>
  )
}
