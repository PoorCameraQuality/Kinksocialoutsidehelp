import { createBrowserRouter, Link, Navigate } from 'react-router-dom'
import AboutPage from './app/about/page'
import AccessibilityPage from './app/accessibility/page'
import ErobayCommunityMirrorPage from './app/calendar/erobay-community/page'
import ConnectionsPage from './app/connections/page'
import SavedPage from './app/saved/page'
import ActivityHubPage from './app/activity/page'
import MyPostsPage from './app/my-posts/page'
import ContactPage from './app/contact/page'
import DiscoveryRoute from './app/discovery/DiscoveryRoute'
import ExplorePage from './app/explore/page'
import PeopleDirectoryPage from './app/people/page'
import DungeonsPage from './app/dungeons/page'
import EducationPage from './app/education/page'
import EducationWritePage from './app/education/write/page'
import EducationArticlePage from './app/education/[slug]/page'
import EducationSeriesPage from './app/education/series/[slug]/page'
import EducationSeriesManagePage from './app/education/series/manage/page'
import EducationSeriesManageEditPage from './app/education/series/manage/[id]/page'
import MediaPage from './app/media/page'
import MediaShowPage from './app/media/[slug]/page'
import MediaItemDetailPage from './app/media/item/[mediaItemId]/page'
import MediaSubmitPage from './app/media/submit/page'
import CreatePage from './app/create/page'
import EventsPage from './app/events/page'
import EventDetailPage from './app/events/[id]/page'
import PlaySpacesDirectoryPage from './app/play/page'
import PlayMySchedulePage from './app/play/schedule/page'
import PlaySpaceDetailPage from './app/play/[slug]/page'
import PlaySpaceSharePage from './app/play/[slug]/s/[token]/page'
import PlaySpaceProgramManagePage from './app/play/[slug]/program/manage/page'
import PlaySpaceReservationsPage from './app/play/[slug]/reservations/page'
import PlaySpaceReservationDetailPage from './app/play/[slug]/reservations/[id]/page'
import GroupsPage from './app/groups/page'
import GroupOnboardingPage from './app/groups/onboarding/page'
import GroupDetailPage from './app/groups/[id]/page'
import GuidelinesPage from './app/guidelines/page'
import HomePage from './app/home/page'
import SharePostPage from './app/share/post/[id]/page'
import LandingPage from './app/page'
import LoginRedirectPage from './app/login/LoginRedirectPage'
import ForgotPasswordPage from './app/forgot-password/page'
import ResetPasswordPage from './app/reset-password/page'
import MessagingPage from './app/messaging/page'
import NotificationsPage from './app/notifications/page'
import EmailUnsubscribePage from './app/email/unsubscribe/page'
import EmailConfirmPage from './app/email/confirm/page'
import PlacesPage from './app/places/page'
import PlaceDetailPage from './app/places/[slug]/page'
import PrivacyPage from './app/privacy/page'
import ProfilePage from './app/profile/page'
import ProfileEditLayout from './app/profile/edit/ProfileEditLayout'
import OverviewPanel from '@/components/profile/edit/OverviewPanel'
import CommunityIdentityPanel from '@/components/profile/edit/CommunityIdentityPanel'
import InterestsPanel from '@/components/profile/edit/InterestsPanel'
import PhotosStudioPanel from '@/components/profile/edit/PhotosStudioPanel'
import PresencePanel from '@/components/profile/edit/PresencePanel'
import ProfileUsernamePage from './app/profile/[username]/page'
import OnboardingPage from './app/onboarding/page'
import VerifyEmailPage from './app/verify-email/page'
import ProfileCompletePage from './app/profile/complete/page'
import SettingsLayout from './app/settings/SettingsLayout'
import SettingsAccountPage from './app/settings/account/page'
import SettingsProfileHubPage from './app/settings/profile/page'
import SettingsPrivacyPage from './app/settings/privacy/page'
import SettingsNotificationsPage from './app/settings/notifications/page'
import SettingsActivityPage from './app/settings/activity/page'
import SettingsMutedPage from './app/settings/muted/page'
import SettingsBlockedPage from './app/settings/blocked/page'
import SettingsPaymentHistoryPage from './app/settings/payment-history/page'
import SettingsEcosystemPage from './app/settings/ecosystem/page'
import SettingsVendorPage from './app/settings/vendor/page'
import SettingsTrustPage from './app/settings/trust/page'
import StaffProfilePage from './app/staff/[username]/page'
import SupportPage from './app/support/page'
import BrandingGuidePage from './app/support/branding/page'
import TagsPage from './app/tags/[tag]/page'
import TermsPage from './app/terms/page'
import AdultContentConsentPage from './app/adult-content-consent/page'
import LawEnforcementPage from './app/law-enforcement/page'
import SecurityDisclosurePage from './app/security/page'
import DmcaPage from './app/dmca/page'
import NciiPage from './app/ncii/page'
import VendorOrganizerTermsPage from './app/vendor-organizer-terms/page'
import MinorSafetyPage from './app/minor-safety/page'
import PoliciesIndexPage from './app/policies/page'
import ModeratorCodeOfConductPage from './app/policies/moderator-code-of-conduct/page'
import AppealsPolicyPage from './app/policies/appeals/page'
import GroupGuidelinesPage from './app/policies/groups/page'
import EventGuidelinesPage from './app/policies/events/page'
import PaymentsPolicyPage from './app/policies/payments/page'
import AdultContentRecordsPage from './app/policies/adult-content-records/page'
import VendorsPage from './app/vendors/page'
import VendorCreatePage from './app/vendors/new/page'
import VendorOnboardingPage from './app/vendors/onboarding/page'
import VendorDetailPage from './app/vendors/[id]/page'
import OrgsListPage from './app/orgs/page'
import OrgCreatePage from './app/orgs/new/page'
import OrgClaimPage from './app/orgs/claim/OrgClaimPage'
import OrgHubPage from './app/orgs/[slug]/page'
import ConventionsListPage from './app/conventions/page'
import ConventionProgramPage from './app/conventions/[slug]/page'
import ConventionDancecardSharedPage from './app/conventions/[slug]/dancecard/s/[token]/page'
import ConventionRegisterPage from './app/conventions/[slug]/register/page'
import TrustedRoleApplyPage from './app/conventions/[slug]/apply/[applySlug]/page'
import ConventionPresentApplyPage from './app/conventions/[slug]/present/apply/page'
import ConventionVendApplyPage from './app/conventions/[slug]/vend/apply/page'
import ConventionMyOffersPage from './app/conventions/[slug]/my-offers/page'
import PresentersDirectoryPage from './app/presenters/page'
import PresenterOnboardingPage from './app/presenters/onboarding/page'
import PresenterProfilePage from './app/presenters/[username]/page'
import ModerationShell from './components/moderation/ModerationShell'
import ModerationIndexPage from './app/moderation/ModerationIndexPage'
import ModerationReportsPage from './app/moderation/reports/page'
import ModerationProfileFlagsPage from './app/moderation/profile-flags/page'
import ModerationActionsPage from './app/moderation/actions/page'
import ModerationAdminPage from './app/moderation/admin/page'
import ModerationAuditPage from './app/moderation/audit/page'
import ModerationDashboardPage from './app/moderation/dashboard/page'
import ModerationQueuesPage from './app/moderation/queues/page'
import ModerationCasesPage from './app/moderation/cases/page'
import ModerationCaseDetailPage from './app/moderation/cases/[caseId]/page'
import ModerationLegalPage from './app/moderation/legal/page'
import ModerationDmcaPage from './app/moderation/dmca/page'
import ModerationContactPage from './app/moderation/contact/page'
import ModerationMailIntakePage from './app/moderation/mail-intake/page'
import OwnerInvestigationsIndexPage from './app/admin/owner/investigations/page'
import OwnerInvestigationUserPage from './app/admin/owner/investigations/users/[userId]/page'
import OrganizerHubPage from './app/organizer/page'
import OrganizerStripeSetupPage from './app/organizer/stripe-setup/page'
import OrganizerOrgPage from './app/organizer/orgs/[slug]/page'
import OrganizerOrgEventPage from './app/organizer/orgs/[slug]/events/[eventId]/page'
import OrganizerOrgConventionPage from './app/organizer/orgs/[slug]/conventions/[convSlug]/page'
import OrganizerGroupPage from './app/organizer/groups/[id]/page'
import OrganizerGroupEventPage from './app/organizer/groups/[id]/events/[eventId]/page'
import OrganizerConventionRedirectPage from './app/organizer/conventions/[slug]/page'
import OrganizerConventionDoorPage from './app/organizer/orgs/[slug]/conventions/[convSlug]/door/page'
import OrganizerConventionPrintSchedulePage from './app/organizer/orgs/[slug]/conventions/[convSlug]/print/schedule/page'
import OrganizerConventionPrintVenueSignsPage from './app/organizer/orgs/[slug]/conventions/[convSlug]/print/venue-signs/page'
import RootLayout from './layouts/RootLayout'
import AppProviders from './components/AppProviders'
import { buildLoginHref } from './lib/auth-links'

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-dc-text">Page not found</h1>
      <p className="mt-2 text-dc-text-muted">That route does not exist or was moved.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={buildLoginHref('/home')}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/organizer/orgs/:slug/conventions/:convSlug/door',
    element: (
      <AppProviders>
        <OrganizerConventionDoorPage />
      </AppProviders>
    ),
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginRedirectPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'feed', element: <Navigate to="/home?tab=Local" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'share/post/:id', element: <SharePostPage /> },
      { path: 'people', element: <PeopleDirectoryPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'discovery', element: <DiscoveryRoute /> },
      { path: 'explore/people', element: <Navigate to="/people" replace /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: 'play', element: <PlaySpacesDirectoryPage /> },
      { path: 'play/schedule', element: <PlayMySchedulePage /> },
      { path: 'play/:slug/s/:token', element: <PlaySpaceSharePage /> },
      { path: 'play/:slug/program/manage', element: <PlaySpaceProgramManagePage /> },
      { path: 'play/:slug/reservations/:id', element: <PlaySpaceReservationDetailPage /> },
      { path: 'play/:slug/reservations', element: <PlaySpaceReservationsPage /> },
      { path: 'play/:slug', element: <PlaySpaceDetailPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/onboarding', element: <GroupOnboardingPage /> },
      { path: 'groups/:id', element: <GroupDetailPage /> },
      { path: 'places/:slug', element: <PlaceDetailPage /> },
      { path: 'places', element: <PlacesPage /> },
      { path: 'vendors', element: <VendorsPage /> },
      { path: 'vendors/new', element: <VendorCreatePage /> },
      { path: 'vendors/onboarding', element: <VendorOnboardingPage /> },
      { path: 'vendors/:id', element: <VendorDetailPage /> },
      { path: 'orgs', element: <OrgsListPage /> },
      { path: 'orgs/new', element: <OrgCreatePage /> },
      { path: 'orgs/claim/:token', element: <OrgClaimPage /> },
      { path: 'orgs/:slug', element: <OrgHubPage /> },
      { path: 'conventions', element: <ConventionsListPage /> },
      { path: 'conventions/:slug', element: <ConventionProgramPage /> },
      { path: 'conventions/:slug/register', element: <ConventionRegisterPage /> },
      { path: 'conventions/:slug/apply/:applySlug', element: <TrustedRoleApplyPage /> },
      { path: 'conventions/:slug/present/apply', element: <ConventionPresentApplyPage /> },
      { path: 'conventions/:slug/vend/apply', element: <ConventionVendApplyPage /> },
      { path: 'conventions/:slug/my-offers', element: <ConventionMyOffersPage /> },
      { path: 'conventions/:slug/dancecard/s/:token', element: <ConventionDancecardSharedPage /> },
      { path: 'presenters', element: <PresentersDirectoryPage /> },
      { path: 'presenters/onboarding', element: <PresenterOnboardingPage /> },
      { path: 'presenters/:username', element: <PresenterProfilePage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'media/item/:mediaItemId', element: <MediaItemDetailPage /> },
      { path: 'media/submit', element: <MediaSubmitPage /> },
      { path: 'media/:slug', element: <MediaShowPage /> },
      { path: 'education', element: <EducationPage /> },
      { path: 'education/write', element: <EducationWritePage /> },
      { path: 'education/write/:id', element: <EducationWritePage /> },
      { path: 'education/series/manage', element: <EducationSeriesManagePage /> },
      { path: 'education/series/manage/:id', element: <EducationSeriesManageEditPage /> },
      { path: 'education/series/:slug', element: <EducationSeriesPage /> },
      { path: 'education/:slug', element: <EducationArticlePage /> },
      { path: 'tags/:tag', element: <TagsPage /> },
      {
        path: 'profile',
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'complete', element: <ProfileCompletePage /> },
          {
            path: 'edit',
            element: <ProfileEditLayout />,
            children: [
              { index: true, element: <OverviewPanel /> },
              { path: 'photos', element: <PhotosStudioPanel /> },
              { path: 'identity', element: <CommunityIdentityPanel /> },
              { path: 'interests', element: <InterestsPanel /> },
              { path: 'presence', element: <PresencePanel /> },
              { path: 'about', element: <Navigate to="/profile/edit" replace /> },
              {
                path: 'looking-for',
                element: <Navigate to="/profile/edit/presence?section=connections" replace />,
              },
              {
                path: 'relationships',
                element: <Navigate to="/profile/edit/presence?section=relationships" replace />,
              },
              { path: 'privacy', element: <Navigate to="/profile/edit/presence?section=visibility" replace /> },
              { path: 'links', element: <Navigate to="/profile/edit/presence?section=links" replace /> },
              { path: 'fetishes', element: <Navigate to="/profile/edit/interests" replace /> },
              { path: 'websites', element: <Navigate to="/profile/edit/presence?section=links" replace /> },
              { path: 'general', element: <Navigate to="/profile/edit" replace /> },
            ],
          },
          { path: ':username', element: <ProfileUsernamePage /> },
        ],
      },
      { path: 'messaging', element: <MessagingPage /> },
      { path: 'messages', element: <Navigate to="/messaging" replace /> },
      { path: 'organizations', element: <Navigate to="/orgs" replace /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'email/unsubscribe', element: <EmailUnsubscribePage /> },
      { path: 'email/confirm', element: <EmailConfirmPage /> },
      { path: 'connections', element: <ConnectionsPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'activity', element: <ActivityHubPage /> },
      { path: 'my-posts', element: <MyPostsPage /> },
      { path: 'create', element: <CreatePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="account" replace /> },
          { path: 'account', element: <SettingsAccountPage /> },
          { path: 'profile', element: <SettingsProfileHubPage /> },
          { path: 'privacy', element: <SettingsPrivacyPage /> },
          { path: 'notifications', element: <SettingsNotificationsPage /> },
          { path: 'activity', element: <SettingsActivityPage /> },
          { path: 'muted', element: <SettingsMutedPage /> },
          { path: 'blocked', element: <SettingsBlockedPage /> },
          { path: 'payment-history', element: <SettingsPaymentHistoryPage /> },
          { path: 'ecosystem', element: <SettingsEcosystemPage /> },
          { path: 'vendor', element: <SettingsVendorPage /> },
          { path: 'trust', element: <SettingsTrustPage /> },
        ],
      },
      { path: 'staff/:username', element: <StaffProfilePage /> },
      {
        path: 'admin/owner/investigations',
        children: [
          { index: true, element: <OwnerInvestigationsIndexPage /> },
          { path: 'users/:userId', element: <OwnerInvestigationUserPage /> },
        ],
      },
      {
        path: 'moderation',
        element: <ModerationShell />,
        children: [
          { index: true, element: <ModerationIndexPage /> },
          { path: 'dashboard', element: <ModerationDashboardPage /> },
          { path: 'queues', element: <ModerationQueuesPage /> },
          { path: 'cases', element: <ModerationCasesPage /> },
          { path: 'cases/:caseId', element: <ModerationCaseDetailPage /> },
          { path: 'reports', element: <ModerationReportsPage /> },
          { path: 'actions', element: <ModerationActionsPage /> },
          { path: 'profile-flags', element: <ModerationProfileFlagsPage /> },
          { path: 'audit', element: <ModerationAuditPage /> },
          { path: 'admin', element: <ModerationAdminPage /> },
          { path: 'legal', element: <ModerationLegalPage /> },
          { path: 'dmca', element: <ModerationDmcaPage /> },
          { path: 'contact', element: <ModerationContactPage /> },
          { path: 'mail-intake', element: <ModerationMailIntakePage /> },
        ],
      },
      { path: 'organizer', element: <OrganizerHubPage /> },
      { path: 'organizer/stripe-setup', element: <OrganizerStripeSetupPage /> },
      { path: 'organizer/orgs/:slug', element: <OrganizerOrgPage /> },
      { path: 'organizer/orgs/:slug/conventions/:convSlug', element: <OrganizerOrgConventionPage /> },
      {
        path: 'organizer/orgs/:slug/conventions/:convSlug/print/schedule',
        element: <OrganizerConventionPrintSchedulePage />,
      },
      {
        path: 'organizer/orgs/:slug/conventions/:convSlug/print/venue-signs',
        element: <OrganizerConventionPrintVenueSignsPage />,
      },
      { path: 'organizer/orgs/:slug/events/:eventId', element: <OrganizerOrgEventPage /> },
      { path: 'organizer/groups/:id', element: <OrganizerGroupPage /> },
      { path: 'organizer/groups/:id/events/:eventId', element: <OrganizerGroupEventPage /> },
      { path: 'organizer/conventions/:slug', element: <OrganizerConventionRedirectPage /> },
      { path: 'organizer/dancecard', element: <Navigate to="/organizer" replace /> },
      { path: 'organizer/dancecard/:slug', element: <OrganizerConventionRedirectPage /> },
      { path: 'join', element: <Navigate to="/login?signup=1" replace /> },
      { path: 'safety', element: <Navigate to="/support" replace /> },
      { path: 'community-guidelines', element: <Navigate to="/guidelines" replace /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'support/branding', element: <BrandingGuidePage /> },
      { path: 'policies', element: <PoliciesIndexPage /> },
      { path: 'policies/terms', element: <Navigate to="/terms" replace /> },
      { path: 'policies/privacy', element: <Navigate to="/privacy" replace /> },
      { path: 'policies/community-guidelines', element: <Navigate to="/guidelines" replace /> },
      { path: 'policies/adult-content-and-consent', element: <Navigate to="/adult-content-consent" replace /> },
      { path: 'policies/minor-safety', element: <Navigate to="/minor-safety" replace /> },
      { path: 'policies/dmca', element: <Navigate to="/dmca" replace /> },
      { path: 'policies/ncii', element: <Navigate to="/ncii" replace /> },
      { path: 'policies/law-enforcement', element: <Navigate to="/law-enforcement" replace /> },
      { path: 'policies/organizers', element: <Navigate to="/vendor-organizer-terms" replace /> },
      { path: 'policies/moderator-code-of-conduct', element: <ModeratorCodeOfConductPage /> },
      { path: 'policies/appeals', element: <AppealsPolicyPage /> },
      { path: 'policies/groups', element: <GroupGuidelinesPage /> },
      { path: 'policies/events', element: <EventGuidelinesPage /> },
      { path: 'policies/payments', element: <PaymentsPolicyPage /> },
      { path: 'policies/adult-content-records', element: <AdultContentRecordsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'guidelines', element: <GuidelinesPage /> },
      { path: 'adult-content-consent', element: <AdultContentConsentPage /> },
      { path: 'law-enforcement', element: <LawEnforcementPage /> },
      { path: 'security', element: <SecurityDisclosurePage /> },
      { path: 'dmca', element: <DmcaPage /> },
      { path: 'ncii', element: <NciiPage /> },
      { path: 'vendor-organizer-terms', element: <VendorOrganizerTermsPage /> },
      { path: 'minor-safety', element: <MinorSafetyPage /> },
      { path: 'accessibility', element: <AccessibilityPage /> },
      { path: 'calendar', element: <Navigate to="/events" replace /> },
      { path: 'calendar/erobay-community', element: <ErobayCommunityMirrorPage /> },
      { path: 'community', element: <Navigate to="/groups" replace /> },
      { path: 'dungeons', element: <DungeonsPage /> },
      { path: 'forums', element: <Navigate to="/groups" replace /> },
      { path: 'online', element: <Navigate to="/people" replace /> },
      { path: 'rendezvous', element: <Navigate to="/events" replace /> },
      { path: 'states', element: <Navigate to="/places" replace /> },
      { path: 'chat', element: <Navigate to="/messaging" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], {
  future: {
    v7_viewTransition: true,
  },
})
