import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import AppProviders from '@/components/AppProviders'
import AppRobotsMeta from '@/components/seo/AppRobotsMeta'
import OnboardingGate from '@/components/onboarding/OnboardingGate'
import AuthGate from '@/components/auth/AuthGate'
import BottomNav from '@/components/BottomNav'
import CreateFlowModal from '@/components/CreateFlowModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import CommunityNavBar from '@/components/CommunityNavBar'
import MockDataBanner from '@/components/MockDataBanner'
import StripePaymentsAnnouncementBanner from '@/components/StripePaymentsAnnouncementBanner'
import EmailVerifyNudgeBanner from '@/components/onboarding/EmailVerifyNudgeBanner'
import RouteNavigationPending from '@/components/RouteNavigationPending'
import ScrollToTopOnNavigate from '@/components/ScrollToTopOnNavigate'
import AppShell from '@/components/shell/AppShell'
import CreateFab from '@/components/shell/CreateFab'
import CreateSheet from '@/components/shell/CreateSheet'
import InAppBrowserBanner from '@/components/shell/InAppBrowserBanner'
import { CreateSheetProvider } from '@/contexts/CreateSheetContext'
import { FeedComposerUiProvider, useFeedComposerEngaged } from '@/contexts/FeedComposerUiContext'
import { useAuth } from '@/contexts/AuthContext'
import { hideMarketingFooterOnMobile } from '@/lib/community-nav'
import { hideMockDataBannerForPath } from '@/lib/focused-personal-shell'
import { isTierAAppShellRoute, showCreateFabForPath } from '@/lib/app-shell-routes'
import { mobileMainPadClass, suppressMobileBottomNav, suppressMobileCreateFab } from '@/lib/mobile-chrome'
import { useMaxLg } from '@/hooks/useMaxLg'

/** Must render under `AppProviders` / `AuthProvider` - see `RootLayout`. */
function RootLayoutInner() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isFallback } = useAuth()
  const maxLg = useMaxLg()
  const showMemberChrome = isAuthenticated && !isFallback
  const hideFooterMobile = hideMarketingFooterOnMobile(pathname)
  const hideMarketingFooter = showMemberChrome
  const suppressBottomNav = suppressMobileBottomNav(pathname, searchParams)
  const useAppShell = showMemberChrome && isTierAAppShellRoute(pathname)
  const showMobileChrome = maxLg
  const composerEngaged = useFeedComposerEngaged()
  const showCreateFab =
    showMobileChrome &&
    showMemberChrome &&
    showCreateFabForPath(pathname) &&
    !suppressBottomNav &&
    !suppressMobileCreateFab(pathname) &&
    !composerEngaged

  const mainMobilePadClass = showMemberChrome ? mobileMainPadClass(pathname, showCreateFab, searchParams) : 'pb-0'

  const pageContent = (
    <AuthGate>
      <OnboardingGate>
        {useAppShell ?
          <AppShell>
            <Outlet />
          </AppShell>
        : <Outlet />}
      </OnboardingGate>
    </AuthGate>
  )

  return (
    <>
      <AppRobotsMeta />
      <InAppBrowserBanner />
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[500] -translate-y-[200%] rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground shadow-[var(--dc-shadow-soft)] outline-none ring-2 ring-dc-surface ring-offset-2 ring-offset-dc-accent transition-transform focus-visible:translate-y-0"
      >
        Skip to main content
      </a>
      {showMemberChrome ? <Header /> : null}
      <ScrollToTopOnNavigate />
      <RouteNavigationPending />
      <CommunityNavBar />
      {!hideMockDataBannerForPath(pathname) ? <MockDataBanner /> : null}
      <StripePaymentsAnnouncementBanner />
      {showMemberChrome ? <EmailVerifyNudgeBanner /> : null}
      <main
        id="main-content"
        className={`min-h-screen min-w-0 overflow-x-hidden lg:pb-0 ${mainMobilePadClass}`}
      >
        {pageContent}
      </main>
      {hideMarketingFooter || pathname === '/' ? null : (
        <div className={hideFooterMobile ? 'hidden md:block' : undefined}>
          <Footer />
        </div>
      )}
      <CreateFab show={showCreateFab} />
      <CreateSheet />
      {showMobileChrome && !suppressBottomNav ? <BottomNav /> : null}
      <CreateFlowModal />
    </>
  )
}

export default function RootLayout() {
  return (
    <AppProviders>
      <CreateSheetProvider>
        <FeedComposerUiProvider>
          <RootLayoutInner />
        </FeedComposerUiProvider>
      </CreateSheetProvider>
    </AppProviders>
  )
}
