import type { ReactNode } from 'react'
import { DancecardAppearanceProvider } from '@/components/dancecard/DancecardAppearanceContext'
import { AppToastProvider } from '@/components/ui/AppToast'
import { AuthProvider } from '@/contexts/AuthContext'
import {
  DEFAULT_DANCECARD_APPEARANCE,
  MEMBER_DANCECARD_APPEARANCE_PRESETS,
} from '@/lib/dancecard/appearancePresets'

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DancecardAppearanceProvider
      defaultAppearanceId={DEFAULT_DANCECARD_APPEARANCE}
      presets={MEMBER_DANCECARD_APPEARANCE_PRESETS}
    >
      <AuthProvider>
        <AppToastProvider>{children}</AppToastProvider>
      </AuthProvider>
    </DancecardAppearanceProvider>
  )
}
