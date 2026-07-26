/** Feed interaction iconography - reactions (Love, Respect, Sympathize, Helpful) and community actions. */

type IconProps = { className?: string; strokeWidth?: number }

const base = (className: string) => `inline-block shrink-0 ${className}`.trim()

export function IconLove({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20.5s-6.5-4.2-8.5-8.2C2.2 9.2 3.6 6 6.8 6c1.7 0 3.2.9 4 2.2.8-1.3 2.3-2.2 4-2.2 3.2 0 4.6 3.2 3.3 6.3-2 4-8.5 8.2-8.5 8.2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRespect({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 17l3.5-9h7L19 17H5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M8.5 12h7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

export function IconSympathize({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4v1.5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 11.5V10Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path d="M12 14v2.5M9.5 19h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

export function IconHelpful({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 8.5 12 4l4 4.5M8 15.5 12 20l4-4.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 4v16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

export function IconRepost({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 14v-2.5c0-2.5 2-4.5 4.5-4.5h1.2M19 10v2.5c0 2.5-2 4.5-4.5 4.5H13.3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path d="M9 8 5 10v4l4 2M15 16l4-2v-4l-4-2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  )
}

export function IconShare({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h13M13 8l5 4-5 4"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 6v2.5a2.5 2.5 0 0 1-2.5 2.5H16"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconDiscuss({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8.5h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H10l-4 3v-3.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 15h4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

export function IconFlagSubtle({ className = 'h-4 w-4', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg className={base(className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 20V5.5M6 5.5h9.5l-1.5 3 1.5 3H6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
