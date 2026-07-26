/** Whether `pathname` should highlight nav `href` (prefix routes, home aliases). */
export function navLinkIsActive(pathname: string, href: string): boolean {
  if (href === '/home') return pathname === '/home' || pathname === '/' || pathname === '/feed'
  if (href === '/orgs') return pathname.startsWith('/orgs')
  if (href === '/events') return pathname === '/events' || pathname.startsWith('/events/')
  if (href === '/conventions') return pathname === '/conventions' || pathname.startsWith('/conventions/')
  if (href === '/vendors') return pathname === '/vendors' || pathname.startsWith('/vendors/')
  if (href === '/groups') return pathname === '/groups' || pathname.startsWith('/groups/')
  if (href === '/education') return pathname === '/education' || pathname.startsWith('/education/')
  if (href === '/presenters') return pathname === '/presenters' || pathname.startsWith('/presenters/')
  if (href === '/profile') return pathname.startsWith('/profile')
  if (href === '/messaging') return pathname.startsWith('/messaging')
  if (href === '/notifications') return pathname.startsWith('/notifications')
  if (href === '/connections') return pathname.startsWith('/connections')
  if (href === '/discovery') return pathname === '/discovery'
  if (href === '/places') return pathname === '/places' || pathname.startsWith('/places/')
  return pathname === href
}
