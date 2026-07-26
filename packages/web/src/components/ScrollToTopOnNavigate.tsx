import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigation } from 'react-router-dom'
import { pinScrollToTopAfterNavigate } from '@/lib/scroll-app-to-top'

/** Reset window scroll on route changes — React Router does not do this by default. */
export default function ScrollToTopOnNavigate() {
  const { pathname, search, hash } = useLocation()
  const navigation = useNavigation()
  const lastScrolledKey = useRef<string | null>(null)
  const routeKey = `${pathname}${search}${hash}`

  useLayoutEffect(() => {
    if (hash) return
    if (navigation.state === 'loading') return
    if (lastScrolledKey.current === routeKey) return
    lastScrolledKey.current = routeKey
    return pinScrollToTopAfterNavigate()
  }, [routeKey, hash, navigation.state])

  return null
}
