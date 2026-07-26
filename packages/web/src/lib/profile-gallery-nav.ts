import { PUBLIC_PROFILE_TABS, type PublicProfileTab } from '@/lib/public-profile-tabs'

export const PROFILE_MEDIA_GALLERY_ID = 'profile-media-gallery'

export function scrollToProfileMediaGallery() {
  window.setTimeout(() => {
    document.getElementById(PROFILE_MEDIA_GALLERY_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}

export function profileMediaTabUrl(pathname: string): string {
  return `${pathname}?tab=${encodeURIComponent('Media' satisfies PublicProfileTab)}`
}

export function isPublicProfileTab(value: string): value is PublicProfileTab {
  return (PUBLIC_PROFILE_TABS as readonly string[]).includes(value)
}
