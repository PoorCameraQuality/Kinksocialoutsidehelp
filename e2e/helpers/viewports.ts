export const VIEWPORTS = {
  mobileSmall: { width: 360, height: 800 },
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
  mobileLarge: { width: 430, height: 932 },
} as const

export type ViewportName = keyof typeof VIEWPORTS
