import { Link } from 'react-router-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { buildLoginHref } from '@/lib/auth-links'
import { useAuth } from '@/contexts/AuthContext'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import { SettingsPageSkeleton } from '@/components/ui/skeleton'
import SettingsTabNav, { TABS } from './SettingsTabNav'
import { SettingsProvider, useSettingsContext } from './SettingsContext'
import { shellWideClass } from '@/lib/shell-contract'
import { cn } from '@/lib/cn'

const settingsShellClass = cn(shellWideClass, 'py-8')

const LEGACY_HASH_ROUTES: Record<string, string> = {
  account: '/settings/account',
  privacy: '/settings/privacy',
  notifications: '/settings/notifications',
  'presenter-catalog': '/settings/ecosystem',
  'vendor-shop': '/settings/vendor',
}

function SettingsLayoutInner() {
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const ctx = useSettingsContext()

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    const target = hash ? LEGACY_HASH_ROUTES[hash] : null
    if (!target || location.pathname === target) return
    navigate(`${target}${location.hash}`, { replace: true })
  }, [location.hash, location.pathname, navigate])

  if (authStatus === 'loading' || (isAuthenticated && !isFallback && ctx.loadState === 'idle')) {
    return <SettingsPageSkeleton />
  }

  if (!isAuthenticated) {
    return (
      <div className={cn(settingsShellClass)}>
        <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold text-dc-text">Settings</h1>
        <p className="text-dc-muted mt-2 text-sm">
          <Link to={buildLoginHref('/settings')} className="text-dc-accent hover:underline">
            Sign in
          </Link>{' '}
          to manage your account and preferences.
        </p>
        </div>
      </div>
    )
  }

  if (isFallback) {
    return (
      <div className={cn(settingsShellClass)}>
        <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold text-dc-text">Settings</h1>
        <p className="text-dc-muted mt-2 text-sm">
          Sign in with a real account to save settings. Preview mode does not persist changes.
        </p>
        </div>
      </div>
    )
  }

  if (ctx.loadState === 'loading' || ctx.loadState === 'idle') {
    return <SettingsPageSkeleton />
  }

  if (ctx.loadState === 'error' || !ctx.bundleReady || !ctx.privacy || !ctx.notifications || !ctx.feed) {
    return (
      <div className={cn(settingsShellClass)}>
        <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold text-dc-text">Settings</h1>
        <p className="text-dc-danger mt-2 text-sm">{ctx.loadError ?? 'We could not load your settings.'}</p>
        <button
          type="button"
          onClick={() => void ctx.load()}
          className="mt-4 rounded-lg border border-dc-border bg-dc-elevated-solid px-4 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Retry
        </button>
        </div>
      </div>
    )
  }

  const isSettingsRoot = location.pathname === '/settings' || location.pathname === '/settings/'
  const activeTab = TABS.find((tab) => location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`))

  return (
    <div className={settingsShellClass}>
      <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 lg:mb-6">
        {isSettingsRoot ?
          <>
            <h1 className="text-2xl font-bold text-dc-text">Settings</h1>
            <p className="text-sm text-dc-muted mt-1 max-w-prose">
              Manage your account, privacy, notifications, and community roles.
            </p>
          </>
        : <>
            <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Settings</p>
            <h1 className="text-xl font-bold text-dc-text lg:text-2xl">{activeTab?.label ?? 'Settings'}</h1>
          </>}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
          <SettingsTabNav />
        </div>
        <div className="order-1 flex-1 min-w-0 pb-12 lg:order-2">
          <TabContentTransition tabKey={location.pathname}>
            <Outlet />
          </TabContentTransition>
        </div>
      </div>
      </div>
    </div>
  )
}

export default function SettingsLayout() {
  return (
    <SettingsProvider>
      <SettingsLayoutInner />
    </SettingsProvider>
  )
}
