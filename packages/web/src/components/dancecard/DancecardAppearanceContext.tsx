'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import '@/styles/site-atmosphere.css'
import {
  DANCECARD_APPEARANCE_PRESETS,
  DEFAULT_DANCECARD_APPEARANCE,
  getAppearancePreset,
  appearanceVarsToStyle,
  applyAppearanceVarsToElement,
  type DancecardAppearanceId,
  type DancecardAppearancePreset,
} from '@/lib/dancecard/appearancePresets'

export type { DancecardAppearancePreset }
import {
  readStoredAppearance,
  writeStoredAppearance,
} from '@/lib/dancecard/appearancePreference'

type DancecardAppearanceContextValue = {
  appearanceId: DancecardAppearanceId
  preset: DancecardAppearancePreset
  presets: readonly DancecardAppearancePreset[]
  setAppearanceId: (id: DancecardAppearanceId) => void
  appearanceStyle: Record<string, string>
  isDark: boolean
  appearanceReady: boolean
}

const DancecardAppearanceContext = createContext<DancecardAppearanceContextValue | null>(null)

export function useDancecardAppearance(): DancecardAppearanceContextValue {
  const ctx = useContext(DancecardAppearanceContext)
  if (!ctx) {
    const preset = getAppearancePreset(DEFAULT_DANCECARD_APPEARANCE)
    return {
      appearanceId: DEFAULT_DANCECARD_APPEARANCE,
      preset,
      presets: DANCECARD_APPEARANCE_PRESETS,
      setAppearanceId: () => {},
      appearanceStyle: appearanceVarsToStyle(preset.vars, preset.mode),
      isDark: preset.mode === 'dark',
      appearanceReady: false,
    }
  }
  return ctx
}

type ProviderProps = {
  children: ReactNode
  className?: string
  chromeClassName?: string
  wrapChrome?: boolean
  /** When localStorage has no saved theme, use this preset (defaults to midnight-velvet sitewide). */
  defaultAppearanceId?: DancecardAppearanceId
  /** Subset for theme pickers (member site uses three comfort themes). */
  presets?: readonly DancecardAppearancePreset[]
}

export function DancecardAppearanceProvider({
  children,
  className = '',
  chromeClassName = '',
  wrapChrome = true,
  defaultAppearanceId = DEFAULT_DANCECARD_APPEARANCE,
  presets: presetsProp,
}: ProviderProps) {
  const availablePresets = presetsProp ?? DANCECARD_APPEARANCE_PRESETS
  const [appearanceId, setAppearanceIdState] = useState<DancecardAppearanceId>(() =>
    readStoredAppearance(defaultAppearanceId),
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setAppearanceIdState(readStoredAppearance(defaultAppearanceId))
    setHydrated(true)
  }, [defaultAppearanceId])

  const setAppearanceId = useCallback((id: DancecardAppearanceId) => {
    setAppearanceIdState(id)
    writeStoredAppearance(id)
  }, [])

  const preset = useMemo(() => getAppearancePreset(appearanceId), [appearanceId])
  const appearanceStyle = useMemo(() => appearanceVarsToStyle(preset.vars, preset.mode), [preset])

  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    root.setAttribute('data-dc-appearance', appearanceId)
    root.dataset.dcTheme = 'event'
    root.style.colorScheme = preset.mode
    const clearVars = applyAppearanceVarsToElement(root, preset.vars)
    return () => {
      clearVars()
      root.removeAttribute('data-dc-appearance')
      delete root.dataset.dcTheme
      root.style.removeProperty('color-scheme')
    }
  }, [hydrated, appearanceId, preset])

  const value = useMemo<DancecardAppearanceContextValue>(
    () => ({
      appearanceId,
      preset,
      presets: availablePresets,
      setAppearanceId,
      appearanceStyle,
      isDark: preset.mode === 'dark',
      appearanceReady: hydrated,
    }),
    [appearanceId, preset, availablePresets, setAppearanceId, appearanceStyle, hydrated],
  )

  const chromeProps = {
    className: `dc-gold-chrome site-atmosphere min-h-screen bg-dc-surface text-dc-text ${chromeClassName} ${className}`.trim(),
    'data-dc-theme': 'event' as const,
    'data-dc-appearance': appearanceId,
    style: hydrated ? appearanceStyle : undefined,
    suppressHydrationWarning: true as const,
  }

  const showSiteAtmosphere = wrapChrome

  return (
    <DancecardAppearanceContext.Provider value={value}>
      {wrapChrome ?
        <div {...chromeProps}>
          {showSiteAtmosphere ?
            <>
              <div className="site-atmosphere__layer site-atmosphere__base" aria-hidden />
              <div className="site-atmosphere__orb site-atmosphere__orb--primary" aria-hidden />
              <div className="site-atmosphere__orb site-atmosphere__orb--secondary" aria-hidden />
              <div className="site-atmosphere__orb site-atmosphere__orb--tertiary" aria-hidden />
              <div className="site-atmosphere__layer site-atmosphere__noise" aria-hidden />
            </>
          : null}
          <div className="site-atmosphere__content">{children}</div>
        </div>
      : children}
    </DancecardAppearanceContext.Provider>
  )
}
