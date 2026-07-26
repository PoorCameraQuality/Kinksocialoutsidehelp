/**
 * Pure definitions for the alpha social seed world — safe for unit tests without a DB.
 */
import type { FeedActivityPrivacy, FeedSettings, PrivacySettings } from '@c2k/shared'
import {
  defaultFeedActivityPrivacy,
  defaultFeedSettings,
  defaultPrivacySettings,
} from '@c2k/shared'
import { ALPHA_SOCIAL_BATCH_KEY } from './alpha-seed-labels.js'

export { ALPHA_SOCIAL_BATCH_KEY }

export const ALPHA_SOCIAL_MARKER_PREFIX = '[alpha_social_seed:'
export const ALPHA_SOCIAL_USERNAME_PREFIX = 'alpha_'
export const ALPHA_SOCIAL_EMAIL_DOMAIN = 'example.test'
export const ALPHA_SOCIAL_PASSWORD_ENV = 'ALPHA_SOCIAL_SEED_PASSWORD'
export const ALPHA_SOCIAL_PASSWORD_DEFAULT = 'AlphaSocial!23'

export function alphaSocialMarker(key: string): string {
  return `${ALPHA_SOCIAL_MARKER_PREFIX}${key}]`
}

export function alphaSocialEmail(username: string): string {
  return `alpha+${username}@${ALPHA_SOCIAL_EMAIL_DOMAIN}`
}

export function isAlphaSocialUsername(username: string): boolean {
  return username.startsWith(ALPHA_SOCIAL_USERNAME_PREFIX)
}

export function isAlphaSocialEmail(email: string): boolean {
  return email.endsWith(`@${ALPHA_SOCIAL_EMAIL_DOMAIN}`) && email.startsWith('alpha+')
}

export type AlphaSocialUserDef = {
  username: string
  displayName: string
  bio?: string
  location?: string
  visibility?: 'PUBLIC' | 'MEMBERS' | 'PRIVATE'
  discoverable?: boolean
  roles?: string[]
  sparse?: boolean
  privacyPatch?: Partial<PrivacySettings>
  feedPatch?: Partial<FeedSettings>
}

export const ALPHA_SOCIAL_USERS: AlphaSocialUserDef[] = [
  {
    username: 'alpha_newbie',
    displayName: 'Casey (new member)',
    bio: 'Just joined — still filling out my profile.',
    location: 'Mid-Atlantic region',
    sparse: true,
    discoverable: true,
  },
  {
    username: 'alpha_organizer',
    displayName: 'Jordan Rivers',
    bio: 'Community organizer focused on consent-forward munches and newcomer welcome tables.',
    location: 'Philadelphia metro (fictional)',
    roles: ['organizer'],
    discoverable: true,
  },
  {
    username: 'alpha_mod',
    displayName: 'Sam Mercer',
    bio: 'Group moderator — here for logistics, not drama.',
    location: 'Baltimore area (fictional)',
    roles: ['moderator'],
    discoverable: true,
  },
  {
    username: 'alpha_educator',
    displayName: 'Dr. Riley Chen',
    bio: 'Presenter and educator — negotiation, boundaries, and workshop facilitation.',
    location: 'DC metro (fictional)',
    roles: ['presenter', 'educator'],
    discoverable: true,
  },
  {
    username: 'alpha_vendor',
    displayName: 'Harper Gear Co.',
    bio: 'Fictional vendor demo account for alpha social testing.',
    location: 'Ships within US (fictional)',
    roles: ['vendor'],
    discoverable: true,
  },
  {
    username: 'alpha_photog',
    displayName: 'Alex Lens',
    bio: 'Event photographer — portfolio and release-form reminders only.',
    location: 'Northeast corridor (fictional)',
    roles: ['photographer'],
    discoverable: true,
  },
  {
    username: 'alpha_quiet',
    displayName: 'Morgan Vale',
    bio: 'Low-profile member — selective about discovery.',
    location: 'Private',
    visibility: 'PRIVATE',
    discoverable: false,
  },
  {
    username: 'alpha_connected',
    displayName: 'Taylor Brooks',
    bio: 'Posts mostly for connections — testing feed privacy.',
    location: 'Richmond area (fictional)',
    discoverable: true,
    privacyPatch: {
      feedActivityPrivacy: {
        ...defaultFeedActivityPrivacy,
        showPostsInFeeds: 'connections_only',
      } satisfies FeedActivityPrivacy,
    },
  },
  {
    username: 'alpha_private',
    displayName: 'Jamie Slate',
    bio: 'Only-me post privacy tester.',
    location: 'Harrisburg area (fictional)',
    discoverable: true,
    privacyPatch: {
      feedActivityPrivacy: {
        ...defaultFeedActivityPrivacy,
        showPostsInFeeds: 'only_me',
      } satisfies FeedActivityPrivacy,
    },
  },
  {
    username: 'alpha_blocker',
    displayName: 'Reese Hart',
    bio: 'Has blocked another alpha test account.',
    location: 'Wilmington area (fictional)',
    discoverable: true,
  },
  {
    username: 'alpha_blocked',
    displayName: 'Drew Cain',
    bio: 'Blocked by alpha_blocker for privacy testing.',
    location: 'Wilmington area (fictional)',
    discoverable: true,
  },
  {
    username: 'alpha_open_dm',
    displayName: 'Quinn Park',
    bio: 'Open messaging — anyone logged in may request a chat.',
    location: 'Newark area (fictional)',
    discoverable: true,
    privacyPatch: { whoCanMessage: 'open' },
  },
  {
    username: 'alpha_connections_dm',
    displayName: 'Skyler Finch',
    bio: 'Connections-only messaging.',
    location: 'Princeton area (fictional)',
    discoverable: true,
    privacyPatch: { whoCanMessage: 'connections_only' },
  },
  {
    username: 'alpha_hidden_member',
    displayName: 'Rowan Ellis',
    bio: 'Member of a private group with hidden membership.',
    location: 'Trenton area (fictional)',
    discoverable: true,
  },
  {
    username: 'alpha_social',
    displayName: 'Avery North',
    bio: 'Active community member — good default login for Home and Following.',
    location: 'Coastal NJ (fictional)',
    discoverable: true,
  },
]

export type AlphaSocialGroupDef = {
  slug: string
  name: string
  description: string
  visibility: 'public' | 'private' | 'invite-only'
  category?: string
  ownerUsername: string
}

export const ALPHA_SOCIAL_GROUPS: AlphaSocialGroupDef[] = [
  {
    slug: 'alpha-social-regional-hub',
    name: 'Alpha Social — Regional Hub (test)',
    description: 'Public fictional group for munch planning and newcomer questions.',
    visibility: 'public',
    category: 'social',
    ownerUsername: 'alpha_organizer',
  },
  {
    slug: 'alpha-social-education-guild',
    name: 'Alpha Social — Education Guild (test)',
    description: 'Workshop announcements and class logistics (fictional).',
    visibility: 'public',
    category: 'education',
    ownerUsername: 'alpha_educator',
  },
  {
    slug: 'alpha-social-private-circle',
    name: 'Alpha Social — Private Circle (test)',
    description: 'Invite-only fictional group for membership privacy tests.',
    visibility: 'private',
    category: 'social',
    ownerUsername: 'alpha_mod',
  },
  {
    slug: 'alpha-social-invite-rope',
    name: 'Alpha Social — Invite Rope Circle (test)',
    description: 'Invite-only rope discussion (fictional, PG-13).',
    visibility: 'invite-only',
    category: 'rope',
    ownerUsername: 'alpha_mod',
  },
]

export type AlphaSocialPostDef = {
  key: string
  authorUsername: string
  body: string
  title?: string
  kind?: 'status' | 'repost'
  repostOfKey?: string
}

function postBody(key: string, text: string): string {
  return `${alphaSocialMarker(key)} ${text}`
}

export const ALPHA_SOCIAL_POSTS: AlphaSocialPostDef[] = [
  {
    key: 'post-intro-organizer',
    authorUsername: 'alpha_organizer',
    body: postBody(
      'post-intro-organizer',
      'Welcome to the alpha social seed world. This post is fictional test data for consent-forward community tooling.',
    ),
  },
  {
    key: 'post-newbie-intro',
    authorUsername: 'alpha_newbie',
    body: postBody('post-newbie-intro', 'Hi everyone — first post here. Still learning the ropes (pun intended).'),
  },
  {
    key: 'post-consent-reminder',
    authorUsername: 'alpha_educator',
    body: postBody(
      'post-consent-reminder',
      'Reminder: ask before touching gear, people, or conversations. A clear yes beats an assumed maybe.',
    ),
  },
  {
    key: 'post-event-prep',
    authorUsername: 'alpha_organizer',
    body: postBody(
      'post-event-prep',
      'Packing list for this weekend: name tag, water bottle, cash for vendors, and patience for the parking lot.',
    ),
  },
  {
    key: 'post-group-welcome',
    authorUsername: 'alpha_mod',
    body: postBody('post-group-welcome', 'New members: read the group rules thread before introducing yourselves.'),
  },
  {
    key: 'post-education-tip',
    authorUsername: 'alpha_educator',
    body: postBody(
      'post-education-tip',
      'Workshop tip: bring a notebook. Questions at the end keep the room on schedule.',
    ),
  },
  {
    key: 'post-vendor-update',
    authorUsername: 'alpha_vendor',
    body: postBody('post-vendor-update', 'Demo shop update: convention bundle listings are fictional placeholders for UI tests.'),
  },
  {
    key: 'post-photog-note',
    authorUsername: 'alpha_photog',
    body: postBody(
      'post-photog-note',
      'Photo desk reminder: no flash during presentations. Release forms at the table.',
    ),
  },
  {
    key: 'post-social-checkin',
    authorUsername: 'alpha_social',
    body: postBody('post-social-checkin', 'Good morning — who is heading to a munch this week?'),
  },
  {
    key: 'post-connections-only',
    authorUsername: 'alpha_connected',
    body: postBody(
      'post-connections-only',
      'Connections-only visibility test post. Strangers should not see this in the global feed.',
    ),
  },
  {
    key: 'post-only-me',
    authorUsername: 'alpha_private',
    body: postBody('post-only-me', 'Only-me visibility test post. Only the author should read this in feeds.'),
  },
  {
    key: 'post-repost-source',
    authorUsername: 'alpha_educator',
    body: postBody('post-repost-source', 'Sharing a class outline draft — feedback welcome from connections.'),
  },
  {
    key: 'post-logistics-question',
    authorUsername: 'alpha_newbie',
    body: postBody('post-logistics-question', 'Is street parking usually available near weekend munches, or should I plan rideshare?'),
  },
  {
    key: 'post-mod-announcement',
    authorUsername: 'alpha_mod',
    body: postBody('post-mod-announcement', 'Moderator note: report spam via the flag button — do not call people out in threads.'),
  },
  {
    key: 'post-quiet-update',
    authorUsername: 'alpha_quiet',
    body: postBody('post-quiet-update', 'Low-key week for me. Hope everyone has a safe event season.'),
  },
  {
    key: 'post-hidden-member',
    authorUsername: 'alpha_hidden_member',
    body: postBody('post-hidden-member', 'Grateful for spaces that respect hidden membership lists.'),
  },
  {
    key: 'post-open-dm',
    authorUsername: 'alpha_open_dm',
    body: postBody('post-open-dm', 'My DMs are open for logistics questions — please keep it PG-13.'),
  },
  {
    key: 'post-connections-dm',
    authorUsername: 'alpha_connections_dm',
    body: postBody('post-connections-dm', 'Message requests from connections only — thanks for respecting the setting.'),
  },
  {
    key: 'post-organizer-rsvp',
    authorUsername: 'alpha_organizer',
    body: postBody('post-organizer-rsvp', 'RSVP headcount helps us reserve the right room size. Maybe counts too.'),
  },
  {
    key: 'post-repost',
    authorUsername: 'alpha_social',
    kind: 'repost',
    repostOfKey: 'post-repost-source',
    body: postBody('post-repost', ''),
  },
]

export type AlphaSocialCommentDef = {
  key: string
  postKey: string
  authorUsername: string
  body: string
}

export const ALPHA_SOCIAL_COMMENTS: AlphaSocialCommentDef[] = [
  {
    key: 'comment-welcome',
    postKey: 'post-newbie-intro',
    authorUsername: 'alpha_organizer',
    body: `${alphaSocialMarker('comment-welcome')} Welcome Casey — glad you introduced yourself.`,
  },
  {
    key: 'comment-parking',
    postKey: 'post-logistics-question',
    authorUsername: 'alpha_social',
    body: `${alphaSocialMarker('comment-parking')} Usually limited street parking — rideshare is safer for first-timers.`,
  },
  {
    key: 'comment-consent',
    postKey: 'post-consent-reminder',
    authorUsername: 'alpha_mod',
    body: `${alphaSocialMarker('comment-consent')} Pinning this ethos for the regional hub group.`,
  },
  {
    key: 'comment-vendor',
    postKey: 'post-vendor-update',
    authorUsername: 'alpha_photog',
    body: `${alphaSocialMarker('comment-vendor')} Demo listings only — no real checkout in alpha.`,
  },
  {
    key: 'comment-class',
    postKey: 'post-education-tip',
    authorUsername: 'alpha_newbie',
    body: `${alphaSocialMarker('comment-class')} Good tip — I will bring a notebook to my first class.`,
  },
  {
    key: 'comment-repost',
    postKey: 'post-repost-source',
    authorUsername: 'alpha_connected',
    body: `${alphaSocialMarker('comment-repost')} Happy to review outline if you want a second pair of eyes.`,
  },
]

export type AlphaSocialReactionDef = {
  postKey: string
  username: string
  kind?: string
}

export const ALPHA_SOCIAL_REACTIONS: AlphaSocialReactionDef[] = [
  { postKey: 'post-intro-organizer', username: 'alpha_social' },
  { postKey: 'post-intro-organizer', username: 'alpha_mod' },
  { postKey: 'post-consent-reminder', username: 'alpha_organizer' },
  { postKey: 'post-consent-reminder', username: 'alpha_newbie' },
  { postKey: 'post-event-prep', username: 'alpha_social' },
  { postKey: 'post-newbie-intro', username: 'alpha_mod' },
  { postKey: 'post-education-tip', username: 'alpha_educator' },
  { postKey: 'post-vendor-update', username: 'alpha_vendor' },
  { postKey: 'post-social-checkin', username: 'alpha_open_dm' },
  { postKey: 'post-group-welcome', username: 'alpha_hidden_member' },
  { postKey: 'post-photog-note', username: 'alpha_photog' },
  { postKey: 'post-organizer-rsvp', username: 'alpha_connections_dm' },
]

export type AlphaSocialConnectionDef = {
  requester: string
  recipient: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'IGNORED'
}

export const ALPHA_SOCIAL_CONNECTIONS: AlphaSocialConnectionDef[] = [
  { requester: 'alpha_social', recipient: 'alpha_organizer', status: 'ACCEPTED' },
  { requester: 'alpha_social', recipient: 'alpha_educator', status: 'ACCEPTED' },
  { requester: 'alpha_social', recipient: 'alpha_mod', status: 'ACCEPTED' },
  { requester: 'alpha_newbie', recipient: 'alpha_organizer', status: 'PENDING' },
  { requester: 'alpha_newbie', recipient: 'alpha_social', status: 'PENDING' },
  { requester: 'alpha_vendor', recipient: 'alpha_photog', status: 'ACCEPTED' },
  { requester: 'alpha_connected', recipient: 'alpha_educator', status: 'ACCEPTED' },
  { requester: 'alpha_open_dm', recipient: 'alpha_mod', status: 'ACCEPTED' },
  { requester: 'alpha_hidden_member', recipient: 'alpha_mod', status: 'ACCEPTED' },
  { requester: 'alpha_blocked', recipient: 'alpha_social', status: 'DECLINED' },
  { requester: 'alpha_quiet', recipient: 'alpha_organizer', status: 'IGNORED' },
]

export type AlphaSocialFollowDef = {
  follower: string
  following: string
}

export const ALPHA_SOCIAL_FOLLOWS: AlphaSocialFollowDef[] = [
  { follower: 'alpha_social', following: 'alpha_organizer' },
  { follower: 'alpha_social', following: 'alpha_educator' },
  { follower: 'alpha_social', following: 'alpha_mod' },
  { follower: 'alpha_newbie', following: 'alpha_organizer' },
  { follower: 'alpha_connected', following: 'alpha_educator' },
  { follower: 'alpha_open_dm', following: 'alpha_social' },
  { follower: 'alpha_photog', following: 'alpha_vendor' },
  { follower: 'alpha_organizer', following: 'alpha_educator' },
]

export type AlphaSocialForumThreadDef = {
  key: string
  groupSlug: string
  title: string
  authorUsername: string
  posts: { authorUsername: string; bodyKey: string; body: string }[]
  /** When true, thread should surface in Following for connected viewers. */
  followingVisible?: boolean
}

export const ALPHA_SOCIAL_FORUM_THREADS: AlphaSocialForumThreadDef[] = [
  {
    key: 'thread-regional-intro',
    groupSlug: 'alpha-social-regional-hub',
    title: 'Introduce yourself (alpha test)',
    authorUsername: 'alpha_mod',
    followingVisible: true,
    posts: [
      {
        authorUsername: 'alpha_mod',
        bodyKey: 'forum-regional-intro',
        body: `${alphaSocialMarker('forum-regional-intro')} Share your region and one community goal — fictional test thread.`,
      },
      {
        authorUsername: 'alpha_newbie',
        bodyKey: 'forum-regional-reply',
        body: `${alphaSocialMarker('forum-regional-reply')} Casey here — learning event etiquette and meeting mentors.`,
      },
      {
        authorUsername: 'alpha_social',
        bodyKey: 'forum-regional-reply2',
        body: `${alphaSocialMarker('forum-regional-reply2')} Avery — happy to point newcomers to consent resources.`,
      },
    ],
  },
  {
    key: 'thread-education-logistics',
    groupSlug: 'alpha-social-education-guild',
    title: 'Class materials and notebooks (alpha test)',
    authorUsername: 'alpha_educator',
    followingVisible: true,
    posts: [
      {
        authorUsername: 'alpha_educator',
        bodyKey: 'forum-edu-main',
        body: `${alphaSocialMarker('forum-edu-main')} Please bring a notebook to hands-on workshops. Slides posted after class.`,
      },
      {
        authorUsername: 'alpha_connected',
        bodyKey: 'forum-edu-reply',
        body: `${alphaSocialMarker('forum-edu-reply')} Will there be handouts for negotiation 101?`,
      },
    ],
  },
  {
    key: 'thread-private-members',
    groupSlug: 'alpha-social-private-circle',
    title: 'Members-only check-in (alpha test)',
    authorUsername: 'alpha_mod',
    posts: [
      {
        authorUsername: 'alpha_mod',
        bodyKey: 'forum-private-main',
        body: `${alphaSocialMarker('forum-private-main')} Private group logistics — non-members should not see this in Following.`,
      },
      {
        authorUsername: 'alpha_hidden_member',
        bodyKey: 'forum-private-reply',
        body: `${alphaSocialMarker('forum-private-reply')} Confirming hidden membership is working on my profile.`,
      },
    ],
  },
]

export type AlphaSocialAlphaEventDef = {
  key: string
  title: string
  category: string
  eventFormat: 'in-person' | 'virtual'
  attendeeListVisibility: 'public' | 'count_only'
  groupSlug?: string
  hostUsername: string
  virtualSessionStyle?: 'social' | 'education'
}

export const ALPHA_SOCIAL_ONLY_EVENTS: AlphaSocialAlphaEventDef[] = [
  {
    key: 'event-regional-munch',
    title: 'Alpha Social Seed — Regional Munch (test)',
    category: 'Munch',
    eventFormat: 'in-person',
    attendeeListVisibility: 'public',
    groupSlug: 'alpha-social-regional-hub',
    hostUsername: 'alpha_organizer',
  },
  {
    key: 'event-workshop-night',
    title: 'Alpha Social Seed — Workshop Night (test)',
    category: 'Workshop',
    eventFormat: 'in-person',
    attendeeListVisibility: 'count_only',
    hostUsername: 'alpha_educator',
  },
  {
    key: 'event-vendor-market',
    title: 'Alpha Social Seed — Vendor Market (test)',
    category: 'Vendor market',
    eventFormat: 'in-person',
    attendeeListVisibility: 'public',
    hostUsername: 'alpha_vendor',
  },
  {
    key: 'event-online-class',
    title: 'Alpha Social Seed — Online Negotiation 101 (test)',
    category: 'Class',
    eventFormat: 'virtual',
    virtualSessionStyle: 'education',
    attendeeListVisibility: 'count_only',
    hostUsername: 'alpha_educator',
  },
]

export type AlphaSocialRsvpDef = {
  eventKey: string
  username: string
  status: 'going' | 'maybe' | 'not_going' | 'waitlist'
  reuseExisting?: boolean
}

export const ALPHA_SOCIAL_RSVPS: AlphaSocialRsvpDef[] = [
  { eventKey: 'event-regional-munch', username: 'alpha_social', status: 'going' },
  { eventKey: 'event-regional-munch', username: 'alpha_newbie', status: 'maybe' },
  { eventKey: 'event-regional-munch', username: 'alpha_mod', status: 'going' },
  { eventKey: 'event-workshop-night', username: 'alpha_connected', status: 'going' },
  { eventKey: 'event-workshop-night', username: 'alpha_educator', status: 'going' },
  { eventKey: 'event-vendor-market', username: 'alpha_vendor', status: 'going' },
  { eventKey: 'event-vendor-market', username: 'alpha_photog', status: 'going' },
  { eventKey: 'event-online-class', username: 'alpha_newbie', status: 'waitlist' },
  { eventKey: 'event-online-class', username: 'alpha_social', status: 'going' },
  { eventKey: 'reuse-existing-0', username: 'alpha_organizer', status: 'going', reuseExisting: true },
  { eventKey: 'reuse-existing-1', username: 'alpha_social', status: 'maybe', reuseExisting: true },
]

export type AlphaSocialDmDef = {
  key: string
  initiator: string
  partner: string
  acceptanceStatus: 'ACCEPTED' | 'PENDING'
  messages: { sender: string; bodyKey: string; body: string }[]
}

export const ALPHA_SOCIAL_DMS: AlphaSocialDmDef[] = [
  {
    key: 'dm-accepted',
    initiator: 'alpha_social',
    partner: 'alpha_open_dm',
    acceptanceStatus: 'ACCEPTED',
    messages: [
      {
        sender: 'alpha_social',
        bodyKey: 'dm-accepted-1',
        body: `${alphaSocialMarker('dm-accepted-1')} Hey Quinn — are you going to the regional munch?`,
      },
      {
        sender: 'alpha_open_dm',
        bodyKey: 'dm-accepted-2',
        body: `${alphaSocialMarker('dm-accepted-2')} Thinking about it — still checking my schedule.`,
      },
    ],
  },
  {
    key: 'dm-pending-request',
    initiator: 'alpha_newbie',
    partner: 'alpha_connections_dm',
    acceptanceStatus: 'PENDING',
    messages: [
      {
        sender: 'alpha_newbie',
        bodyKey: 'dm-pending-1',
        body: `${alphaSocialMarker('dm-pending-1')} Hi — saw your education guild post. Quick question about first classes?`,
      },
    ],
  },
  {
    key: 'dm-pending-organizer',
    initiator: 'alpha_organizer',
    partner: 'alpha_quiet',
    acceptanceStatus: 'PENDING',
    messages: [
      {
        sender: 'alpha_organizer',
        bodyKey: 'dm-pending-org-1',
        body: `${alphaSocialMarker('dm-pending-org-1')} Morgan — volunteer shift open for the demo munch if you are interested.`,
      },
    ],
  },
]

export type AlphaSocialNotificationDef = {
  key: string
  userUsername: string
  type: string
  payload: Record<string, unknown>
}

export function defaultAlphaSocialFeedSettings(): FeedSettings {
  return { ...defaultFeedSettings }
}

export function defaultAlphaSocialPrivacySettings(patch?: Partial<PrivacySettings>): PrivacySettings {
  return { ...defaultPrivacySettings, ...patch }
}
