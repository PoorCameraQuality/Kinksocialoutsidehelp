import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

type ButtonProps = {
  as?: 'button'
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

type LinkControlProps = {
  as: 'link'
  to: LinkProps['to']
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

type CommonProps = {
  className?: string
  children: ReactNode
  title?: string
  'aria-label'?: string
  'aria-pressed'?: boolean
  ringOnTap?: boolean
}

export type FeedTapControlProps = CommonProps & (ButtonProps | LinkControlProps)

export default function FeedTapControl(props: FeedTapControlProps) {
  const { className, children, ringOnTap = false, title, 'aria-label': ariaLabel, 'aria-pressed': ariaPressed } = props
  const [popping, setPopping] = useState(false)

  useEffect(() => {
    if (!popping) return
    const id = window.setTimeout(() => setPopping(false), 420)
    return () => window.clearTimeout(id)
  }, [popping])

  const triggerPop = () => {
    if (props.as === 'button' && props.disabled) return
    setPopping(true)
  }

  const surfaceClass = cn(
    'feed-tap-control',
    popping && 'feed-tap-pop',
    ringOnTap && popping && 'feed-reaction-ring',
    className,
  )

  if (props.as === 'link') {
    return (
      <Link
        to={props.to}
        className={surfaceClass}
        title={title}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        onClick={(event) => {
          triggerPop()
          props.onClick?.(event)
        }}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled}
      className={surfaceClass}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={(event) => {
        triggerPop()
        props.onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}
