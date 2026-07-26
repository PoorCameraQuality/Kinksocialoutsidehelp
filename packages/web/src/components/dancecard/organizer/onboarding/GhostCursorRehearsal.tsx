'use client'

import { useState } from 'react'
import { useGuideState } from '@/lib/dancecard/guides/useGuideState'
import { TutorialOverlay } from '@/components/dancecard/onboarding/TutorialOverlay'

const STEPS = [
  {
    title: 'Your public schedule lives here',
    body: 'This grid is where you place classes and activities across the event. Published items show on the attendee Program tab and on each person\'s dancecard when they add them.',
    target: '[data-dc-program-grid]',
  },
  {
    title: 'Block out a time',
    body: 'Click and drag on empty cells to select a time range for a new class.',
    target: '[data-dc-program-grid]',
  },
  {
    title: 'Add the class',
    body: 'Release the mouse to open quick create. Fill in title, room, and track, then save. Attendees only see classes you publish.',
  },
  {
    title: 'Open details',
    body: 'Click a class card to open the side panel for title, room, who is teaching, and who can see it on the public schedule.',
  },
]

export function GhostCursorRehearsal({ eventSlug }: { eventSlug: string }) {
  const { dismissed, dismiss, active } = useGuideState(eventSlug, 'program-rehearsal')
  const [step, setStep] = useState(0)

  if (dismissed || !active) return null

  const s = STEPS[step]
  if (!s) {
    dismiss()
    return null
  }

  return (
    <TutorialOverlay
      open
      step={`Program tour · ${step + 1}/${STEPS.length}`}
      title={s.title}
      body={s.body}
      targetSelector={s.target}
      showGhostHint
      onSkip={dismiss}
      onNext={() => {
        if (step + 1 >= STEPS.length) dismiss()
        else setStep((n) => n + 1)
      }}
      nextLabel={step + 1 >= STEPS.length ? 'Done' : 'Next'}
    />
  )
}
