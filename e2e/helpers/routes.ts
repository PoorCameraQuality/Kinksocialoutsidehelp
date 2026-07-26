/**
 * Major routes for smoke tests. Dynamic segments use SEED slugs or placeholders.
 * @see docs/audits/ui/generated/ROUTES_TABLE.md (full inventory)
 */

export type RouteSpec = {
  path: string
  name: string
  auth?: 'none' | 'session'
  expectHeading?: RegExp | string
  skipIfNoDb?: boolean
}

export const PUBLIC_ROUTES: RouteSpec[] = [
  { path: '/', name: 'landing', expectHeading: 'Join free' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
]

/** Routes that redirect anonymous visitors to the landing login tab. */
export const LOGIN_GATED_ROUTES: RouteSpec[] = [
  { path: '/explore', name: 'explore' },
  { path: '/events', name: 'events', expectHeading: 'Events' },
  { path: '/groups', name: 'groups', expectHeading: 'Groups' },
  { path: '/education', name: 'education' },
  { path: '/vendors', name: 'vendors' },
  { path: '/people', name: 'people' },
  { path: '/orgs', name: 'orgs', expectHeading: 'Organizations' },
  { path: '/conventions', name: 'conventions' },
]

export const AUTHENTICATED_ROUTES: RouteSpec[] = [
  { path: '/home', name: 'home', auth: 'session' },
  { path: '/create', name: 'create', auth: 'session', expectHeading: 'Create', skipIfNoDb: true },
  { path: '/saved', name: 'saved', auth: 'session' },
  { path: '/settings', name: 'settings', auth: 'session', expectHeading: 'Settings' },
  { path: '/notifications', name: 'notifications', auth: 'session', expectHeading: 'Notifications' },
  { path: '/messaging', name: 'messaging', auth: 'session', expectHeading: 'Messages' },
  { path: '/connections', name: 'connections', auth: 'session', expectHeading: 'Connections' },
  ...LOGIN_GATED_ROUTES.map((route) => ({ ...route, auth: 'session' as const })),
]

export function publicRoutesWithSeed(_orgSlug: string, _convSlug: string): RouteSpec[] {
  return PUBLIC_ROUTES
}

export function authenticatedRoutesWithSeed(orgSlug: string, convSlug: string): RouteSpec[] {
  return [
    ...AUTHENTICATED_ROUTES,
    { path: `/orgs/${orgSlug}`, name: 'org-hub', auth: 'session', skipIfNoDb: true },
    { path: `/conventions/${convSlug}`, name: 'convention-hub', auth: 'session', skipIfNoDb: true },
    { path: '/conventions/nonexistent-e2e-slug', name: 'convention-missing', auth: 'session' },
  ]
}

export function organizerRoutes(orgSlug: string, convSlug: string): RouteSpec[] {
  const base = `/organizer/orgs/${orgSlug}`
  const conv = `${base}/conventions/${convSlug}`
  return [
    { path: '/organizer', name: 'organizer-hub', auth: 'session', skipIfNoDb: true },
    { path: base, name: 'org-console', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=events`, name: 'org-tab-events', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=people`, name: 'org-tab-people', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=communications`, name: 'org-tab-comms', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=moderation`, name: 'org-tab-mod', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=settings`, name: 'org-tab-settings', auth: 'session', skipIfNoDb: true },
    { path: `${base}?tab=tools`, name: 'org-tab-tools', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=dashboard`, name: 'conv-dashboard', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=program`, name: 'conv-program', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=applications`, name: 'conv-applications', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=venues`, name: 'conv-venues', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=import`, name: 'conv-import', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=people&peopleTab=signups`, name: 'conv-people-signups', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=people&peopleTab=roster`, name: 'conv-people-roster', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=people&peopleTab=staff`, name: 'conv-people-staff', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=messaging`, name: 'conv-messaging', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=settings`, name: 'conv-settings', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=exports`, name: 'conv-exports', auth: 'session', skipIfNoDb: true },
    { path: `${conv}?tab=integrations`, name: 'conv-integrations', auth: 'session', skipIfNoDb: true },
    { path: `${conv}/door`, name: 'conv-door', auth: 'session', skipIfNoDb: true },
  ]
}
