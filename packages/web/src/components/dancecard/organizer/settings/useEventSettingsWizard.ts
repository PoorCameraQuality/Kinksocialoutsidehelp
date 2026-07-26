'use client'

import { useCallback, useEffect, useState } from 'react'
import { WIZARD_STORAGE_KEY } from '@/components/dancecard/organizer/settings/eventSettingsConfig'

export function useEventSettingsWizard(eventSlug: string) {
  const [wizardDone, setWizardDoneState] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setWizardDoneState(window.localStorage.getItem(WIZARD_STORAGE_KEY(eventSlug)) === '1')
  }, [eventSlug])

  const markWizardDone = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WIZARD_STORAGE_KEY(eventSlug), '1')
    }
    setWizardDoneState(true)
  }, [eventSlug])

  const resetWizard = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(WIZARD_STORAGE_KEY(eventSlug))
    }
    setWizardDoneState(false)
  }, [eventSlug])

  return { wizardDone: wizardDone ?? false, wizardReady: wizardDone !== null, markWizardDone, resetWizard }
}
