/** Reset window scroll — covers Android/Brave quirks where only one of html/body scrolls. */
export function scrollAppToTop(behavior: ScrollBehavior = 'auto'): void {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, left: 0, behavior })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  const main = document.getElementById('main-content')
  if (main && main.scrollTop > 0) main.scrollTop = 0
}

/**
 * Pin scroll at top across the next few frames — mobile browsers often restore
 * scroll position after the first paint even when history.scrollRestoration is manual.
 */
export function pinScrollToTopAfterNavigate(): () => void {
  scrollAppToTop()
  let raf2 = 0
  const raf1 = requestAnimationFrame(() => {
    scrollAppToTop()
    raf2 = requestAnimationFrame(() => scrollAppToTop())
  })
  const t = window.setTimeout(() => scrollAppToTop(), 50)
  return () => {
    cancelAnimationFrame(raf1)
    cancelAnimationFrame(raf2)
    clearTimeout(t)
  }
}

export function disableBrowserScrollRestoration(): void {
  if (typeof window === 'undefined') return
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
}
