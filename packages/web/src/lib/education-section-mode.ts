export type EducationHubView =
  | 'overview'
  | 'paths'
  | 'articles'
  | 'videos'
  | 'podcasts'
  | 'library'
  | 'progress'

export type EducationNavMatch = EducationHubView | 'saved'

const VALID_VIEWS: ReadonlySet<string> = new Set([
  'overview',
  'paths',
  'articles',
  'videos',
  'podcasts',
  'library',
  'progress',
])

export function parseEducationHubView(params: URLSearchParams): EducationHubView {
  const view = params.get('view')
  if (view && VALID_VIEWS.has(view) && view !== 'overview') {
    return view as EducationHubView
  }
  return 'overview'
}

export function resolveEducationNavMatch(pathname: string, search: string): EducationNavMatch {
  if (pathname === '/saved') return 'saved'
  if (pathname === '/media' || pathname.startsWith('/media/')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    const format = params.get('format')
    if (format === 'podcast') return 'podcasts'
    if (format === 'video' || format === 'hybrid' || pathname.startsWith('/media/')) return 'videos'
    return 'videos'
  }
  if (pathname !== '/education') return 'overview'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const view = parseEducationHubView(params)
  return view
}

export const EDUCATION_VIEW_META: Record<
  Exclude<EducationHubView, 'overview'>,
  { title: string; subtitle: string; comingSoon?: boolean }
> = {
  paths: {
    title: 'Learning paths',
    subtitle: 'Curated sequences to build skills step by step. Progress is saved to your account when paths launch.',
  },
  articles: {
    title: 'Articles',
    subtitle: 'In-depth knowledge and real experience from trusted educators.',
  },
  videos: {
    title: 'Videos',
    subtitle: 'Workshop recordings and community video channels from educators and creators.',
  },
  podcasts: {
    title: 'Podcasts',
    subtitle: 'Long-form audio from community shows — safety, culture, and scene conversations.',
  },
  library: {
    title: 'Class library',
    subtitle: 'Workshop outlines, demo scripts, and facilitator notes from educators — each links to a full article.',
  },
  progress: {
    title: 'My progress',
    subtitle: 'Paths in flight, completed modules, and recent learning activity — preview data until account sync ships.',
  },
}
