/** Parsed mobile / in-app browser context for CSS hooks and UX nudges. */

export type InAppBrowserKind =
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'generic'

export type BrowserPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

export type BrowserEnvironment = {
  userAgent: string
  platform: BrowserPlatform
  inApp: InAppBrowserKind | null
  isSamsungInternet: boolean
  isIosSafari: boolean
  isAndroidChrome: boolean
  /** True for Messenger, Instagram, Facebook, etc. */
  isEmbeddedWebView: boolean
  documentClassNames: string[]
}

const IN_APP_PATTERNS: Array<{ kind: InAppBrowserKind; test: RegExp }> = [
  { kind: 'messenger', test: /\bFBAN\/Messenger\b/i },
  { kind: 'messenger', test: /\bMessenger\b/i },
  { kind: 'facebook', test: /\bFBAN\b/i },
  { kind: 'facebook', test: /\bFBAV\b/i },
  { kind: 'instagram', test: /\bInstagram\b/i },
  { kind: 'twitter', test: /\bTwitter\b/i },
  { kind: 'linkedin', test: /\bLinkedInApp\b/i },
  { kind: 'tiktok', test: /\bTikTok\b/i },
  { kind: 'generic', test: /\bLine\/\d/i },
  { kind: 'generic', test: /\bGSA\/\d/i },
]

function detectPlatform(ua: string): BrowserPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux/i.test(ua) && !/Mobile/i.test(ua)) return 'desktop'
  return 'unknown'
}

function detectInApp(ua: string): InAppBrowserKind | null {
  for (const { kind, test } of IN_APP_PATTERNS) {
    if (test.test(ua)) return kind
  }
  // WebView heuristic: Android without Chrome token, or wv)
  if (/Android/i.test(ua) && /\bwv\b/i.test(ua)) return 'generic'
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return 'generic'
  return null
}

export function detectBrowserEnvironment(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): BrowserEnvironment {
  const ua = userAgent.trim()
  const platform = detectPlatform(ua)
  const inApp = detectInApp(ua)
  const isSamsungInternet = /SamsungBrowser/i.test(ua)
  const isIosSafari = platform === 'ios' && /Safari/i.test(ua) && !inApp
  const isAndroidChrome = platform === 'android' && /Chrome/i.test(ua) && !inApp
  const isEmbeddedWebView = inApp !== null

  const documentClassNames: string[] = ['browser-env-ready']
  if (platform === 'ios') documentClassNames.push('browser-ios')
  if (platform === 'android') documentClassNames.push('browser-android')
  if (platform === 'desktop') documentClassNames.push('browser-desktop')
  if (isSamsungInternet) documentClassNames.push('browser-samsung')
  if (isIosSafari) documentClassNames.push('browser-ios-safari')
  if (isAndroidChrome) documentClassNames.push('browser-android-chrome')
  if (isEmbeddedWebView) documentClassNames.push('browser-in-app')
  if (inApp) documentClassNames.push(`browser-in-app-${inApp}`)

  return {
    userAgent: ua,
    platform,
    inApp,
    isSamsungInternet,
    isIosSafari,
    isAndroidChrome,
    isEmbeddedWebView,
    documentClassNames,
  }
}

export function inAppBrowserLabel(kind: InAppBrowserKind | null): string | null {
  switch (kind) {
    case 'facebook':
      return 'Facebook'
    case 'messenger':
      return 'Messenger'
    case 'instagram':
      return 'Instagram'
    case 'twitter':
      return 'X / Twitter'
    case 'linkedin':
      return 'LinkedIn'
    case 'tiktok':
      return 'TikTok'
    case 'generic':
      return 'this app'
    default:
      return null
  }
}

export const IN_APP_BROWSER_BANNER_DISMISS_KEY = 'c2k:in-app-browser-banner-dismissed'
