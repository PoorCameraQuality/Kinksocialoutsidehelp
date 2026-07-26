import type { ReactNode } from 'react'

type Props = {
  open?: boolean
  step?: string
  title?: string
  body?: string
  targetSelector?: string
  showGhostHint?: boolean
  onSkip?: () => void
  onNext?: () => void
  nextLabel?: string
  children?: ReactNode
}

/** Tutorial overlay - stub until Kink Social wires full onboarding UI. */
export function TutorialOverlay(_props: Props) {
  return null
}
