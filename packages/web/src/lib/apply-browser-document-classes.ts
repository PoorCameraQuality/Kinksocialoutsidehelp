import { detectBrowserEnvironment, type BrowserEnvironment } from './browser-environment.js'

/** Apply stable `browser-*` classes on `<html>` for CSS compatibility hooks. */
export function applyBrowserDocumentClasses(root: HTMLElement = document.documentElement): BrowserEnvironment {
  const env = detectBrowserEnvironment()
  for (const cls of env.documentClassNames) {
    root.classList.add(cls)
  }
  root.dataset.c2kPlatform = env.platform
  if (env.inApp) root.dataset.c2kInApp = env.inApp
  return env
}
