import { describe, expect, test } from 'vitest'
import { detectBrowserEnvironment, inAppBrowserLabel } from './browser-environment.js'

describe('detectBrowserEnvironment', () => {
  test('detects Messenger in-app browser', () => {
    const env = detectBrowserEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAN/Messenger.123',
    )
    expect(env.inApp).toBe('messenger')
    expect(env.isEmbeddedWebView).toBe(true)
    expect(env.documentClassNames).toContain('browser-in-app')
    expect(env.documentClassNames).toContain('browser-in-app-messenger')
  })

  test('detects Samsung Internet', () => {
    const env = detectBrowserEnvironment(
      'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    )
    expect(env.isSamsungInternet).toBe(true)
    expect(env.documentClassNames).toContain('browser-samsung')
    expect(env.inApp).toBeNull()
  })

  test('detects iOS Safari as non in-app', () => {
    const env = detectBrowserEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    expect(env.isIosSafari).toBe(true)
    expect(env.inApp).toBeNull()
  })
})

describe('inAppBrowserLabel', () => {
  test('maps kinds to labels', () => {
    expect(inAppBrowserLabel('messenger')).toBe('Messenger')
    expect(inAppBrowserLabel(null)).toBeNull()
  })
})
