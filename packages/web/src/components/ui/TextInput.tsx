import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement>

const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]',
        className,
      )}
      {...props}
    />
  )
})

export default TextInput
