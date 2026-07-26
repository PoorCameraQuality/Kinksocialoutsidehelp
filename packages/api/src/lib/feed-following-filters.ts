/** Following feed filter buckets - see docs/FETLIFE_CLASS_HOME.md §2.4 */

export const REACTION_VERBS = new Set(['connection_accepted', 'loved', 'reacted', 'followed'])
export const EVENT_VERBS = new Set(['event_created', 'event_rsvp', 'presenter_assigned', 'convention_pin'])
export const GROUP_VERBS = new Set(['group_join', 'group_thread_created', 'org_join', 'org_announcement'])

export type FollowingFilterId =
  | 'all'
  | 'posts'
  | 'photos'
  | 'video'
  | 'articles'
  | 'reactions'
  | 'events'
  | 'groups'

export type PostFilterShape = {
  postKind?: string
  attachments?: unknown
  body?: string
  bodyFormat?: string
}

function parseAttachmentTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is { type: string } => typeof x === 'object' && x != null && typeof x.type === 'string')
    .map((x) => x.type)
}

/** Image posts: image attachments or inline `<img>` in HTML body (not articles). */
export function postHasPhotoContent(opts: PostFilterShape): boolean {
  const kind = opts.postKind ?? ''
  if (kind === 'article' || kind === 'repost') return false
  if (parseAttachmentTypes(opts.attachments).includes('image')) return true
  if (opts.bodyFormat === 'html' && opts.body && /<img[\s>]/i.test(opts.body)) return true
  return false
}

/** Video posts: video attachment or common embed patterns in HTML body. */
export function postHasVideoContent(opts: PostFilterShape): boolean {
  if ((opts.postKind ?? '') === 'repost') return false
  if (parseAttachmentTypes(opts.attachments).includes('video')) return true
  if (opts.bodyFormat === 'html' && opts.body) {
    if (/<video[\s>]/i.test(opts.body)) return true
    if (/(youtube\.com|youtu\.be|vimeo\.com)/i.test(opts.body)) return true
  }
  return false
}

export function matchesFollowingFilter(
  source: 'post' | 'activity',
  filter: string,
  hideKinds: Set<string>,
  opts: PostFilterShape & { verb?: string; objectType?: string },
): boolean {
  if (source === 'post') {
    const kind = opts.postKind ?? ''
    if (hideKinds.has(kind)) return false
    if (filter === 'all') return true
    if (filter === 'posts') return true
    if (filter === 'articles') return kind === 'article'
    if (filter === 'photos') return postHasPhotoContent(opts) && !postHasVideoContent(opts)
    if (filter === 'video') return postHasVideoContent(opts)
    return false
  }

  const verb = opts.verb ?? ''
  const objectType = opts.objectType ?? ''
  if (hideKinds.has(verb)) return false
  if (verb === 'post' && objectType === 'feed_post') return false

  if (filter === 'all') return true
  if (filter === 'posts' || filter === 'photos' || filter === 'video' || filter === 'articles') return false
  if (filter === 'reactions') return REACTION_VERBS.has(verb)
  if (filter === 'events') return EVENT_VERBS.has(verb)
  if (filter === 'groups') return GROUP_VERBS.has(verb)
  return true
}

export function bucketForActivity(verb: string): FollowingFilterId | null {
  if (REACTION_VERBS.has(verb)) return 'reactions'
  if (EVENT_VERBS.has(verb)) return 'events'
  if (GROUP_VERBS.has(verb)) return 'groups'
  return null
}

export function bucketForPost(opts: PostFilterShape): FollowingFilterId | null {
  const kind = opts.postKind ?? ''
  if (kind === 'article') return 'articles'
  if (postHasVideoContent(opts)) return 'video'
  if (postHasPhotoContent(opts)) return 'photos'
  return null
}

export const FOLLOWING_COUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
