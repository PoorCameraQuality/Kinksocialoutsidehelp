import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** Logged-out landing search - visible below header on small screens only. */
export default function LandingMobileSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const submit = useCallback(() => {
    const q = query.trim()
    navigate(q ? `/discovery?q=${encodeURIComponent(q)}` : '/discovery')
  }, [navigate, query])

  return (
    <div className="border-b border-dc-border/80 bg-dc-elevated/90 px-4 py-3 md:hidden">
      <label className="sr-only" htmlFor="landing-mobile-search">
        Search events, groups, presenters
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dc-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="landing-mobile-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Search events, groups, presenters…"
          className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
        />
      </div>
    </div>
  )
}
