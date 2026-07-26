import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MOCK_VIEWER_USERNAME } from '@c2k/shared'

type SessionJson = {
  authenticated: boolean
  username: string | null
  fallback: boolean
  userId?: string | null
  email?: string | null
  displayName?: string | null
}

export type AuthContextValue = {
  /** Session fetch finished */
  status: 'loading' | 'ready'
  /** Resolved viewer username for mock actions (may be empty if strict unauthenticated). */
  viewerUsername: string
  /** True when valid session cookie exists */
  isAuthenticated: boolean
  /** Database user id when authenticated with USE_DATABASE (JWT sub) */
  viewerUserId: string | null
  /** True when using unauthenticated fallback viewer (see NEXT_PUBLIC_AUTH_ALLOW_FALLBACK) */
  isFallback: boolean
  /** Profile scene name from API session when USE_DATABASE (may be null). */
  viewerDisplayName: string | null
  /** Account email from API session when USE_DATABASE (may be null). */
  viewerEmail: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [viewerUsername, setViewerUsername] = useState(MOCK_VIEWER_USERNAME)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(true)
  const [viewerDisplayName, setViewerDisplayName] = useState<string | null>(null)
  const [viewerEmail, setViewerEmail] = useState<string | null>(null)

  const applySession = useCallback((data: SessionJson) => {
    setIsAuthenticated(!!data.authenticated)
    setIsFallback(!!data.fallback)
    setViewerUserId(
      data.authenticated && typeof data.userId === 'string' && data.userId.length > 0 ? data.userId : null,
    )
    setViewerDisplayName(typeof data.displayName === 'string' && data.displayName.length > 0 ? data.displayName : null)
    setViewerEmail(typeof data.email === 'string' && data.email.length > 0 ? data.email : null)
    if (typeof data.username === 'string' && data.username.length > 0) {
      setViewerUsername(data.username)
    } else if (data.fallback) {
      setViewerUsername(MOCK_VIEWER_USERNAME)
    } else {
      setViewerUsername('')
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/session', { credentials: 'same-origin' })
      if (!r.ok && r.status >= 500) {
        // API blip — keep last known session instead of forcing demo/logged-out mode.
        return
      }
      let data: SessionJson
      try {
        data = (await r.json()) as SessionJson
      } catch {
        return
      }
      applySession(data)
    } catch {
      // Network error — preserve existing session snapshot.
    } finally {
      setStatus('ready')
    }
  }, [applySession])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      status,
      viewerUsername,
      isAuthenticated,
      viewerUserId,
      isFallback,
      viewerDisplayName,
      viewerEmail,
      refresh,
      logout,
    }),
    [status, viewerUsername, isAuthenticated, viewerUserId, isFallback, viewerDisplayName, viewerEmail, refresh, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Fixed session for Storybook — no `/api/auth/session` fetch. */
export function FixedAuthProvider({
  children,
  value,
}: {
  children: ReactNode
  value: AuthContextValue
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function defaultStoryAuthValue(overrides?: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: 'ready',
    viewerUsername: 'RopeDreamer',
    isAuthenticated: true,
    viewerUserId: '00000000-0000-4000-8000-000000000001',
    isFallback: false,
    viewerDisplayName: 'Rope Dreamer',
    viewerEmail: 'demo@storybook.local',
    refresh: async () => {},
    logout: async () => {},
    ...overrides,
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Current viewer username for permissions / “own post” checks (client only). */
export function useViewerUsername(): string {
  return useAuth().viewerUsername
}
