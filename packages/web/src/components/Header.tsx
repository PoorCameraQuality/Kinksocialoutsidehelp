import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { siteConfig } from '@/config/site.config'
import { isAppHomeMainNavActive } from '@/lib/app-home-nav'
import { navLinkIsActive } from '@/lib/nav-link-active'
import { useAuth } from '@/contexts/AuthContext'
import CreateMenuDropdown from '@/components/CreateMenuDropdown'
import NotificationDropdownPanel from '@/components/notifications/NotificationDropdownPanel'
import { useNotificationsList } from '@/hooks/useNotificationsList'
import { useConversationsPreview } from '@/hooks/useConversationsPreview'
import { useApiMyRsvps } from '@/hooks/useApiMyRsvps'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'
import PlatformStaffNavLinks from '@/components/moderation/PlatformStaffNavLinks'
import AccountManageNavLinks from '@/components/account/AccountManageNavLinks'
import type { NavSecondaryBadge } from '@/lib/site-nav'
import { fetchUserEcosystem, type UserEcosystemPayload } from '@/lib/user-ecosystem'
import { pickPrimaryProfilePhoto } from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import { getMockPersonByUsername } from '@/data/mock-data'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import { hideAppHomeMainNavForPath } from '@/lib/focused-personal-shell'
import { hideHeaderSearchForPath } from '@/lib/discover-nav-policy'
import { buildLoginHref } from '@/lib/auth-links'
import SiteWordmark from '@/components/brand/SiteWordmark'
import { shellHeaderClass } from '@/lib/shell-contract'

type EcosystemPayload = UserEcosystemPayload

export default function Header() {
  const {
    viewerUsername,
    viewerDisplayName,
    viewerEmail,
    isAuthenticated,
    isFallback,
    logout,
  } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [ecosystem, setEcosystem] = useState<EcosystemPayload | null>(null)
  const [ecosystemLoading, setEcosystemLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  const goToDiscoverySearch = useCallback(() => {
    const q = searchQuery.trim()
    navigate(q ? `/people?q=${encodeURIComponent(q)}` : '/people')
  }, [navigate, searchQuery])

  const createRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const notifMobileRef = useRef<HTMLDivElement>(null)
  const msgRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const profileMobileRef = useRef<HTMLDivElement>(null)
  const [mobileOverlaysMounted, setMobileOverlaysMounted] = useState(false)

  const {
    items: notifItems,
    unreadCount: notifUnread,
    markRead: markNotifRead,
    markAllRead: markAllNotifsRead,
    load: reloadNotifs,
  } = useNotificationsList()
  const {
    items: msgItems,
    unreadCount: msgUnread,
    load: reloadMsgs,
  } = useConversationsPreview()

  const showAppNav = isAuthenticated && !isFallback
  const showAppHomeMainNav = showAppNav && !hideAppHomeMainNavForPath(pathname)
  const showHeaderSearch = !hideHeaderSearchForPath(pathname)
  const wireNavBadges = showAppNav
  const myRsvps = useApiMyRsvps(wireNavBadges)
  const platformStaff = useApiPlatformStaff(showAppNav)
  const profileMe = useApiProfileMe(showAppNav)
  const showModerationNav = platformStaff.staff?.moderator === true

  const headerPrimaryPhoto = useMemo(() => {
    if (showAppNav && profileMe.data?.photos?.length) {
      const photos = profileMe.data.photos
      return (
        pickPrimaryProfilePhoto(photos) ??
        photos.find((p) => p.url) ??
        null
      )
    }
    if (viewerUsername) {
      const mock = getMockPersonByUsername(viewerUsername)
      const mockPrimary = pickPrimaryProfilePhoto(mock?.profilePhotos ?? [])
      if (mockPrimary) return mockPrimary
    }
    return null
  }, [showAppNav, profileMe.data, viewerUsername])

  const headerAvatarUrl =
    headerPrimaryPhoto?.url ??
    (viewerUsername ? getMockPersonByUsername(viewerUsername)?.avatarUrl ?? null : null)

  useEffect(() => {
    if (!showAppNav) return
    const refreshAvatar = () => profileMe.reload()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAvatar()
    }
    window.addEventListener('focus', refreshAvatar)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshAvatar)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [showAppNav, profileMe.reload])

  const navSecondaryBadgeCount = useCallback(
    (badge: NavSecondaryBadge | undefined): number | undefined => {
      if (!badge || !wireNavBadges) return undefined
      let n = 0
      if (badge === 'notifications') n = notifUnread
      else if (badge === 'messaging') n = msgUnread
      else if (badge === 'events' && myRsvps.status === 'ready') n = myRsvps.items.length
      return n > 0 ? n : undefined
    },
    [wireNavBadges, notifUnread, msgUnread, myRsvps.status, myRsvps.items.length],
  )

  const sceneLabel = viewerDisplayName?.trim() || viewerUsername || 'Guest'
  const emailLabel = viewerEmail ?? (isFallback && !isAuthenticated ? 'Demo viewer' : '')

  useEffect(() => {
    setMobileOverlaysMounted(true)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (createRef.current && !createRef.current.contains(t)) setCreateOpen(false)
      if (
        notifRef.current &&
        !notifRef.current.contains(t) &&
        (!notifMobileRef.current || !notifMobileRef.current.contains(t))
      ) {
        setNotifOpen(false)
      }
      if (msgRef.current && !msgRef.current.contains(t)) setMsgOpen(false)
      if (
        profileRef.current &&
        !profileRef.current.contains(t) &&
        (!profileMobileRef.current || !profileMobileRef.current.contains(t))
      ) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!notifOpen && !isProfileOpen) return
    const prev = document.body.style.overflow
    if (window.matchMedia('(max-width: 767px)').matches) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = prev
    }
  }, [notifOpen, isProfileOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false)
        setNotifOpen(false)
        setMsgOpen(false)
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isProfileOpen || !viewerUsername || !isAuthenticated || isFallback) {
      setEcosystem(null)
      setEcosystemLoading(false)
      return
    }
    let cancelled = false
    setEcosystemLoading(true)
    void (async () => {
      const data = await fetchUserEcosystem(viewerUsername)
      if (cancelled) return
      setEcosystem(data)
      setEcosystemLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isProfileOpen, viewerUsername, isAuthenticated, isFallback])

  const toggleNotifPanel = useCallback(() => {
    setNotifOpen((open) => {
      const next = !open
      if (next) {
        setMsgOpen(false)
        setIsProfileOpen(false)
        void reloadNotifs()
      }
      return next
    })
  }, [reloadNotifs])

  const toggleMsgPanel = useCallback(() => {
    setMsgOpen((open) => {
      const next = !open
      if (next) {
        setNotifOpen(false)
        void reloadMsgs()
      }
      return next
    })
  }, [reloadMsgs])

  const marketingHeader = !showAppNav

  const profileMenuLinkClass =
    'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted md:min-h-0 md:text-dc-text-muted md:hover:text-dc-text'

  const profileMenuContent = (
    <>
      <div className="px-4 py-3 border-b border-dc-border">
        <p className="font-medium text-dc-text">{sceneLabel}</p>
        {emailLabel ? <p className="mt-0.5 break-all text-xs text-dc-text-muted">{emailLabel}</p> : null}
        {isFallback && !isAuthenticated && (
          <p className="text-xs text-dc-muted mt-1">Demo viewer (not signed in)</p>
        )}
      </div>
      <div className="px-2 py-2 border-b border-dc-border space-y-0.5">
        <Link
          to={viewerUsername ? `/profile/${encodeURIComponent(viewerUsername)}` : '/profile'}
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          View profile
        </Link>
        <Link
          to="/profile/edit"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          Edit profile
        </Link>
        <Link
          to="/my-posts"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          My Posts
        </Link>
        <Link
          to="/activity"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          Activity
        </Link>
        <Link
          to="/saved"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          Saved
        </Link>
      </div>

      {showModerationNav ?
        <div className="px-2 py-2 border-b border-dc-border">
          <PlatformStaffNavLinks variant="dropdown" onNavigate={() => setIsProfileOpen(false)} />
        </div>
      : null}

      <div className="px-2 py-2 border-b border-dc-border space-y-0.5">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Manage</p>
        <AccountManageNavLinks
          variant="dropdown"
          ecosystem={ecosystem}
          loading={ecosystemLoading}
          onNavigate={() => setIsProfileOpen(false)}
        />
      </div>

      <div className="px-2 py-2 border-b border-dc-border space-y-0.5">
        <Link
          to="/settings/account"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          Account settings
        </Link>
        <Link
          to="/settings/privacy"
          className={profileMenuLinkClass}
          onClick={() => setIsProfileOpen(false)}
        >
          Privacy settings
        </Link>
      </div>

      <div className="px-2 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setIsProfileOpen(false)
            void (async () => {
              await logout()
              navigate(buildLoginHref(), { replace: true })
            })()
          }}
          className="inline-flex min-h-11 items-center px-3 py-2 text-sm text-dc-text-muted hover:text-dc-text md:min-h-0"
        >
          Log out
        </button>
      </div>
    </>
  )

  const logoLink = (
    <Link
      to={showAppNav ? '/home?tab=Local' : '/'}
      className="flex min-h-11 shrink-0 items-center font-display text-lg font-bold tracking-tight text-dc-accent transition-colors hover:text-dc-accent-hover"
      aria-label={siteConfig.brandWordmark}
    >
      <SiteWordmark />
    </Link>
  )

  const searchField = (
    <div className={marketingHeader ? 'relative w-full max-w-2xl' : 'relative w-full'}>
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dc-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        placeholder={siteConfig.appSearchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            goToDiscoverySearch()
          }
        }}
        className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid py-2 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
        aria-label="Search people"
      />
    </div>
  )

  const marketingNav = marketingHeader ?
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Marketing">
      {siteConfig.navLanding.map((link) => {
        const active = navLinkIsActive(pathname, link.href)
        return (
          <Link
            key={link.href}
            to={link.href}
            className={`min-h-10 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors ${
              active ?
                'text-dc-accent'
              : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
      <Link
        to="/?login=1"
        className="min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-dc-text-muted transition-colors hover:text-dc-text"
      >
        Login
      </Link>
      <Link
        to="/#join-desktop"
        className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground transition-colors hover:bg-dc-accent-hover"
      >
        Sign Up
      </Link>
    </nav>
  : null

  return (
    <header className="dc-header-chrome sticky top-0 z-dc-chrome overflow-visible border-b border-dc-border-subtle bg-dc-elevated/95 shadow-[var(--dc-shadow-soft)] backdrop-blur-md safe-area-pt">
      <div className={marketingHeader ? 'mx-auto max-w-7xl overflow-visible px-4 sm:px-6 lg:px-8' : shellHeaderClass}>
        {marketingHeader ?
          <>
            <div className="flex h-14 items-center gap-2 lg:hidden">
              {logoLink}
              <div className="ml-auto flex items-center gap-0.5">
                <Link
                  to="/?login=1"
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
                >
                  Login
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-expanded={isMenuOpen}
                  aria-label="Toggle menu"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMenuOpen ?
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>
              </div>
            </div>
            <div className="hidden h-16 items-center gap-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]">
              {logoLink}
              <div className="flex min-w-0 justify-center px-4">{searchField}</div>
              {marketingNav}
            </div>
          </>
        : (
          <>
            <div className="flex h-12 items-center gap-2 sm:gap-3 md:h-14 xl:h-16">
              {logoLink}

              <div className="mx-2 hidden min-w-0 flex-1 md:flex xl:max-w-2xl">
                {showHeaderSearch ? searchField : null}
              </div>

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
            {showAppNav ? (
              <>
                {showHeaderSearch ?
                  <Link
                    to={
                      searchQuery.trim()
                        ? `/people?q=${encodeURIComponent(searchQuery.trim())}`
                        : '/people'
                    }
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text lg:hidden"
                    aria-label="Search people"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </Link>
                : null}

                <div className="relative hidden lg:block" ref={createRef}>
                  <button
                    type="button"
                    onClick={() => setCreateOpen((o) => !o)}
                    className="flex items-center gap-2 rounded-lg bg-dc-accent px-3 py-2 text-sm font-medium text-dc-accent-foreground transition-colors hover:bg-dc-accent-hover"
                    aria-expanded={createOpen}
                    aria-haspopup="true"
                    aria-label="Create menu"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden lg:inline">Create</span>
                  </button>
                  {createOpen && (
                    <div className="absolute right-0 top-full z-dc-dropdown mt-2 max-h-[min(70vh,420px)] w-64 overflow-y-auto rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-panel)]">
                      <CreateMenuDropdown onNavigate={() => setCreateOpen(false)} />
                    </div>
                  )}
                </div>

                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={toggleNotifPanel}
                    className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
                    aria-label="Notifications"
                    aria-expanded={notifOpen}
                    aria-haspopup="true"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {notifUnread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-dc-accent px-1 text-[9px] font-bold text-dc-accent-foreground md:bg-dc-danger md:text-dc-text">
                        {notifUnread > 99 ? '99+' : notifUnread}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <NotificationDropdownPanel
                        items={notifItems}
                        unreadCount={notifUnread}
                        onMarkRead={markNotifRead}
                        onMarkAllRead={markAllNotifsRead}
                        onClose={() => setNotifOpen(false)}
                        className="absolute right-0 top-full z-dc-dropdown mt-2 hidden w-[22rem] lg:block"
                      />
                      {mobileOverlaysMounted ?
                        createPortal(
                          <div
                            ref={notifMobileRef}
                            className="fixed inset-0 z-dc-modal flex flex-col justify-end lg:hidden"
                            role="presentation"
                          >
                            <button
                              type="button"
                              className="absolute inset-0 bg-black/40"
                              aria-label="Close notifications"
                              onClick={() => setNotifOpen(false)}
                            />
                            <NotificationDropdownPanel
                              items={notifItems}
                              unreadCount={notifUnread}
                              onMarkRead={markNotifRead}
                              onMarkAllRead={markAllNotifsRead}
                              onClose={() => setNotifOpen(false)}
                              mobileSheet
                              className="relative z-[1] max-h-[min(75dvh,480px)] w-full"
                            />
                          </div>,
                          document.body,
                        )
                      : null}
                    </>
                  )}
                </div>

                <div className="relative hidden lg:block" ref={msgRef}>
                  <button
                    type="button"
                    onClick={toggleMsgPanel}
                    className="relative p-2 text-dc-text-muted hover:text-dc-text rounded-lg transition-colors"
                    aria-label="Messages"
                    aria-expanded={msgOpen}
                    aria-haspopup="true"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    {msgUnread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-dc-accent px-1 text-[9px] font-bold text-dc-accent-foreground md:bg-dc-danger md:text-dc-text">
                        {msgUnread > 99 ? '99+' : msgUnread}
                      </span>
                    )}
                  </button>
                  {msgOpen && (
                    <div className="absolute right-0 top-full z-dc-dropdown w-[min(100vw-2rem,22rem)] rounded-xl border border-dc-border bg-dc-elevated-solid py-2 shadow-[var(--dc-shadow-panel)]">
                      <p className="px-3 pb-2 text-xs font-semibold text-dc-muted uppercase tracking-wide">Messages</p>
                      <ul className="max-h-64 overflow-y-auto">
                        {msgItems.slice(0, 6).map((c) => (
                          <li key={c.id}>
                            <Link
                              to={`/messaging?c=${encodeURIComponent(c.id)}`}
                              className="block px-3 py-2 hover:bg-dc-elevated-muted"
                              onClick={() => setMsgOpen(false)}
                            >
                              <p className="text-sm font-medium text-dc-text truncate">{c.title}</p>
                              <p className="text-xs text-dc-text-muted truncate">{c.lastMessageBody}</p>
                              <p className="text-[10px] text-dc-muted mt-0.5">{c.lastMessageAtLabel}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-dc-border mt-1 pt-2 px-2">
                        <Link
                          to="/messaging"
                          className="block rounded-lg px-3 py-2 text-center text-sm font-medium text-dc-accent hover:bg-dc-elevated-muted"
                          onClick={() => setMsgOpen(false)}
                        >
                          Open messages
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false)
                      setIsProfileOpen((open) => !open)
                    }}
                    className="flex min-h-11 items-center gap-1 rounded-full transition-colors hover:ring-2 hover:ring-dc-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface"
                    aria-expanded={isProfileOpen}
                    aria-haspopup="true"
                    aria-label={viewerUsername ? `Account menu for ${viewerUsername}` : 'Account menu'}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full lg:h-11 lg:w-11" aria-hidden>
                      {headerAvatarUrl ?
                        <ProfilePhotoImage
                          src={headerAvatarUrl}
                          alt=""
                          displaySettings={
                            headerPrimaryPhoto && 'displaySettings' in headerPrimaryPhoto
                              ? headerPrimaryPhoto.displaySettings
                              : undefined
                          }
                          className="h-full w-full rounded-full object-cover"
                        />
                      : viewerUsername ?
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-dc-accent/30 text-sm font-medium uppercase text-dc-accent">
                          {viewerUsername.charAt(0).toUpperCase()}
                        </div>
                      : (
                        <PlaceholderAvatar size="xl" className="!h-full !w-full !rounded-full !bg-dc-surface-muted" />
                      )}
                    </div>
                    <svg
                      className="h-4 w-4 text-dc-muted lg:hidden"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isProfileOpen && (
                    <>
                      <div
                        className="absolute right-0 top-full z-dc-dropdown mt-2 hidden w-72 max-h-[min(80vh,520px)] overflow-y-auto rounded-xl border border-dc-border bg-dc-elevated-solid py-2 shadow-[var(--dc-shadow-panel)] lg:block"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Account menu"
                      >
                        {profileMenuContent}
                      </div>
                      {mobileOverlaysMounted ?
                        createPortal(
                          <div
                            ref={profileMobileRef}
                            className="fixed inset-0 z-dc-modal flex flex-col justify-end lg:hidden"
                            role="presentation"
                          >
                            <button
                              type="button"
                              className="absolute inset-0 bg-black/40"
                              aria-label="Close account menu"
                              onClick={() => setIsProfileOpen(false)}
                            />
                            <div
                              className="relative z-[1] max-h-[var(--c2k-mobile-sheet-max-height)] overflow-y-auto rounded-t-2xl border border-b-0 border-dc-border bg-dc-elevated-solid py-2 pb-[calc(var(--c2k-bottom-nav-total-h)+0.75rem)] shadow-[var(--dc-shadow-panel)]"
                              role="dialog"
                              aria-modal="true"
                              aria-label="Account menu"
                            >
                              <div className="mx-auto mb-2 mt-1 h-1 w-10 shrink-0 rounded-full bg-dc-border/80" aria-hidden />
                              {profileMenuContent}
                            </div>
                          </div>,
                          document.body,
                        )
                      : null}
                    </>
                  )}
                </div>
              </>
            ) : null}
            {!showAppNav ?
            <button
              type="button"
              className="rounded-lg p-2 text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ?
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            : null}
          </div>
            </div>
            {showAppHomeMainNav ?
              <nav
                className="dc-header-subnav hidden w-full items-center justify-center gap-0.5 overflow-x-auto border-t border-dc-border-subtle/80 pb-1 pt-1 lg:flex"
                aria-label="Main navigation"
              >
                {siteConfig.appHomeMainNav.map((link) => {
                  const active = isAppHomeMainNavActive(link.href, pathname, search)
                  return (
                    <Link
                      key={`${link.href}-${link.label}`}
                      to={link.href}
                      className={`dc-browse-nav-link min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                        active ?
                          'dc-browse-nav-link--active border-b-2 border-dc-accent bg-dc-accent-muted/50 text-dc-accent'
                        : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            : null}
          </>
        )}

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-dc-border-subtle animate-fade-in">
            <nav className="flex flex-col gap-1">
              {!showAppNav ?
                <div className="px-4 py-2 border-b border-dc-border-subtle mb-1">
                  <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Browse</p>
                  <div className="flex flex-col gap-1">
                    {siteConfig.navLanding.map((link) => {
                      const active = navLinkIsActive(pathname, link.href)
                      return (
                        <Link
                          key={link.href}
                          to={link.href}
                          className={`min-h-11 flex items-center px-4 rounded-lg text-sm font-medium ${
                            active ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to="/?login=1"
                      className="min-h-11 flex items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      to="/#join"
                      className="min-h-11 flex items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              : null}
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Explore</p>
                <div className="flex flex-col gap-1">
                  {siteConfig.navPublic.map((link) => {
                    const active = navLinkIsActive(pathname, link.href)
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          active ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
              {showAppNav && (
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Create</p>
                  <CreateMenuDropdown onNavigate={() => setIsMenuOpen(false)} />
                </div>
              )}
              {siteConfig.navPrimary.map((link) => {
                  const to = link.href === '/home' ? '/home?tab=Local' : link.href
                  const active =
                    link.href === '/home' ?
                      pathname === '/home' || pathname === '/' || pathname === '/feed'
                    : navLinkIsActive(pathname, link.href)
                  return (
                    <Link
                      key={link.href}
                      to={to}
                      className={`px-4 py-3 rounded-lg text-sm font-medium ${
                        active ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              {showAppNav && (
                <>
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-dc-muted uppercase mb-2">More</p>
                    <div className="flex flex-col gap-1">
                      {siteConfig.navMore.map((link) => {
                        const active = navLinkIsActive(pathname, link.href)
                        return (
                          <Link
                            key={link.href}
                            to={link.href}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                              active ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                            }`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {link.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Shortcuts</p>
                    <div className="flex flex-col gap-1">
                      {siteConfig.navSecondary.map((link) => {
                          const active = navLinkIsActive(pathname, link.href)
                          const badge = navSecondaryBadgeCount('badge' in link ? link.badge : undefined)
                          return (
                            <Link
                              key={link.href}
                              to={link.href}
                              className={`flex items-center justify-between gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                                active ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
                              }`}
                              onClick={() => setIsMenuOpen(false)}
                            >
                              <span>{link.label}</span>
                              {badge !== undefined ?
                                <span className="min-w-[1.25rem] rounded-full bg-dc-danger px-1.5 py-0.5 text-center text-[10px] font-bold text-dc-text">
                                  {badge > 99 ? '99+' : badge}
                                </span>
                              : null}
                            </Link>
                          )
                        })}
                    </div>
                  </div>
                  <div className="px-4 py-2 border-t border-dc-border-subtle">
                    <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Account</p>
                    <div className="flex flex-col gap-1">
                      {showModerationNav ?
                        <PlatformStaffNavLinks
                          variant="mobile"
                          onNavigate={() => setIsMenuOpen(false)}
                        />
                      : null}
                      {viewerUsername ?
                        <Link
                          to={`/profile/${encodeURIComponent(viewerUsername)}`}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          View profile
                        </Link>
                      : null}
                      <Link
                        to="/profile/edit"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Edit profile
                      </Link>
                      <Link
                        to="/saved"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Saved
                      </Link>
                      <Link
                        to="/settings"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <Link
                        to="/support"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Support
                      </Link>
                      {siteConfig.footer.legal.map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
