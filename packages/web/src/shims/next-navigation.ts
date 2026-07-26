import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams as useRouterSearchParams } from 'react-router-dom'

type NavigateOptions = { scroll?: boolean }

/** Drop-in for `next/navigation` useRouter in the Vite app. */
export function useRouter() {
  const navigate = useNavigate()
  return useMemo(
    () => ({
      replace: (href: string, _opts?: NavigateOptions) => {
        navigate(href, { replace: true })
      },
      push: (href: string, _opts?: NavigateOptions) => {
        navigate(href)
      },
      refresh: () => {
        navigate(0)
      },
    }),
    [navigate],
  )
}

/** Returns URLSearchParams (read-only usage matches Next app code). */
export function useSearchParams() {
  const [params] = useRouterSearchParams()
  return params
}

export function usePathname() {
  return useLocation().pathname
}

/** Optional setter matching react-router when panels need programmatic updates. */
export function useSearchParamsState() {
  return useRouterSearchParams()
}
