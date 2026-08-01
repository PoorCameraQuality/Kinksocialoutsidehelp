import { sql } from 'drizzle-orm'
import type { ConventionParticipationSettings } from '@c2k/shared'
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/* --- Reference: US locations (Census-derived seed) --- */

export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 2 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
})

export const states = pgTable(
  'states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade' }),
    fips: varchar('fips', { length: 2 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
  },
  (t) => [
    uniqueIndex('states_country_fips_idx').on(t.countryId, t.fips),
    index('states_country_id_idx').on(t.countryId),
  ]
)

export const places = pgTable(
  'places',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateId: uuid('state_id')
      .notNull()
      .references(() => states.id, { onDelete: 'cascade' }),
    geoid: varchar('geoid', { length: 15 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    population: integer('population').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
  },
  (t) => [
    uniqueIndex('places_state_geoid_idx').on(t.stateId, t.geoid),
    index('places_state_id_idx').on(t.stateId),
    index('places_state_pop_idx').on(t.stateId, t.population),
  ]
)

/* --- E1: Auth & profiles --- */

export const profileVisibilityEnum = pgEnum('profile_visibility', ['PUBLIC', 'MEMBERS', 'PRIVATE'])

export const ageVerificationStatusEnum = pgEnum('age_verification_status', [
  'UNVERIFIED',
  'SELF_ATTESTED',
  'VERIFIED',
  'REJECTED',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 64 }).notNull().unique(),
    /** Legacy plaintext email - migrated to email_ciphertext; nullable for new rows. */
    email: varchar('email', { length: 255 }),
    /** AES-256-GCM encrypted normalized email (see field-encryption.ts). */
    emailCiphertext: text('email_ciphertext'),
    /** HMAC lookup hash for login/recovery without plaintext storage. */
    emailLookupHash: varchar('email_lookup_hash', { length: 64 }),
    emailKeyVersion: integer('email_key_version').notNull().default(1),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Normalized IP at signup (IPv4 full; IPv6 canonical; optional /64 stored separately if needed). */
    registrationIpPrefix: varchar('registration_ip_prefix', { length: 64 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    /** Soft-delete timestamp; login disabled; profile hidden. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    /** Member-initiated deactivation (reversible before purge). */
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    /** When dormant-account notice email was sent. */
    dormantNoticeSentAt: timestamp('dormant_notice_sent_at', { withTimezone: true }),
    /** Self-attested 18+ at signup (legal-profile minimization epic 2). */
    ageAffirmedAt: timestamp('age_affirmed_at', { withTimezone: true }),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    policyVersionAccepted: varchar('policy_version_accepted', { length: 64 }),
    ageVerificationStatus: ageVerificationStatusEnum('age_verification_status')
      .notNull()
      .default('UNVERIFIED'),
    /** Incremented on password reset to invalidate existing session cookies. */
    sessionVersion: integer('session_version').notNull().default(0),
    /** When the account email was verified (soft onboarding gate). */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /**
     * Secondary password (bcrypt) required before org payments / Stripe Connect UI.
     * Distinct from login password; unlock window via `payments_vault_unlocked_at`.
     */
    paymentsVaultPasswordHash: text('payments_vault_password_hash'),
    /** Last successful payments-vault unlock; valid for a short TTL. */
    paymentsVaultUnlockedAt: timestamp('payments_vault_unlocked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_username_idx').on(t.username),
    uniqueIndex('users_email_lookup_hash_idx').on(t.emailLookupHash),
    index('users_registration_ip_prefix_idx').on(t.registrationIpPrefix),
  ]
)

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    /** Optional short numeric code (hashed) for onboarding UI entry. */
    codeHash: varchar('code_hash', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('email_verification_tokens_user_id_idx').on(t.userId),
    index('email_verification_tokens_token_hash_idx').on(t.tokenHash),
  ],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    requestIp: varchar('request_ip', { length: 64 }),
  },
  (t) => [
    index('password_reset_tokens_user_id_idx').on(t.userId),
    index('password_reset_tokens_hash_idx').on(t.tokenHash),
  ]
)

/** Email / digest opt-ins (foundation for ADR 002 org digests). */
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  orgDigestEmailWeekly: boolean('org_digest_email_weekly').notNull().default(true),
  pinnedDigestEmailWeekly: boolean('pinned_digest_email_weekly').notNull().default(true),
  /** Web push when a pinned convention posts to hub ANNOUNCEMENTS. */
  pushHubAnnouncements: boolean('push_hub_announcements').notNull().default(false),
  /** Web push when a pinned convention posts to hub CHAT channels. */
  pushHubChat: boolean('push_hub_chat').notNull().default(false),
  /** Master opt-in for browser push on this account (off by default). */
  pushEnabled: boolean('push_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  displayName: varchar('display_name', { length: 128 }),
  bio: text('bio'),
  location: varchar('location', { length: 255 }),
  placeId: uuid('place_id').references(() => places.id, { onDelete: 'set null' }),
  stateId: uuid('state_id').references(() => states.id, { onDelete: 'set null' }),
  customLocation: varchar('custom_location', { length: 255 }),
  roles: text('roles').array().notNull().default(sql`'{}'::text[]`),
  sexuality: varchar('sexuality', { length: 128 }),
  /** Date of birth; `age` is derived on write for discovery/redaction. */
  birthDate: date('birth_date'),
  pronouns: varchar('pronouns', { length: 64 }),
  /** Optional gender label for search/profile; visibility controlled by fieldVisibility + discoverableInPeopleSearch. */
  gender: varchar('gender', { length: 64 }),
  age: integer('age'),
  /** When false, profile is omitted from /api/v1/profiles people discovery for everyone except self. */
  discoverableInPeopleSearch: boolean('discoverable_in_people_search').notNull().default(true),
  /** Per-field visibility: public | friends | hidden for gender, age, orientation (`sexuality` key), pronouns, location (see @c2k/shared). */
  fieldVisibility: jsonb('field_visibility').$type<Record<string, string>>(),
  avatarUrl: text('avatar_url'),
  verified: boolean('verified').notNull().default(false),
  trustScore: integer('trust_score').notNull().default(0),
  visibility: profileVisibilityEnum('visibility').notNull().default('MEMBERS'),
  /** PostGIS lat/lng when E6 enabled - stored as JSON until migration */
  geoJson: jsonb('geo_json'),
  genders: text('genders').array().notNull().default(sql`'{}'::text[]`),
  sexualOrientations: text('sexual_orientations').array().notNull().default(sql`'{}'::text[]`),
  romanticOrientations: text('romantic_orientations').array().notNull().default(sql`'{}'::text[]`),
  pronounTags: text('pronoun_tags').array().notNull().default(sql`'{}'::text[]`),
  lifestyleActivity: varchar('lifestyle_activity', { length: 128 }),
  lookingFor: text('looking_for').array().notNull().default(sql`'{}'::text[]`),
  notLookingFor: text('not_looking_for').array().notNull().default(sql`'{}'::text[]`),
  homeZip: varchar('home_zip', { length: 10 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Zip → place cache (Zippopotam.us lookups). */
export const placeZips = pgTable(
  'place_zips',
  {
    zip: varchar('zip', { length: 5 }).primaryKey(),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
  },
  (t) => [uniqueIndex('place_zips_zip_idx').on(t.zip)]
)

export const profileRelationshipKindEnum = pgEnum('profile_relationship_kind', ['relationship', 'ds'])

export const profileRelationshipStatusEnum = pgEnum('profile_relationship_status', ['pending', 'active'])

export const profileRelationshipVisibilityEnum = pgEnum('profile_relationship_visibility', [
  'public',
  'friends',
  'hidden',
])

export const profileRelationships = pgTable(
  'profile_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    kind: profileRelationshipKindEnum('kind').notNull(),
    label: varchar('label', { length: 128 }).notNull(),
    partnerUserId: uuid('partner_user_id').references(() => users.id, { onDelete: 'set null' }),
    customText: text('custom_text'),
    status: profileRelationshipStatusEnum('status').notNull().default('active'),
    visibility: profileRelationshipVisibilityEnum('visibility').notNull().default('public'),
  },
  (t) => [index('profile_relationships_user_sort_idx').on(t.userId, t.sortOrder)]
)

export const profileLinks = pgTable(
  'profile_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    label: varchar('label', { length: 128 }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('profile_links_user_sort_idx').on(t.userId, t.sortOrder)]
)

export const presenterSkillFrequencyEnum = pgEnum('presenter_skill_frequency', [
  'rarely',
  'monthly',
  'weekly',
  'daily',
  'professional',
])

export const presenterSkillClaims = pgTable(
  'presenter_skill_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillLabel: varchar('skill_label', { length: 128 }).notNull(),
    yearsActive: integer('years_active'),
    frequency: presenterSkillFrequencyEnum('frequency'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('presenter_skill_claims_user_sort_idx').on(t.userId, t.sortOrder)]
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
)

export const profilePhotos = pgTable('profile_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  /** T&S-2: optional link to canonical adult-media metadata row. */
  mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  url: text('url').notNull(),
  caption: text('caption'),
  /** cover vs contain + focal point for hero/header framing (JSONB). */
  displaySettings: jsonb('display_settings'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/* --- Kink catalog & profile kinks --- */

export const kinkInterestStatusEnum = pgEnum('kink_interest_status', [
  'into',
  'curious',
  'soft_limit',
  'hard_limit',
  'not_into',
])

export const kinkTags = pgTable(
  'kink_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('kink_tags_active_sort_idx').on(t.active, t.sortOrder)]
)

export const kinkTagAliases = pgTable(
  'kink_tag_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kinkTagId: uuid('kink_tag_id')
      .notNull()
      .references(() => kinkTags.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 64 }).notNull(),
    externalKey: varchar('external_key', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('kink_tag_aliases_source_key_idx').on(t.source, t.externalKey)]
)

export const profileKinks = pgTable(
  'profile_kinks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    kinkTagId: uuid('kink_tag_id')
      .notNull()
      .references(() => kinkTags.id, { onDelete: 'cascade' }),
    interestStatus: kinkInterestStatusEnum('interest_status').notNull(),
    activity: varchar('activity', { length: 255 }),
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('profile_kinks_profile_tag_idx').on(t.profileId, t.kinkTagId)]
)

/* --- User settings (JSON domains) --- */

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  privacySettings: jsonb('privacy_settings').notNull().default(sql`'{}'::jsonb`),
  notificationSettings: jsonb('notification_settings').notNull().default(sql`'{}'::jsonb`),
  feedSettings: jsonb('feed_settings').notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/* --- E2: Social graph --- */

export const connectionStatusEnum = pgEnum('connection_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'IGNORED',
])

export const dmAcceptanceStatusEnum = pgEnum('dm_acceptance_status', ['ACCEPTED', 'PENDING'])

export const referenceStatusEnum = pgEnum('reference_status', ['PENDING', 'ACCEPTED', 'DECLINED'])

export const referenceCategoryEnum = pgEnum('reference_category', [
  'character',
  'play',
  'community',
  'technique',
  'general',
])

export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: connectionStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('connections_requester_recipient_idx').on(t.requesterId, t.recipientId)]
)

/** One-way follow edges (distinct from mutual connections). */
export const userFollows = pgTable(
  'user_follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index('user_follows_following_idx').on(t.followingId),
  ]
)

/** Mutual references (replaces legacy endorsements). Either party may delete the row. */
export const profileReferences = pgTable(
  'profile_references',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectUserId: uuid('subject_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: referenceCategoryEnum('category').notNull().default('general'),
    note: text('note'),
    status: referenceStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    /** Referrer trust score snapshot when subject accepted the reference. */
    referrerTrustAtAccept: integer('referrer_trust_at_accept'),
    /** Whether this reference may boost public trust levels (anti-gaming). */
    countsTowardLevel: boolean('counts_toward_level').notNull().default(true),
    referrerAccountAgeDaysAtAccept: integer('referrer_account_age_days_at_accept'),
    sameSignupCohort: boolean('same_signup_cohort').notNull().default(false),
  },
  (t) => [
    uniqueIndex('profile_references_referrer_subject_category_idx').on(t.referrerId, t.subjectUserId, t.category),
    index('profile_references_subject_idx').on(t.subjectUserId),
  ]
)

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('blocks_blocker_blocked_idx').on(t.blockerId, t.blockedId)]
)

export const muteTargetKindEnum = pgEnum('mute_target_kind', ['USER', 'GROUP', 'TAG'])

export const mutes = pgTable(
  'mutes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetKind: muteTargetKindEnum('target_kind').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mutes_user_target_idx').on(t.userId, t.targetKind, t.targetId)]
)

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: text('target_id').notNull(),
    scopeType: varchar('scope_type', { length: 32 }),
    scopeId: uuid('scope_id'),
    category: varchar('category', { length: 64 }).notNull(),
    body: text('body'),
    status: varchar('status', { length: 32 }).notNull().default('OPEN'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reports_scope_idx').on(t.scopeType, t.scopeId),
    index('reports_status_idx').on(t.status),
  ]
)

export const platformStaffRoleEnum = pgEnum('platform_staff_role', [
  'OWNER_ADMIN',
  'SITE_ADMIN',
  'MODERATOR',
  'TRUST_SAFETY_ADMIN',
  'LEGAL_ADMIN',
])

export const platformStaff = pgTable('platform_staff', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: platformStaffRoleEnum('role').notNull(),
  /** Password step-up timestamp for privileged admin actions (LEGAL-ALPHA-1). */
  lastStepUpAt: timestamp('last_step_up_at', { withTimezone: true }),
  /** When MFA enrollment completed (foundation; step-up uses password for alpha). */
  mfaEnrolledAt: timestamp('mfa_enrolled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moderationActionStatusEnum = pgEnum('moderation_action_status', [
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'REJECTED',
  'OVERRIDDEN',
])

/** T&S-1: canonical policy taxonomy - values aligned with @c2k/shared moderation-types.ts */
export const policyReasonEnum = pgEnum('policy_reason', [
  'MINOR_SAFETY',
  'CSAM_SUSPECTED',
  'NCII',
  'AI_DEEPFAKE_NCII',
  'DOXXING_OUTING',
  'HARASSMENT_THREATS',
  'IMPERSONATION',
  'HIDDEN_CAMERA_LEAKED',
  'TRAFFICKING_COERCION',
  'COMMERCIAL_SEX_SOLICITATION',
  'ILLEGAL_GOODS_SERVICES',
  'SPAM_SCAM',
  'CONSENT_SAFETY',
  'EXPLICIT_VISIBILITY_VIOLATION',
  'OTHER',
])

export const policySeverityEnum = pgEnum('policy_severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export const moderationQueueEnum = pgEnum('moderation_queue', [
  'GENERAL_REVIEW',
  'MEDIA_REVIEW',
  'NCII_URGENT',
  'MINOR_SAFETY_RESTRICTED',
  'SPAM_ABUSE',
  'APPEALS',
])

export const moderationCaseStatusEnum = pgEnum('moderation_case_status', [
  'OPEN',
  'TRIAGED',
  'ACTIONED',
  'ESCALATED',
  'CLOSED_NO_VIOLATION',
  'CLOSED_DUPLICATE',
])

export const moderationQueueItemStatusEnum = pgEnum('moderation_queue_item_status', [
  'OPEN',
  'CLAIMED',
  'CLOSED',
])

export const preservationStatusEnum = pgEnum('preservation_status', [
  'NONE',
  'PENDING',
  'PRESERVED',
  'RELEASED',
])

export const externalEscalationStatusEnum = pgEnum('external_escalation_status', [
  'NONE',
  'PENDING',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'CLOSED',
])

export const moderationAppealStatusEnum = pgEnum('moderation_appeal_status', [
  'OPEN',
  'UNDER_REVIEW',
  'UPHELD',
  'DENIED',
  'WITHDRAWN',
])

/** T&S-2 adult media taxonomy - values aligned with @c2k/shared media-types.ts */
export const mediaUploadStatusEnum = pgEnum('media_upload_status', [
  'PENDING_UPLOAD',
  'PENDING_ATTESTATION',
  'PENDING_SCAN',
  'AUTO_APPROVED',
  'APPROVED_BLURRED',
  'QUARANTINED',
  'REJECTED',
  'REMOVED',
  'ESCALATED',
  'PRESERVED',
])

export const mediaContentRatingEnum = pgEnum('media_content_rating', [
  'SAFE_PUBLIC',
  'ADULT_NON_EXPLICIT',
  'EXPLICIT_ADULT',
  'EDGE_REVIEW',
  'BLOCKED_ILLEGAL',
])

export const mediaVisibilityEnum = pgEnum('media_visibility', [
  'PUBLIC_PREVIEW',
  'LOGGED_IN',
  'FOLLOWERS',
  'PRIVATE_PROFILE',
  'GROUP_ONLY',
  'ORG_ONLY',
  'EVENT_ATTENDEES',
  'CONVENTION_ATTENDEES',
  'STAFF_ONLY',
])

export const depictedPeopleEnum = pgEnum('depicted_people', [
  'ONLY_ME',
  'ME_AND_OTHER_ADULTS',
  'OTHER_ADULTS',
  'NO_IDENTIFIABLE_PERSON',
  'UNKNOWN',
])

export const mediaScanStatusEnum = pgEnum('media_scan_status', [
  'NOT_REQUIRED',
  'PENDING',
  'RUNNING',
  'PASSED',
  'FLAGGED',
  'FAILED',
  'ERROR',
])

export const mediaStorageStateEnum = pgEnum('media_storage_state', [
  'PENDING_UPLOAD',
  'QUARANTINED_PRIVATE',
  'VALIDATED_PRIVATE',
  'APPROVED_PUBLIC',
  'REJECTED_PRIVATE',
  'REMOVED_PRIVATE',
  'DELETED',
])

export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actionType: varchar('action_type', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 64 }).notNull(),
    targetId: text('target_id').notNull(),
    status: moderationActionStatusEnum('status').notNull().default('PENDING_APPROVAL'),
    proposedByUserId: uuid('proposed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requiredApprovals: integer('required_approvals').notNull().default(2),
    payload: jsonb('payload'),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    caseId: uuid('case_id').references(() => moderationCases.id, { onDelete: 'set null' }),
    overrideByUserId: uuid('override_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    overrideReason: text('override_reason'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_actions_status_idx').on(t.status),
    index('moderation_actions_case_id_idx').on(t.caseId),
  ]
)

export const moderationActionApprovals = pgTable(
  'moderation_action_approvals',
  {
    actionId: uuid('action_id')
      .notNull()
      .references(() => moderationActions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.actionId, t.userId] })]
)

export const moderationAuditEvents = pgTable(
  'moderation_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: varchar('scope_type', { length: 32 }).notNull(),
    scopeId: uuid('scope_id'),
    verb: varchar('verb', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 64 }),
    targetId: text('target_id'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_audit_scope_idx').on(t.scopeType, t.scopeId),
    index('moderation_audit_created_idx').on(t.createdAt),
  ]
)

/** T&S-1 internal note shape stored on `moderation_cases.internal_notes`. */
export type ModerationInternalNote = {
  id: string
  authorUserId: string
  body: string
  createdAt: string
}

/**
 * T&S-1 case spine - distinct from legacy `reports` rows.
 * `moderation_events` is the immutable case timeline; `moderation_audit_events` remains for scope/org audit.
 */
export const moderationCases = pgTable(
  'moderation_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetContentType: varchar('target_content_type', { length: 64 }).notNull(),
    targetContentId: text('target_content_id').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    policyReason: policyReasonEnum('policy_reason').notNull(),
    severity: policySeverityEnum('severity').notNull(),
    queue: moderationQueueEnum('queue').notNull(),
    status: moderationCaseStatusEnum('status').notNull().default('OPEN'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    preservationStatus: preservationStatusEnum('preservation_status').notNull().default('NONE'),
    externalEscalationStatus: externalEscalationStatusEnum('external_escalation_status')
      .notNull()
      .default('NONE'),
    internalNotes: jsonb('internal_notes')
      .$type<ModerationInternalNote[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    legacyReportId: uuid('legacy_report_id').references(() => reports.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_cases_queue_status_idx').on(t.queue, t.status),
    index('moderation_cases_target_idx').on(t.targetContentType, t.targetContentId),
    index('moderation_cases_target_user_idx').on(t.targetUserId),
  ]
)

export const moderationReports = pgTable(
  'moderation_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCases.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    policyReason: policyReasonEnum('policy_reason').notNull(),
    body: text('body'),
    duplicateOfReportId: uuid('duplicate_of_report_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('moderation_reports_reporter_case_reason_idx').on(
      t.reporterId,
      t.caseId,
      t.policyReason
    ),
    index('moderation_reports_case_id_idx').on(t.caseId),
    index('moderation_reports_reporter_id_idx').on(t.reporterId),
  ]
)

export const moderationQueueItems = pgTable(
  'moderation_queue_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCases.id, { onDelete: 'cascade' }),
    queue: moderationQueueEnum('queue').notNull(),
    severity: policySeverityEnum('severity').notNull(),
    status: moderationQueueItemStatusEnum('status').notNull().default('OPEN'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_queue_items_queue_idx').on(t.queue),
    index('moderation_queue_items_case_id_idx').on(t.caseId),
    index('moderation_queue_items_status_idx').on(t.status),
  ]
)

/** Immutable insert-only case timeline (notes, status changes, reveals, actions). */
export const moderationEvents = pgTable(
  'moderation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id').references(() => moderationCases.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('moderation_events_case_created_idx').on(t.caseId, t.createdAt)]
)

export const contentSnapshots = pgTable(
  'content_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCases.id, { onDelete: 'cascade' }),
    targetContentType: varchar('target_content_type', { length: 64 }).notNull(),
    targetContentId: text('target_content_id').notNull(),
    snapshot: jsonb('snapshot').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('content_snapshots_case_id_idx').on(t.caseId)]
)

export const userRiskFlags = pgTable(
  'user_risk_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    flagType: varchar('flag_type', { length: 64 }).notNull(),
    severity: policySeverityEnum('severity').notNull(),
    caseId: uuid('case_id').references(() => moderationCases.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_risk_flags_user_id_idx').on(t.userId),
    index('user_risk_flags_case_id_idx').on(t.caseId),
  ]
)

/** T&S-7 appeals workflow - skeleton table for T&S-1. */
export const moderationAppeals = pgTable(
  'moderation_appeals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCases.id, { onDelete: 'cascade' }),
    appellantUserId: uuid('appellant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: moderationAppealStatusEnum('status').notNull().default('OPEN'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_appeals_case_id_idx').on(t.caseId),
    index('moderation_appeals_appellant_idx').on(t.appellantUserId),
  ]
)

export type ModerationCase = typeof moderationCases.$inferSelect
export type ModerationCaseInsert = typeof moderationCases.$inferInsert
export type ModerationReport = typeof moderationReports.$inferSelect
export type ModerationReportInsert = typeof moderationReports.$inferInsert
export type ModerationQueueItem = typeof moderationQueueItems.$inferSelect
export type ModerationQueueItemInsert = typeof moderationQueueItems.$inferInsert
export type ModerationEvent = typeof moderationEvents.$inferSelect
export type ModerationEventInsert = typeof moderationEvents.$inferInsert
export type ContentSnapshot = typeof contentSnapshots.$inferSelect
export type ContentSnapshotInsert = typeof contentSnapshots.$inferInsert
export type UserRiskFlag = typeof userRiskFlags.$inferSelect
export type UserRiskFlagInsert = typeof userRiskFlags.$inferInsert
export type ModerationAppeal = typeof moderationAppeals.$inferSelect
export type ModerationAppealInsert = typeof moderationAppeals.$inferInsert

/**
 * T&S-2 canonical adult-media metadata spine.
 * Publish/visibility rules enforced in API helpers - not at the DB layer.
 */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uploaderUserId: uuid('uploader_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ownerType: varchar('owner_type', { length: 32 }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    sourceSurface: varchar('source_surface', { length: 64 }).notNull(),
    storageKey: text('storage_key').notNull(),
    originalStorageKey: text('original_storage_key'),
    quarantineStorageKey: text('quarantine_storage_key'),
    publicStorageKey: text('public_storage_key'),
    storageState: mediaStorageStateEnum('storage_state').notNull().default('QUARANTINED_PRIVATE'),
    storageProvider: varchar('storage_provider', { length: 32 }).notNull().default('s3'),
    storageBucket: varchar('storage_bucket', { length: 128 }),
    originalFilename: varchar('original_filename', { length: 512 }),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    imageWidth: integer('image_width'),
    imageHeight: integer('image_height'),
    videoWidth: integer('video_width'),
    videoHeight: integer('video_height'),
    durationSeconds: integer('duration_seconds'),
    posterStorageKey: text('poster_storage_key'),
    transcodingStatus: varchar('transcoding_status', { length: 32 }),
    sha256Hash: varchar('sha256_hash', { length: 64 }),
    perceptualHash: varchar('perceptual_hash', { length: 128 }),
    perceptualHashAlgorithm: varchar('perceptual_hash_algorithm', { length: 64 }),
    uploadStatus: mediaUploadStatusEnum('upload_status').notNull().default('PENDING_ATTESTATION'),
    contentRating: mediaContentRatingEnum('content_rating'),
    visibility: mediaVisibilityEnum('visibility'),
    depictedPeople: depictedPeopleEnum('depicted_people'),
    scanStatus: mediaScanStatusEnum('scan_status').notNull().default('NOT_REQUIRED'),
    moderationCaseId: uuid('moderation_case_id').references(() => moderationCases.id, {
      onDelete: 'set null',
    }),
    reportable: boolean('reportable').notNull().default(true),
    isBlurredByDefault: boolean('is_blurred_by_default').notNull().default(false),
    uploaderConfirmed18: boolean('uploader_confirmed_18').notNull().default(false),
    uploaderConfirmedDepictedAdults18: boolean('uploader_confirmed_depicted_adults_18')
      .notNull()
      .default(false),
    uploaderConfirmedConsent: boolean('uploader_confirmed_consent').notNull().default(false),
    uploaderConfirmedRightToUpload: boolean('uploader_confirmed_right_to_upload')
      .notNull()
      .default(false),
    uploaderConfirmedNoNcii: boolean('uploader_confirmed_no_ncii').notNull().default(false),
    uploaderConfirmedNoMinors: boolean('uploader_confirmed_no_minors').notNull().default(false),
    uploaderConfirmedNoHiddenCamera: boolean('uploader_confirmed_no_hidden_camera')
      .notNull()
      .default(false),
    uploaderConfirmedNoAiDeepfakeWithoutConsent: boolean(
      'uploader_confirmed_no_ai_deepfake_without_consent'
    )
      .notNull()
      .default(false),
    attestedAt: timestamp('attested_at', { withTimezone: true }),
    attestationVersion: integer('attestation_version'),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    promotedByUserId: uuid('promoted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('media_assets_uploader_idx').on(t.uploaderUserId),
    index('media_assets_owner_idx').on(t.ownerType, t.ownerId),
    index('media_assets_upload_status_idx').on(t.uploadStatus),
    index('media_assets_moderation_case_idx').on(t.moderationCaseId),
  ]
)

export type MediaAsset = typeof mediaAssets.$inferSelect
export type MediaAssetInsert = typeof mediaAssets.$inferInsert

/** User-facing media kind (image, video, audio). */
export const mediaKindEnum = pgEnum('media_kind', ['image', 'video', 'audio'])

export const mediaCommentPolicyEnum = pgEnum('media_comment_policy', [
  'everyone_allowed_by_visibility',
  'connections',
  'no_one',
])

export const mediaPeopleTagStatusEnum = pgEnum('media_people_tag_status', [
  'pending',
  'approved',
  'declined',
  'removed',
])

export const mediaAlbumKindEnum = pgEnum('media_album_kind', [
  'default_all',
  'profile_pictures',
  'uploaded_pictures',
  'tagged_pictures',
  'custom',
])

/** Canonical user-facing media object layered on media_assets. */
export const mediaItems = pgTable(
  'media_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    mediaKind: mediaKindEnum('media_kind').notNull(),
    caption: text('caption'),
    visibility: mediaVisibilityEnum('visibility').notNull(),
    commentPolicy: mediaCommentPolicyEnum('comment_policy')
      .notNull()
      .default('connections'),
    showInFeed: boolean('show_in_feed').notNull().default(true),
    pinnedToProfile: boolean('pinned_to_profile').notNull().default(false),
    useAsAvatar: boolean('use_as_avatar').notNull().default(false),
    contentRating: mediaContentRatingEnum('content_rating'),
    isBlurredByDefault: boolean('is_blurred_by_default').notNull().default(false),
    sourceSurface: varchar('source_surface', { length: 64 }).notNull(),
    sourceGroupId: uuid('source_group_id').references(() => groups.id, { onDelete: 'set null' }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    sourceConventionId: uuid('source_convention_id').references(() => conventions.id, {
      onDelete: 'set null',
    }),
    originalFeedPostId: uuid('original_feed_post_id').references(() => feedPosts.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('media_items_owner_created_idx').on(t.ownerUserId, t.createdAt),
    index('media_items_asset_idx').on(t.mediaAssetId),
    index('media_items_source_group_idx').on(t.sourceGroupId),
    index('media_items_source_event_idx').on(t.sourceEventId),
    index('media_items_source_convention_idx').on(t.sourceConventionId),
    index('media_items_visibility_idx').on(t.visibility),
    index('media_items_deleted_at_idx').on(t.deletedAt),
  ],
)

export type MediaItem = typeof mediaItems.$inferSelect
export type MediaItemInsert = typeof mediaItems.$inferInsert

/** One upload action grouping multiple media items for feed cards. */
export const mediaPosts = pgTable(
  'media_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caption: text('caption'),
    visibility: mediaVisibilityEnum('visibility').notNull(),
    commentPolicy: mediaCommentPolicyEnum('comment_policy')
      .notNull()
      .default('connections'),
    showInFeed: boolean('show_in_feed').notNull().default(true),
    feedPostId: uuid('feed_post_id').references(() => feedPosts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('media_posts_owner_created_idx').on(t.ownerUserId, t.createdAt),
    index('media_posts_feed_post_idx').on(t.feedPostId),
    index('media_posts_deleted_at_idx').on(t.deletedAt),
  ],
)

export type MediaPost = typeof mediaPosts.$inferSelect

export const mediaPostItems = pgTable(
  'media_post_items',
  {
    mediaPostId: uuid('media_post_id')
      .notNull()
      .references(() => mediaPosts.id, { onDelete: 'cascade' }),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.mediaPostId, t.mediaItemId] })],
)

export const mediaAlbums = pgTable(
  'media_albums',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 128 }).notNull(),
    description: text('description'),
    visibility: mediaVisibilityEnum('visibility').notNull().default('LOGGED_IN'),
    coverMediaItemId: uuid('cover_media_item_id').references(() => mediaItems.id, {
      onDelete: 'set null',
    }),
    albumKind: mediaAlbumKindEnum('album_kind').notNull().default('custom'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('media_albums_owner_slug_uq')
      .on(t.ownerUserId, t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('media_albums_owner_sort_idx').on(t.ownerUserId, t.sortOrder),
    index('media_albums_visibility_idx').on(t.visibility),
    index('media_albums_deleted_at_idx').on(t.deletedAt),
  ],
)

export type MediaAlbum = typeof mediaAlbums.$inferSelect

export const mediaAlbumItems = pgTable(
  'media_album_items',
  {
    albumId: uuid('album_id')
      .notNull()
      .references(() => mediaAlbums.id, { onDelete: 'cascade' }),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.albumId, t.mediaItemId] })],
)

export const mediaItemTags = pgTable(
  'media_item_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_item_tags_item_tag_uq').on(t.mediaItemId, sql`lower(${t.tag})`),
    index('media_item_tags_item_idx').on(t.mediaItemId),
  ],
)

export const mediaPeopleTags = pgTable(
  'media_people_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    taggedUserId: uuid('tagged_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taggedByUserId: uuid('tagged_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: mediaPeopleTagStatusEnum('status').notNull().default('pending'),
    x: doublePrecision('x'),
    y: doublePrecision('y'),
    label: varchar('label', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_people_tags_item_idx').on(t.mediaItemId),
    index('media_people_tags_tagged_user_idx').on(t.taggedUserId),
    index('media_people_tags_status_idx').on(t.status),
  ],
)

export const mediaReactions = pgTable(
  'media_reactions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull().default('love'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mediaItemId] }),
    index('media_reactions_item_idx').on(t.mediaItemId),
  ],
)

export const mediaComments = pgTable(
  'media_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaItemId: uuid('media_item_id')
      .notNull()
      .references(() => mediaItems.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('media_comments_item_created_idx').on(t.mediaItemId, t.createdAt),
    index('media_comments_author_idx').on(t.authorId),
  ],
)

export type MediaComment = typeof mediaComments.$inferSelect

export const mediaHashKindEnum = pgEnum('media_hash_kind', ['SHA256', 'PERCEPTUAL'])

export const mediaHashListActionEnum = pgEnum('media_hash_list_action', ['DENY', 'REVIEW'])

export const mediaHashListSourceEnum = pgEnum('media_hash_list_source', [
  'INTERNAL',
  'MODERATOR_REPORT',
  'LEGAL_HOLD',
  'PARTNER_FEED',
])

export const scannerResultStatusEnum = pgEnum('scanner_result_status', [
  'PASSED',
  'FLAGGED',
  'BLOCKED',
  'ERROR',
])

export const mediaHashListEntries = pgTable(
  'media_hash_list_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hashKind: mediaHashKindEnum('hash_kind').notNull(),
    hashValue: varchar('hash_value', { length: 128 }).notNull(),
    hashAlgorithm: varchar('hash_algorithm', { length: 64 }),
    listAction: mediaHashListActionEnum('list_action').notNull(),
    policyReason: policyReasonEnum('policy_reason').notNull(),
    source: mediaHashListSourceEnum('source').notNull().default('INTERNAL'),
    reasonCode: varchar('reason_code', { length: 64 }),
    active: boolean('active').notNull().default(true),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdByAdminId: uuid('created_by_admin_id').references(() => users.id, { onDelete: 'set null' }),
    moderationCaseId: uuid('moderation_case_id').references(() => moderationCases.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    notesPrivate: text('notes_private'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_hash_list_entries_lookup_idx').on(t.hashKind, t.hashValue),
    index('media_hash_list_entries_active_idx').on(t.active),
  ]
)

export const mediaScannerResults = pgTable(
  'media_scanner_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    scannerName: varchar('scanner_name', { length: 64 }).notNull(),
    scannerVersion: varchar('scanner_version', { length: 32 }).notNull(),
    status: scannerResultStatusEnum('status').notNull(),
    confidence: doublePrecision('confidence'),
    labels: jsonb('labels').notNull().default([]),
    policyReason: policyReasonEnum('policy_reason'),
    severity: policySeverityEnum('severity'),
    queue: moderationQueueEnum('queue'),
    userFacingSummary: text('user_facing_summary').notNull().default(''),
    rawResultPrivate: jsonb('raw_result_private').notNull().default({}),
    simulated: boolean('simulated').notNull().default(false),
    matchedHashEntryId: uuid('matched_hash_entry_id').references(() => mediaHashListEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_scanner_results_asset_created_idx').on(t.mediaAssetId, t.createdAt),
    index('media_scanner_results_name_status_idx').on(t.scannerName, t.status),
  ]
)

export type MediaHashListEntry = typeof mediaHashListEntries.$inferSelect
export type MediaHashListEntryInsert = typeof mediaHashListEntries.$inferInsert
export type MediaScannerResultRow = typeof mediaScannerResults.$inferSelect
export type MediaScannerResultRowInsert = typeof mediaScannerResults.$inferInsert

export const legalRequestStatusEnum = pgEnum('legal_request_status', [
  'RECEIVED',
  'IN_REVIEW',
  'FULFILLED',
  'REJECTED',
  'CLOSED',
])

export const dmcaCaseStatusEnum = pgEnum('dmca_case_status', [
  'RECEIVED',
  'DISABLED',
  'COUNTER_NOTICE_RECEIVED',
  'RESTORED',
  'REJECTED',
  'CLOSED',
])

/** DMCA takedown / counter-notice cases - LEGAL-ALPHA-1. */
export const dmcaCases = pgTable(
  'dmca_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: dmcaCaseStatusEnum('status').notNull().default('RECEIVED'),
    claimantName: varchar('claimant_name', { length: 255 }).notNull(),
    claimantEmail: varchar('claimant_email', { length: 320 }).notNull(),
    workIdentified: text('work_identified').notNull(),
    infringingUrl: text('infringing_url').notNull(),
    targetContentType: varchar('target_content_type', { length: 64 }),
    targetContentId: uuid('target_content_id'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    notesPrivate: text('notes_private'),
    repeatInfringerFlag: boolean('repeat_infringer_flag').notNull().default(false),
    createdByAdminId: uuid('created_by_admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dmca_cases_status_idx').on(t.status, t.receivedAt),
    index('dmca_cases_target_idx').on(t.targetContentType, t.targetContentId),
  ]
)

/** Public contact form submissions - legal, privacy, accessibility, and general inquiries. */
export const contactInquiryStatusEnum = pgEnum('contact_inquiry_status', [
  'RECEIVED',
  'IN_REVIEW',
  'REPLIED',
  'CLOSED',
])

export const contactInquiries = pgTable(
  'contact_inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: contactInquiryStatusEnum('status').notNull().default('RECEIVED'),
    category: varchar('category', { length: 64 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    senderName: varchar('sender_name', { length: 255 }).notNull(),
    senderEmail: varchar('sender_email', { length: 320 }).notNull(),
    message: text('message').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    notesPrivate: text('notes_private'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contact_inquiries_status_idx').on(t.status, t.receivedAt),
    index('contact_inquiries_category_idx').on(t.category, t.receivedAt),
  ]
)

export type ContactInquiry = typeof contactInquiries.$inferSelect
export type ContactInquiryInsert = typeof contactInquiries.$inferInsert

export const mailIntakeStatusEnum = pgEnum('mail_intake_status', [
  'new',
  'triaged',
  'assigned',
  'waiting',
  'closed',
])

export const mailIntakePriorityEnum = pgEnum('mail_intake_priority', ['normal', 'high', 'urgent'])

export const mailIntakeVisibilityEnum = pgEnum('mail_intake_visibility', [
  'owner_only',
  'admin_only',
  'trust_safety',
  'support',
  'business',
])

/** Inbound mailbox messages imported via IMAP for admin dashboard intake. */
export const mailIntakeItems = pgTable(
  'mail_intake_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mailbox: varchar('mailbox', { length: 320 }).notNull(),
    messageId: varchar('message_id', { length: 512 }).notNull(),
    threadKey: varchar('thread_key', { length: 512 }),
    fromName: varchar('from_name', { length: 255 }),
    fromEmail: varchar('from_email', { length: 320 }).notNull(),
    toEmail: varchar('to_email', { length: 320 }).notNull(),
    subject: varchar('subject', { length: 512 }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    plainTextBody: text('plain_text_body'),
    sanitizedHtmlBody: text('sanitized_html_body'),
    attachmentMetadata: jsonb('attachment_metadata').notNull().default([]),
    status: mailIntakeStatusEnum('status').notNull().default('new'),
    priority: mailIntakePriorityEnum('priority').notNull().default('normal'),
    visibility: mailIntakeVisibilityEnum('visibility').notNull().default('support'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
    linkedModerationCaseId: uuid('linked_moderation_case_id').references(() => moderationCases.id, {
      onDelete: 'set null',
    }),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('mail_intake_items_mailbox_message_uq').on(t.mailbox, t.messageId),
    index('mail_intake_items_mailbox_status_idx').on(t.mailbox, t.status, t.receivedAt),
    index('mail_intake_items_visibility_idx').on(t.visibility, t.status, t.receivedAt),
  ]
)

export type MailIntakeItem = typeof mailIntakeItems.$inferSelect
export type MailIntakeItemInsert = typeof mailIntakeItems.$inferInsert

/** Inbound legal/process requests (DMCA, subpoena, etc.) - Epic 4 stub. */
export const legalRequests = pgTable(
  'legal_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestType: varchar('request_type', { length: 64 }).notNull(),
    status: legalRequestStatusEnum('status').notNull().default('RECEIVED'),
    subjectUserId: uuid('subject_user_id').references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    notes: text('notes'),
    receivedVia: varchar('received_via', { length: 64 }),
    requesterName: varchar('requester_name', { length: 255 }),
    requesterAgency: varchar('requester_agency', { length: 255 }),
    jurisdiction: varchar('jurisdiction', { length: 128 }),
    scopeSummary: text('scope_summary'),
    gagOrder: boolean('gag_order').notNull().default(false),
    userNoticeAllowed: boolean('user_notice_allowed').notNull().default(true),
    notesPrivate: text('notes_private'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('legal_requests_status_idx').on(t.status, t.receivedAt)]
)

/** Active holds block retention purge for a target entity - Epic 4 stub. */
export const legalHolds = pgTable(
  'legal_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalRequestId: uuid('legal_request_id').references(() => legalRequests.id, {
      onDelete: 'set null',
    }),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: uuid('target_id').notNull(),
    active: boolean('active').notNull().default(true),
    reason: text('reason'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdByAdminId: uuid('created_by_admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('legal_holds_target_active_idx').on(t.targetType, t.targetId, t.active)]
)

export const userPrivacyRequestTypeEnum = pgEnum('user_privacy_request_type', [
  'EXPORT_JSON',
  'DEACTIVATE',
  'DELETE',
])

export const userPrivacyRequestStatusEnum = pgEnum('user_privacy_request_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'BLOCKED_LEGAL_HOLD',
  'CANCELLED',
])

/** User-initiated export / deactivation / deletion requests - LEGAL-ALPHA-1 foundation. */
export const userPrivacyRequests = pgTable(
  'user_privacy_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestType: userPrivacyRequestTypeEnum('request_type').notNull(),
    status: userPrivacyRequestStatusEnum('status').notNull().default('PENDING'),
    exportPayload: jsonb('export_payload').$type<Record<string, unknown>>(),
    reason: text('reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_privacy_requests_user_idx').on(t.userId, t.status),
    index('user_privacy_requests_status_idx').on(t.status, t.requestedAt),
  ]
)

export type DmcaCase = typeof dmcaCases.$inferSelect
export type LegalRequest = typeof legalRequests.$inferSelect
export type LegalHold = typeof legalHolds.$inferSelect
export type UserPrivacyRequest = typeof userPrivacyRequests.$inferSelect

export const scopeBanScopeTypeEnum = pgEnum('scope_ban_scope_type', ['organization', 'group'])

export const scopeBans = pgTable(
  'scope_bans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: scopeBanScopeTypeEnum('scope_type').notNull(),
    scopeId: uuid('scope_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    bannedByUserId: uuid('banned_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    active: boolean('active').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scope_bans_scope_user_idx').on(t.scopeType, t.scopeId, t.userId)]
)

/* --- Organizations (mini-ecosystems; declared before groups for FK) --- */

export const organizationVisibilityEnum = pgEnum('organization_visibility', ['PUBLIC', 'MEMBERS', 'PRIVATE'])

export const organizationMemberRoleEnum = pgEnum('organization_member_role', [
  'OWNER',
  'ADMIN',
  'MODERATOR',
  'STAFF',
  'MEMBER',
])

export const orgChannelKindEnum = pgEnum('org_channel_kind', [
  'TEXT',
  'ANNOUNCEMENTS',
  'VOICE',
  'VIDEO',
  'LIVE_STREAM',
  'DISCORD',
])

/** Presenter / author / photographer directory profile kind (education + events). */
export const presenterProfileKindEnum = pgEnum('presenter_profile_kind', ['PRES', 'AUTHOR', 'BOTH', 'PHOTO'])

/** Listed in /presenters directory vs link-only. */
export const presenterDirectoryVisibilityEnum = pgEnum('presenter_directory_visibility', [
  'PUBLIC',
  'UNLISTED',
])

/** Role focus within a presenter capability profile (distinct from profileKind). */
export const presenterProfileFocusEnum = pgEnum('presenter_profile_focus', [
  'EDUCATOR',
  'PRESENTER',
  'SPEAKER',
  'PANELIST',
  'AUTHOR',
  'PHOTOGRAPHER',
  'MEDIA_CREATOR',
  'DEMO_PARTNER',
  'FACILITATOR',
])

export const presenterReviewSourceEnum = pgEnum('presenter_review_source', ['ATTENDEE', 'ORGANIZATION'])

/** Connected external commerce source (Tier 1 aggregation + link-only). */
export const externalStoreTypeEnum = pgEnum('external_store_type', [
  'none',
  'etsy',
  'shopify',
  'woocommerce',
  'link_only',
])

/** Capability profile visibility independent from base profile visibility. */
export const capabilityVisibilityEnum = pgEnum('capability_visibility', ['PUBLIC', 'MEMBERS', 'HIDDEN'])

export const vendorCommissionStatusEnum = pgEnum('vendor_commission_status', ['OPEN', 'LIMITED', 'CLOSED'])

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    bio: text('bio'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    /** Open Graph / link preview image (1.91:1). Falls back to banner → logo. */
    shareImageUrl: text('share_image_url'),
    visibility: organizationVisibilityEnum('visibility').notNull().default('PUBLIC'),
    theme: jsonb('theme').notNull().default(sql`'{}'::jsonb`),
    featureFlags: jsonb('feature_flags').notNull().default(sql`'{}'::jsonb`),
    externalSiteUrl: text('external_site_url'),
    showExternalEmbed: boolean('show_external_embed').notNull().default(false),
    /** `text` = plain (render escaped or pre-wrap); `html` = sanitized subset (same pipeline as feed). */
    bioFormat: varchar('bio_format', { length: 8 }).notNull().default('text'),
    /** When false, gallery images are visible only to org members. */
    galleryPublic: boolean('gallery_public').notNull().default(false),
    rating: doublePrecision('rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    /** Community shell: welcome copy, FAQ, links, spotlight subgroup, recap pointers (see org PATCH). */
    community: jsonb('community').notNull().default(sql`'{}'::jsonb`),
    /** Stripe Connect connected account id (`acct_…`) for this org — org is merchant of record. */
    stripeConnectAccountId: text('stripe_connect_account_id'),
    stripeConnectChargesEnabled: boolean('stripe_connect_charges_enabled').notNull().default(false),
    stripeConnectPayoutsEnabled: boolean('stripe_connect_payouts_enabled').notNull().default(false),
    stripeConnectDetailsSubmitted: boolean('stripe_connect_details_submitted').notNull().default(false),
    stripeConnectUpdatedAt: timestamp('stripe_connect_updated_at', { withTimezone: true }),
    /**
     * Membership / dues plans mirrored from Stripe Prices on the connected account.
     * Shape: `{ plans: [{ priceId, productId?, name, interval, amountCents, currency, active }] }`
     */
    stripeMembershipConfig: jsonb('stripe_membership_config').notNull().default(sql`'{"plans":[]}'::jsonb`),
    /**
     * How this org collects money for tickets/dues:
     * - `stripe` — org Connect Checkout (platform keys; org connected account)
     * - `external` — link out to Eventbrite/PayPal/etc. (`external_payment_url`)
     * - `manual` — cash/comp; organizers mark `paidConfirmed`
     */
    paymentProcessor: varchar('payment_processor', { length: 32 }).notNull().default('stripe'),
    /** Default off-platform checkout URL when `payment_processor` is `external`. */
    externalPaymentUrl: text('external_payment_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organizations_owner_id_idx').on(t.ownerId),
    uniqueIndex('organizations_stripe_connect_account_id_uq').on(t.stripeConnectAccountId),
  ]
)

export const organizationGalleryImages = pgTable(
  'organization_gallery_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('organization_gallery_images_org_idx').on(t.organizationId)]
)

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: organizationMemberRoleEnum('role').notNull().default('MEMBER'),
    localReputation: integer('local_reputation').notNull().default(0),
    /** Opt-in: show this member on the org public member directory. */
    listedInOrgDirectory: boolean('listed_in_org_directory').notNull().default(false),
    volunteerTags: text('volunteer_tags').array().notNull().default(sql`'{}'::text[]`),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Paid membership / dues state from Stripe Billing webhooks.
     * Shape: `{ status, stripeSubscriptionId?, stripeCustomerId?, stripePriceId?, currentPeriodEnd? }`
     */
    membershipBilling: jsonb('membership_billing').notNull().default(sql`'{}'::jsonb`),
    /**
     * Owner-delegated: manage org Stripe Connect / payment processor settings.
     * Org `ownerId` always may manage; ADMIN role alone is not enough.
     */
    canManagePayments: boolean('can_manage_payments').notNull().default(false),
  },
  (t) => [uniqueIndex('organization_members_org_user_idx').on(t.organizationId, t.userId)]
)

/* --- E3: Groups --- */

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    /** Discovery category pill; canonical purpose values in @c2k/shared GROUP_CATEGORIES. */
    category: varchar('category', { length: 64 }),
    /** Freeform interest tags for search and cards (lowercase, max 20). */
    tags: text('tags').array(),
    /** Short public summary for browse cards and group page. */
    description: text('description'),
    visibility: varchar('visibility', { length: 32 }).notNull().default('public'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    shareImageUrl: text('share_image_url'),
    placeId: uuid('place_id').references(() => places.id, { onDelete: 'set null' }),
    serviceRadiusMi: integer('service_radius_mi').notNull().default(50),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    idleWarningSentAt: timestamp('idle_warning_sent_at', { withTimezone: true }),
    disbandedAt: timestamp('disbanded_at', { withTimezone: true }),
    leadershipVoteOpen: boolean('leadership_vote_open').notNull().default(false),
    ownerAbsentMarkedAt: timestamp('owner_absent_marked_at', { withTimezone: true }),
    /** Public email list signup on group page (organizer broadcasts via scope email API). */
    emailSignupEnabled: boolean('email_signup_enabled').notNull().default(false),
    /** Join modal accordion rules (SG-096); `[{ title, body }]`. */
    rules: jsonb('rules').notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [index('groups_organization_id_idx').on(t.organizationId)]
)

/** Org/group mailing-list subscribers (marketing opt-in on public pages). */
export const scopeEmailSubscribers = pgTable(
  'scope_email_subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: varchar('scope_type', { length: 16 }).notNull(),
    scopeId: uuid('scope_id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: varchar('display_name', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    source: varchar('source', { length: 32 }).notNull().default('public_form'),
    optedInAt: timestamp('opted_in_at', { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    confirmTokenHash: varchar('confirm_token_hash', { length: 64 }),
    confirmExpiresAt: timestamp('confirm_expires_at', { withTimezone: true }),
  },
  (t) => [
    index('scope_email_subscribers_scope_idx').on(t.scopeType, t.scopeId, t.status),
    uniqueIndex('scope_email_subscribers_scope_email_idx').on(t.scopeType, t.scopeId, t.email),
  ]
)

/** Site-owner marketing archive: every list signup + optional broadcast metadata. */
export const platformEmailCaptures = pgTable(
  'platform_email_captures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    eventType: varchar('event_type', { length: 32 }).notNull(),
    scopeType: varchar('scope_type', { length: 16 }),
    scopeId: uuid('scope_id'),
    scopeName: varchar('scope_name', { length: 255 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('platform_email_captures_email_idx').on(t.email),
    index('platform_email_captures_created_idx').on(t.createdAt),
  ]
)

export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  memberListVisibility: varchar('member_list_visibility', { length: 16 }).notNull().default('visible'),
  showGroupOnProfile: boolean('show_group_on_profile').notNull().default(true),
  announceGroupJoinInFeed: boolean('announce_group_join_in_feed').notNull().default(true),
  visibilityUpdatedAt: timestamp('visibility_updated_at', { withTimezone: true }),
  visibilityUpdatedByUserId: uuid('visibility_updated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
})

export const groupReviewSentimentEnum = pgEnum('group_review_sentiment', ['POSITIVE', 'NEGATIVE'])

/** Member-only reputation signal for a group (one row per member per group). */
export const groupReviews = pgTable(
  'group_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sentiment: groupReviewSentimentEnum('sentiment').notNull(),
    body: text('body'),
    cultureRating: integer('culture_rating'),
    newMemberFriendlinessRating: integer('new_member_friendliness_rating'),
    moderationQualityRating: integer('moderation_quality_rating'),
    safetyResponsivenessRating: integer('safety_responsiveness_rating'),
    eventUsefulnessRating: integer('event_usefulness_rating'),
    communicationClarityRating: integer('communication_clarity_rating'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('group_reviews_group_author_idx').on(t.groupId, t.authorId)]
)

/** One vote per member while `groups.leadership_vote_open` (steward election). */
export const groupLeadershipVotes = pgTable(
  'group_leadership_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    voterId: uuid('voter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    candidateUserId: uuid('candidate_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('group_leadership_votes_group_voter_idx').on(t.groupId, t.voterId)]
)

/* --- E4: Events & payments --- */

/** Virtual munch vs class/webinar presentation (only meaningful when `event_format = virtual`). */
export const virtualSessionStyleEnum = pgEnum('virtual_session_style', ['social', 'education', 'mixed'])

/** In-person full address disclosure tier (see docs/adr/003-irl-event-location-privacy.md). */
export const eventLocationVisibilityEnum = pgEnum('event_location_visibility', ['public', 'rsvp', 'approved'])

/** Host approval for `location_visibility = approved` when RSVP is going. */
export const eventRsvpApprovalEnum = pgEnum('event_rsvp_approval', [
  'not_required',
  'pending',
  'approved',
  'rejected',
])

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    location: varchar('location', { length: 512 }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    visibility: varchar('visibility', { length: 32 }).notNull().default('public'),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    /** When set, event takes place at this community map pin (venue) even if hosted by another org. */
    venuePlaceId: uuid('venue_place_id').references(() => communityPlaces.id, { onDelete: 'set null' }),
    category: varchar('category', { length: 64 }),
    tags: text('tags').array(),
    imageUrl: text('image_url'),
    eventFormat: varchar('event_format', { length: 16 }).notNull().default('in-person'),
    rsvpCount: integer('rsvp_count').notNull().default(0),
    stripePriceId: text('stripe_price_id'),
    /**
     * Optional ticket fee (cents). When set and org uses Stripe Connect, attendees can
     * pay via Checkout; otherwise use ticketPurchaseUrl / expectedCostText / manual.
     */
    priceCents: integer('price_cents'),
    ticketPurchaseUrl: text('ticket_purchase_url'),
    ticketingProvider: varchar('ticketing_provider', { length: 64 }),
    ticketEmbedUrl: text('ticket_embed_url'),
    /** Munch / simple event UX: e.g. "Casual", "Black tie optional". */
    dressCode: text('dress_code'),
    /** Free-form cost hint: e.g. "Free", "$10–15", "Cash bar". */
    expectedCostText: varchar('expected_cost_text', { length: 256 }),
    /** social = munch/hangout; education = class/webinar; mixed = both (virtual only). */
    virtualSessionStyle: virtualSessionStyleEnum('virtual_session_style'),
    /** Short agenda / flow for virtual classes when not using a full convention program. */
    virtualAgenda: text('virtual_agenda'),
    /** Optional link to slides, handout, or prep materials (virtual class/education). */
    materialsUrl: text('materials_url'),
    /** not_recorded | live_only | shared_with_registrants | tbd */
    recordingPolicy: varchar('recording_policy', { length: 32 }),
    /** IANA tz for display alongside UTC-stored startsAt (e.g. America/New_York). */
    eventTimezone: varchar('event_timezone', { length: 64 }),
    locationVisibility: eventLocationVisibilityEnum('location_visibility').notNull().default('public'),
    /** Shown when full `location` is redacted (neighborhood, venue name without street). */
    publicLocationSummary: varchar('public_location_summary', { length: 512 }),
    /** Optional question answered at RSVP (going/maybe). */
    screeningQuestion: text('screening_question'),
    newcomerFriendly: boolean('newcomer_friendly').notNull().default(false),
    accessibilityNotes: text('accessibility_notes'),
    /** When set, committed going is capped; overflow → waitlist. */
    capacityMax: integer('capacity_max'),
    /** `public` = names on attendee API; `count_only` = counts only for non-host viewers. */
    attendeeListVisibility: varchar('attendee_list_visibility', { length: 32 }).notNull().default('public'),
    /** Curated spotlight on browse/discovery grids (not paid bump). */
    featured: boolean('featured').notNull().default(false),
    /** When set, featured badge hides after this instant (UTC). */
    featuredUntil: timestamp('featured_until', { withTimezone: true }),
    /** When false, new/changed RSVPs are rejected (cancel via not_going still allowed). */
    rsvpOpen: boolean('rsvp_open').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('events_organization_id_idx').on(t.organizationId)]
)

export const eventRsvpStatusEnum = pgEnum('event_rsvp_status', ['going', 'maybe', 'not_going', 'waitlist'])

export const eventRsvps = pgTable(
  'event_rsvps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: eventRsvpStatusEnum('status').notNull().default('going'),
    rsvpApprovalStatus: eventRsvpApprovalEnum('rsvp_approval_status').notNull().default('not_required'),
    screeningAnswer: text('screening_answer'),
    /** Set by Stripe webhook (or host) when ticket fee is paid. */
    paidConfirmed: boolean('paid_confirmed').notNull().default(false),
    /** Worker sets when 24h in-app reminder sent (virtual events only). */
    reminderVirtual24hSentAt: timestamp('reminder_virtual_24h_sent_at', { withTimezone: true }),
    /** Worker sets when ~1h in-app reminder sent (virtual events only). */
    reminderVirtual1hSentAt: timestamp('reminder_virtual_1h_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('event_rsvps_event_user_idx').on(t.eventId, t.userId),
    index('event_rsvps_user_id_idx').on(t.userId),
  ]
)

export const feedPostKindEnum = pgEnum('feed_post_kind', ['status', 'article', 'repost'])

export const feedPosts = pgTable(
  'feed_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: feedPostKindEnum('kind').notNull().default('status'),
    title: varchar('title', { length: 512 }),
    body: text('body').notNull().default(''),
    /** `text` = plain (escaped client-side); `html` = sanitized subset. */
    bodyFormat: varchar('body_format', { length: 16 }).notNull().default('text'),
    attachments: jsonb('attachments').notNull().default(sql`'[]'::jsonb`),
    mentions: jsonb('mentions').notNull().default(sql`'[]'::jsonb`),
    repostOfId: uuid('repost_of_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('feed_posts_author_id_idx').on(t.authorId),
    index('feed_posts_created_at_idx').on(t.createdAt),
    index('feed_posts_repost_of_idx').on(t.repostOfId),
  ]
)

export const postLikes = pgTable(
  'post_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedPosts.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull().default('love'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index('post_likes_post_id_idx').on(t.postId),
    index('post_likes_post_created_idx').on(t.postId, t.createdAt),
    index('post_likes_post_kind_idx').on(t.postId, t.kind),
  ]
)

export const feedPostComments = pgTable(
  'feed_post_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedPosts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feed_post_comments_post_created_idx').on(t.postId, t.createdAt)],
)

export const educationArticleVisibilityEnum = pgEnum('education_article_visibility', [
  'PUBLIC',
  'MEMBERS',
  'CONNECTIONS',
])

export const educationArticlePublicationStatusEnum = pgEnum('education_article_publication_status', [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
])

export const educationArticles = pgTable(
  'education_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    presenterProfileUserId: uuid('presenter_profile_user_id').references(() => presenterProfiles.userId, {
      onDelete: 'set null',
    }),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    excerpt: text('excerpt'),
    bodyJson: jsonb('body_json').notNull().default(sql`'{}'::jsonb`),
    bodyHtml: text('body_html').notNull().default(''),
    heroImageUrl: text('hero_image_url'),
    categories: text('categories').array().notNull().default(sql`'{}'::text[]`),
    difficulty: varchar('difficulty', { length: 32 }),
    contentWarnings: text('content_warnings').array().notNull().default(sql`'{}'::text[]`),
    readingMinutes: integer('reading_minutes'),
    linkedOfferingIds: uuid('linked_offering_ids').array().notNull().default(sql`'{}'::uuid[]`),
    visibility: educationArticleVisibilityEnum('visibility').notNull().default('PUBLIC'),
    listInEducation: boolean('list_in_education').notNull().default(false),
    publicationStatus: educationArticlePublicationStatusEnum('publication_status').notNull().default('DRAFT'),
    eckePublish: boolean('ecke_publish').notNull().default(false),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('education_articles_slug_uq').on(t.slug),
    index('education_articles_author_updated_idx').on(t.authorUserId, t.updatedAt),
    index('education_articles_hub_idx').on(t.listInEducation, t.publicationStatus, t.publishedAt),
  ]
)

/** Ordered article series (Kink 101 → 102 → 103); articles remain first-class rows. */
export const educationArticleSeries = pgTable(
  'education_article_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 512 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    description: text('description'),
    listInEducation: boolean('list_in_education').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('education_article_series_slug_uq').on(t.slug),
    index('education_article_series_author_idx').on(t.authorUserId, t.updatedAt),
  ],
)

export const educationArticleSeriesItems = pgTable(
  'education_article_series_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => educationArticleSeries.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => educationArticles.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(1),
  },
  (t) => [
    uniqueIndex('education_article_series_items_series_article_uq').on(t.seriesId, t.articleId),
    uniqueIndex('education_article_series_items_article_uq').on(t.articleId),
    index('education_article_series_items_series_sort_idx').on(t.seriesId, t.sortOrder),
  ],
)

export const mediaFormatEnum = pgEnum('media_format', ['podcast', 'video', 'hybrid'])

export const mediaPublicationStatusEnum = pgEnum('media_publication_status', [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
])

/** Off-platform podcast / video channel directory (link-out only). */
export const mediaShows = pgTable(
  'media_shows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    presenterProfileUserId: uuid('presenter_profile_user_id').references(() => presenterProfiles.userId, {
      onDelete: 'set null',
    }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    mediaFormat: mediaFormatEnum('media_format').notNull().default('podcast'),
    rssFeedUrl: text('rss_feed_url'),
    youtubeChannelUrl: text('youtube_channel_url'),
    youtubePlaylistUrl: text('youtube_playlist_url'),
    spotifyShowUrl: text('spotify_show_url'),
    applePodcastsUrl: text('apple_podcasts_url'),
    websiteUrl: text('website_url'),
    twitchUrl: text('twitch_url'),
    rumbleUrl: text('rumble_url'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    contentWarnings: text('content_warnings').array().notNull().default(sql`'{}'::text[]`),
    listInMedia: boolean('list_in_media').notNull().default(false),
    publicationStatus: mediaPublicationStatusEnum('publication_status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    lastEpisodeSyncedAt: timestamp('last_episode_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_shows_slug_uq').on(t.slug),
    index('media_shows_hub_idx').on(t.listInMedia, t.publicationStatus, t.updatedAt),
    index('media_shows_owner_idx').on(t.ownerUserId, t.updatedAt),
    index('media_shows_presenter_idx').on(t.presenterProfileUserId),
  ],
)

/** Episode/release metadata only - playback is always off-platform. */
export const mediaShowEpisodes = pgTable(
  'media_show_episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    showId: uuid('show_id')
      .notNull()
      .references(() => mediaShows.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    description: text('description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    rssGuid: text('rss_guid'),
    externalAudioUrl: text('external_audio_url'),
    youtubeVideoUrl: text('youtube_video_url'),
    spotifyEpisodeUrl: text('spotify_episode_url'),
    appleEpisodeUrl: text('apple_episode_url'),
    websiteUrl: text('website_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_show_episodes_show_slug_uq').on(t.showId, t.slug),
    uniqueIndex('media_show_episodes_show_guid_uq').on(t.showId, t.rssGuid),
    index('media_show_episodes_show_published_idx').on(t.showId, t.publishedAt),
  ],
)

/** Activity-centric feed rows (Following mode); posts stay in feed_posts. */
export const feedActivities = pgTable(
  'feed_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    verb: varchar('verb', { length: 64 }).notNull(),
    objectType: varchar('object_type', { length: 64 }).notNull(),
    objectId: varchar('object_id', { length: 256 }).notNull(),
    audienceType: varchar('audience_type', { length: 32 }).notNull().default('followers'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('feed_activities_created_at_idx').on(t.createdAt),
    index('feed_activities_actor_created_idx').on(t.actorId, t.createdAt),
  ]
)

/** Read-later saves (posts, articles, threads) - polymorphic target. */
export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    objectType: varchar('object_type', { length: 64 }).notNull(),
    objectId: varchar('object_id', { length: 256 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.objectType, t.objectId] }),
    index('user_bookmarks_user_created_idx').on(t.userId, t.createdAt),
  ]
)

/* --- E5: Vendors --- */

export const vendorShopHeaderLayoutEnum = pgEnum('vendor_shop_header_layout', ['OVERLAY', 'BELOW'])

export const vendorProfiles = pgTable('vendor_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  bio: text('bio'),
  /** Optional narrative: who you make for / your craft story (public shop). */
  makerStory: text('maker_story'),
  /** Vendor-owned policies (returns, lead time, etc.) - not platform endorsement. */
  shopPolicies: jsonb('shop_policies'),
  bannerUrl: text('banner_url'),
  logoUrl: text('logo_url'),
  /** Title/rating/tags on banner gradient vs card row below (logo-friendly). */
  shopHeaderLayout: vendorShopHeaderLayoutEnum('shop_header_layout').notNull().default('OVERLAY'),
  website: text('website'),
  categories: text('categories').array().notNull().default(sql`'{}'::text[]`),
  /** Purpose-based discovery category (canonical label from @c2k/shared). */
  category: varchar('category', { length: 64 }),
  /** Freeform specialty tags for search and filters. */
  tags: text('tags').array(),
  rating: doublePrecision('rating').notNull().default(0),
  shipsTo: varchar('ships_to', { length: 32 }).notNull().default('US'),
  visibility: capabilityVisibilityEnum('visibility').notNull().default('PUBLIC'),
  commissionStatus: vendorCommissionStatusEnum('commission_status').notNull().default('OPEN'),
  commissionNotes: text('commission_notes'),
  verified: boolean('verified').notNull().default(false),
  /** Primary external connector type (unified aggregation). */
  externalStoreType: externalStoreTypeEnum('external_store_type').notNull().default('none'),
  /** Non-secret config: e.g. `{ shopifyShop, wooSiteUrl, storefrontLabel }`. */
  externalStorePublic: jsonb('external_store_public'),
  /** AES-GCM encrypted JSON: tokens / Woo keys (see `encrypt-external-secrets.ts`). */
  externalStoreSecretsEnc: text('external_store_secrets_enc'),
  externalListingsSyncedAt: timestamp('external_listings_synced_at', { withTimezone: true }),
  externalSyncError: text('external_sync_error'),
  /** When true, vendor links an Etsy shop; listings served from vendor_external_listings. */
  usesEtsy: boolean('uses_etsy').notNull().default(false),
  /** Etsy numeric shop id as string (Etsy uses int64). */
  etsyShopId: varchar('etsy_shop_id', { length: 32 }),
  /** Shop page URL on Etsy (from API or user paste). */
  etsyShopUrl: text('etsy_shop_url'),
  etsyShopName: varchar('etsy_shop_name', { length: 255 }),
  etsyListingsSyncedAt: timestamp('etsy_listings_synced_at', { withTimezone: true }),
  etsySyncError: text('etsy_sync_error'),
  /** When true, vendor listing auto-syncs to ECKE vendors table after publish. */
  eckePublish: boolean('ecke_publish').notNull().default(false),
  /**
   * How this vendor collects money for in-platform product Checkout:
   * - `stripe` — vendor Connect account (vendor is MoR)
   * - `external` — listing/storefront URLs (default today)
   * - `manual` — inquire / off-platform only
   */
  paymentProcessor: varchar('payment_processor', { length: 32 }).notNull().default('external'),
  externalPaymentUrl: text('external_payment_url'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  stripeConnectChargesEnabled: boolean('stripe_connect_charges_enabled').notNull().default(false),
  stripeConnectPayoutsEnabled: boolean('stripe_connect_payouts_enabled').notNull().default(false),
  stripeConnectDetailsSubmitted: boolean('stripe_connect_details_submitted').notNull().default(false),
  stripeConnectUpdatedAt: timestamp('stripe_connect_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Additional shop managers shown publicly; primary owner remains `vendor_profiles.user_id`. */
export const vendorCoOwners = pgTable(
  'vendor_co_owners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorProfileId: uuid('vendor_profile_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('vendor_co_owners_vendor_user_idx').on(t.vendorProfileId, t.userId),
    index('vendor_co_owners_vendor_idx').on(t.vendorProfileId),
  ],
)

/** Cached external listing rows (Etsy / Shopify / WooCommerce) for vendor storefront. */
export const vendorExternalListings = pgTable(
  'vendor_external_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalListingId: varchar('external_listing_id', { length: 128 }).notNull(),
    title: text('title').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    primaryImageUrl: text('primary_image_url'),
    listingUrl: text('listing_url').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb('raw'),
  },
  (t) => [
    index('vendor_external_listings_vendor_idx').on(t.vendorId),
    uniqueIndex('vendor_external_listings_vendor_provider_listing_idx').on(
      t.vendorId,
      t.provider,
      t.externalListingId
    ),
  ]
)

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  priceCents: integer('price_cents').notNull(),
  primaryImageUrl: text('primary_image_url'),
  /** Outbound buy / product page URL; optional when vendor uses in-platform Stripe Checkout. */
  listingUrl: text('listing_url').notNull().default('#'),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const vendorBlindFeedbackStatusEnum = pgEnum('vendor_blind_feedback_status', [
  'PENDING',
  'VERIFIED',
  'DISMISSED',
])

/** Purchaser ratings hidden from vendor until verified (irreversible verify). */
export const vendorBlindFeedback = pgTable(
  'vendor_blind_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorProfileId: uuid('vendor_profile_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body'),
    /** S3 object key - receipt or product photo; owner reviews at verify time (not rating/body). */
    purchaseProofKey: text('purchase_proof_key'),
    status: vendorBlindFeedbackStatusEnum('status').notNull().default('PENDING'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_blind_feedback_vendor_idx').on(t.vendorProfileId),
    uniqueIndex('vendor_blind_feedback_vendor_author_idx').on(t.vendorProfileId, t.authorUserId),
  ]
)

export const organizationFeaturedVendors = pgTable(
  'organization_featured_vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    vendorProfileId: uuid('vendor_profile_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    label: varchar('label', { length: 128 }),
  },
  (t) => [
    index('organization_featured_vendors_org_idx').on(t.organizationId),
    uniqueIndex('organization_featured_vendors_org_vendor_idx').on(t.organizationId, t.vendorProfileId),
  ]
)

export const organizationFeaturedArticles = pgTable(
  'organization_featured_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    educationArticleId: uuid('education_article_id')
      .notNull()
      .references(() => educationArticles.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    label: varchar('label', { length: 128 }),
  },
  (t) => [
    index('organization_featured_articles_org_idx').on(t.organizationId),
    uniqueIndex('organization_featured_articles_org_article_idx').on(
      t.organizationId,
      t.educationArticleId,
    ),
  ]
)

/* --- Forums: organization OR standalone group (exactly one) --- */

export const forumCategories = pgTable(
  'forum_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('forum_categories_org_idx').on(t.organizationId),
    index('forum_categories_group_idx').on(t.groupId),
    check(
      'forum_categories_org_xor_group',
      sql`(organization_id IS NOT NULL AND group_id IS NULL) OR (organization_id IS NULL AND group_id IS NOT NULL)`
    ),
  ]
)

export const forumThreads = pgTable(
  'forum_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => forumCategories.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 512 }).notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedByUserId: uuid('locked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('forum_threads_org_idx').on(t.organizationId),
    index('forum_threads_group_idx').on(t.groupId),
    index('forum_threads_event_idx').on(t.eventId),
    check(
      'forum_threads_single_scope',
      sql`(
        (organization_id IS NOT NULL)::int +
        (group_id IS NOT NULL)::int +
        (event_id IS NOT NULL)::int
      ) = 1`
    ),
  ]
)

export const communityPlaceCategoryEnum = pgEnum('community_place_category', [
  'dungeon_club',
  'nude_beach',
  'kink_friendly_hotel',
  'web_resource',
  'other',
])

export const communityPlaceStatusEnum = pgEnum('community_place_status', [
  'published',
  'pending_moderation',
])

export const communityPlaces = pgTable(
  'community_places',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 128 }).notNull(),
    category: communityPlaceCategoryEnum('category').notNull().default('other'),
    description: text('description'),
    logoUrl: text('logo_url'),
    /** When set, this map pin corresponds to a managed organization hub. */
    linkedOrganizationId: uuid('linked_organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    city: varchar('city', { length: 128 }),
    region: varchar('region', { length: 128 }),
    country: varchar('country', { length: 128 }),
    status: communityPlaceStatusEnum('status').notNull().default('pending_moderation'),
    eckePublish: boolean('ecke_publish').notNull().default(false),
    submittedByUserId: uuid('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('community_places_slug_idx').on(t.slug),
    index('community_places_category_idx').on(t.category),
    index('community_places_status_idx').on(t.status),
  ]
)

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenByUserId: uuid('hidden_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('forum_posts_thread_idx').on(t.threadId)]
)

export const forumPostReactionKindEnum = pgEnum('forum_post_reaction_kind', ['thanks', 'helpful'])

export const forumPostReactions = pgTable(
  'forum_post_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => forumPosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: forumPostReactionKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('forum_post_reactions_post_user_kind_idx').on(t.postId, t.userId, t.kind),
    index('forum_post_reactions_post_idx').on(t.postId),
  ]
)

/* --- Organization chat channels (separate from DM conversations) --- */

export const orgChannelCategories = pgTable(
  'org_channel_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('org_channel_categories_org_idx').on(t.organizationId)]
)

export const orgChannels = pgTable(
  'org_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => orgChannelCategories.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    kind: orgChannelKindEnum('kind').notNull().default('TEXT'),
    /** Min seconds between messages from the same member; null = off. */
    slowModeSeconds: integer('slow_mode_seconds'),
    /** Discord widget URL, invite link, or server ID when kind = DISCORD. */
    embedUrl: varchar('embed_url', { length: 512 }),
    /** When set, only convention attendees (or staff) for this convention may read/post. */
    requiresConventionId: uuid('requires_convention_id').references(() => conventions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('org_channels_org_slug_idx').on(t.organizationId, t.slug),
    index('org_channels_requires_conv_idx').on(t.requiresConventionId),
  ]
)

export const conventionChannelReads = pgTable(
  'convention_channel_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => orgChannels.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })]
)

export const orgChannelMessages = pgTable(
  'org_channel_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgChannelId: uuid('org_channel_id')
      .notNull()
      .references(() => orgChannels.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenByUserId: uuid('hidden_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('org_channel_messages_channel_idx').on(t.orgChannelId)]
)

/* --- Organization & event reviews (local rep + rollup inputs) --- */

export const organizationReviews = pgTable(
  'organization_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('organization_reviews_org_author_idx').on(t.organizationId, t.authorId)]
)

export const organizationEventReviews = pgTable(
  'organization_event_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('organization_event_reviews_event_author_idx').on(t.eventId, t.authorId)]
)

/* --- E7: Messaging --- */

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  initiatorUserId: uuid('initiator_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** When `iso`, thread was opened from an ISO surface; `iso_subject_user_id` is the profile whose ISO was used. */
  dmEntryPoint: varchar('dm_entry_point', { length: 16 }),
  isoSubjectUserId: uuid('iso_subject_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    acceptanceStatus: dmAcceptanceStatusEnum('acceptance_status').notNull().default('ACCEPTED'),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    isFavorite: boolean('is_favorite').notNull().default(false),
    /** User removed conversation from their inbox; purge after retention window. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]
)

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  /** `text` = plain; `html` = server-sanitized subset (organizer campaigns, rich DMs). */
  bodyFormat: varchar('body_format', { length: 16 }).notNull().default('text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** One editable "In Search Of" wishlist per user (convention/group surfaces pin separately). */
export const userIsoPosts = pgTable(
  'user_iso_posts',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    /** Structured ISO header / menu / scene pitches (iso_v2). */
    structured: jsonb('structured').$type<Record<string, unknown>>().notNull().default({}),
    visibility: profileVisibilityEnum('visibility').notNull().default('MEMBERS'),
    acceptDmsViaIso: boolean('accept_dms_via_iso').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('user_iso_posts_visibility_idx').on(t.visibility)]
)

/** Up to three images attached to a user's ISO (URLs from upload pipeline). */
export const userIsoImages = pgTable(
  'user_iso_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    url: text('url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_iso_images_user_sort_idx').on(t.userId, t.sortOrder),
    index('user_iso_images_user_idx').on(t.userId),
  ]
)

/* --- E8: Conventions & program schedule --- */

/** Public-facing logistics (hotel codes, venue archetype, CoC links). Stored as jsonb for flexible evolution. */
export type ConventionPublicSettings = {
  venueProfile?: 'single_venue' | 'hotel_takeover' | 'camping' | 'urban_multi_venue' | 'other'
  hotelBlocks?: Array<{ label: string; url?: string; code?: string }>
  cocUrl?: string
  safetyReportingNote?: string
  accessibilityVenueNotes?: string
  /** When false, schedule API requires attendee/staff/mod access. When true or omitted, program is public. */
  publicProgramListing?: boolean
  /** When false, convention ISO board is hidden and pins are disabled for attendees. Default true when omitted. */
  isoBoardEnabled?: boolean
  /**
   * When non-empty, attendees and public program readers see matching `schedule_slot_staff` rows
   * (substring match on `roleLabel`, case-insensitive). Full staff list remains for org moderators + convention staff.
   */
  programStaffAttendeeRoles?: string[]
  /** Public ECKE listing slug when different from convention slug. */
  eckeListingSlug?: string
  /**
   * Organizer-authored marketing extras pushed into the public ECKE `events` row so the
   * eastcoastkinkevents.com page is rich out of the box (highlights list, venue, official site).
   */
  eckeListing?: {
    /** "What to expect" bullet highlights, rendered as a list on the ECKE event page. */
    highlights?: string[]
    /** Named venue (e.g. "Hyatt Regency Baltimore"). */
    venueName?: string | null
    /** Official external website for the convention (powers the "Visit official site" CTA). */
    websiteUrl?: string | null
  }
  /** When set, program ops run on ECKE Dancecard; see docs in EastCoast-master dancecard-c2k-integration.md */
  dancecardSlug?: string
  dancecardHost?: string
  dancecardEnabled?: boolean
  /** Optional embed token id reference (minted on ECKE Integrations) for schedule iframe */
  dancecardEmbedTokenHint?: string
  /** Open ECKE attendee program in same tab vs new tab from C2K Schedule */
  dancecardAttendeeSameTab?: boolean
  /** Link preview image (1.91:1). Falls back to anchor event hero when unset. */
  shareImageUrl?: string | null
  /** Outbound Dancecard event status when publishing to ECKE Supabase. */
  dancecardPublishStatus?: 'draft' | 'published'
  /** ECKE Dancecard registration gate (empty = open). */
  registrationAccessCode?: string
  /** ECKE Dancecard staff/volunteer unlock code. */
  staffAccessCode?: string
  /** Organizer-defined room/play-space names for the venue availability grid. */
  venueRooms?: string[]
  /** Event Systems / dancecard kit fields (settings tab). */
  eventSystems?: {
    productTitle?: string
    eventTitle?: string
    sharedByLabel?: string
    sharedByDetail?: string | null
    logoUrl?: string | null
    /** High-resolution logo dedicated to badge printing; falls back to logoUrl. */
    badgeLogoUrl?: string | null
    badgeLayoutJson?: Record<string, unknown>
    themeConfig?: Record<string, unknown>
    eventProfile?: string
    attendeeGuideJson?: Record<string, unknown>
    agreementsConfig?: Record<string, unknown>
    attendeeProfileConfig?: Record<string, unknown>
    /** `munch` hides advanced People hub sub-tabs (RSVP-first events). */
    peopleHubTemplate?: 'full' | 'munch'
  }
  /** Public apply windows, offer templates, and trusted-role links for participation paths. */
  participation?: ConventionParticipationSettings
}

export const conventions = pgTable(
  'conventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    /** Owning org when this is an org-run convention. */
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    /** Primary calendar event row (ticketing, banner). */
    anchorEventId: uuid('anchor_event_id').references(() => events.id, { onDelete: 'set null' }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('America/New_York'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    settings: jsonb('settings')
      .$type<ConventionPublicSettings>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conventions_org_idx').on(t.organizationId), index('conventions_anchor_event_idx').on(t.anchorEventId)]
)

export const conventionGalleryImages = pgTable(
  'convention_gallery_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    imageUrl: text('image_url').notNull(),
    caption: varchar('caption', { length: 500 }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    moderationStatus: varchar('moderation_status', { length: 20 }).notNull().default('approved'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_gallery_images_conv_idx').on(t.conventionId, t.sortOrder)]
)

/** Convention-scoped chat channels (C212 - separate from org_channels). */
export const conventionHubChannels = pgTable(
  'convention_hub_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('CHAT'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_hub_channels_conv_slug_idx').on(t.conventionId, t.slug),
    index('convention_hub_channels_conv_idx').on(t.conventionId, t.sortOrder),
  ]
)

export const conventionHubChannelMessages = pgTable(
  'convention_hub_channel_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => conventionHubChannels.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    parentMessageId: uuid('parent_message_id'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenByUserId: uuid('hidden_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_hub_channel_messages_channel_idx').on(t.channelId, t.createdAt)]
)

export const conventionHubChannelReads = pgTable(
  'convention_hub_channel_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => conventionHubChannels.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })]
)

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('push_subscriptions_user_endpoint_idx').on(t.userId, t.endpoint)]
)

export const conventionPins = pgTable(
  'convention_pins',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conventionId] }), index('convention_pins_user_idx').on(t.userId, t.pinnedAt)]
)

/** Member opted to list their ISO on a convention board; staff can soft-remove without deleting the user's ISO. */
export const conventionIsoListings = pgTable(
  'convention_iso_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    removedByStaffAt: timestamp('removed_by_staff_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('convention_iso_listings_convention_user_idx').on(t.conventionId, t.userId),
    index('convention_iso_listings_convention_idx').on(t.conventionId),
  ]
)

export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    description: text('description'),
    location: varchar('location', { length: 512 }),
    linkUrl: text('link_url'),
    /** Optional gallery URLs for class / slot detail. */
    imageGallery: jsonb('image_gallery').notNull().default(sql`'[]'::jsonb`),
    /** Tie multi-row blocks (e.g. multi-slot class). */
    blockId: uuid('block_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Track / room labels for multi-track grids and conflict hints. */
    trackLabel: varchar('track_label', { length: 128 }),
    roomLabel: varchar('room_label', { length: 128 }),
    /** FK to convention_locations (Dancecard parity). */
    locationId: uuid('location_id'),
    /** FK to convention_tracks when track taxonomy is used. */
    trackId: uuid('track_id'),
    isPublished: boolean('is_published').notNull().default(true),
    visibility: varchar('visibility', { length: 32 }).notNull().default('ATTENDEE'),
    isFrozen: boolean('is_frozen').notNull().default(false),
    organizerNotes: text('organizer_notes'),
    /** When true, slot is in the unscheduled library (times are placeholders). */
    isUnscheduled: boolean('is_unscheduled').notNull().default(false),
    /** Optional link to `presenter_offerings.id` (ecosystem spine; FK added after table order in DB). */
    presenterOfferingId: uuid('presenter_offering_id'),
    /** Stable key for CSV import idempotency (per convention). */
    importKey: varchar('import_key', { length: 128 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('schedule_slots_convention_idx').on(t.conventionId),
    index('schedule_slots_block_idx').on(t.blockId),
    index('schedule_slots_import_key_idx').on(t.conventionId, t.importKey),
  ]
)

/** Extended presenter bio; links to profiles.userId. */
export const presenterProfiles = pgTable(
  'presenter_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    headline: varchar('headline', { length: 255 }),
    /** Card / directory blurb; full narrative in `bio`. */
    bioShort: text('bio_short'),
    bio: text('bio'),
    links: jsonb('links').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    profileKind: presenterProfileKindEnum('profile_kind').notNull().default('PRES'),
    expertiseTags: text('expertise_tags').array(),
    directoryVisibility: presenterDirectoryVisibilityEnum('directory_visibility').notNull().default('UNLISTED'),
    eckePublish: boolean('ecke_publish').notNull().default(false),
    /** Weighted rollup from `presenter_reviews` (org-weighted in application). */
    ratingAvg: doublePrecision('rating_avg').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    backgroundStory: text('background_story'),
    mentorshipOffered: boolean('mentorship_offered').notNull().default(false),
    mentorshipNotes: text('mentorship_notes'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('presenter_profiles_directory_idx').on(t.directoryVisibility)]
)

/** Expressive role focuses for a presenter capability profile (one users.id). */
export const presenterProfileFocuses = pgTable(
  'presenter_profile_focuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => presenterProfiles.userId, { onDelete: 'cascade' }),
    focus: presenterProfileFocusEnum('focus').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('presenter_profile_focuses_user_idx').on(t.userId),
    uniqueIndex('presenter_profile_focuses_user_focus_uq').on(t.userId, t.focus),
  ]
)

/** Catalog entries: what a presenter offers (tease for orgs); not a scheduled slot. */
export const presenterOfferings = pgTable(
  'presenter_offerings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 512 }).notNull(),
    tease: text('tease'),
    outline: text('outline'),
    durationMinutes: integer('duration_minutes'),
    level: varchar('level', { length: 64 }),
    format: varchar('format', { length: 64 }),
    tags: text('tags').array(),
    /** Handouts / doc links - only returned to presenter + org runners (see `presenter-runner-access`). */
    runnerMaterials: jsonb('runner_materials')
      .$type<{ label: string; url: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isPublic: boolean('is_public').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('presenter_offerings_user_idx').on(t.userId)]
)

/** Presenter portfolio images (separate from `profiles.avatar_url` headshot). */
export const presenterGalleryImages = pgTable(
  'presenter_gallery_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    caption: varchar('caption', { length: 500 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('presenter_gallery_images_user_idx').on(t.userId)]
)

/**
 * Self-reported teaching (unverified) or system-linked rows (`schedule_slot_id` + `verified`).
 * Presenters may only mutate rows with `schedule_slot_id` null.
 */
export const presenterTeachingCredits = pgTable(
  'presenter_teaching_credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    presenterUserId: uuid('presenter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 512 }).notNull(),
    eventName: varchar('event_name', { length: 512 }).notNull(),
    eventDate: date('event_date'),
    detailUrl: text('detail_url'),
    scheduleSlotId: uuid('schedule_slot_id').references(() => scheduleSlots.id, {
      onDelete: 'set null',
    }),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('presenter_teaching_credits_presenter_idx').on(t.presenterUserId),
    index('presenter_teaching_credits_slot_idx').on(t.scheduleSlotId),
    uniqueIndex('presenter_teaching_credits_presenter_slot_uq')
      .on(t.presenterUserId, t.scheduleSlotId)
      .where(sql`${t.scheduleSlotId} is not null`),
  ]
)

export const presenterReviews = pgTable(
  'presenter_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    presenterUserId: uuid('presenter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body'),
    sourceKind: presenterReviewSourceEnum('source_kind').notNull(),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    scheduleSlotId: uuid('schedule_slot_id').references(() => scheduleSlots.id, { onDelete: 'set null' }),
    /** Staff-confirmed check-in at review time (attendee reviews only). */
    attendeeCheckedIn: boolean('attendee_checked_in').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('presenter_reviews_presenter_idx').on(t.presenterUserId),
    index('presenter_reviews_author_idx').on(t.authorId),
    uniqueIndex('presenter_reviews_presenter_author_event_uq')
      .on(t.presenterUserId, t.authorId, t.eventId)
      .where(sql`${t.eventId} is not null`),
  ]
)

export const scheduleSlotPresenters = pgTable(
  'schedule_slot_presenters',
  {
    scheduleSlotId: uuid('schedule_slot_id')
      .notNull()
      .references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('schedule_slot_presenters_slot_user_idx').on(t.scheduleSlotId, t.userId),
    index('schedule_slot_presenters_user_idx').on(t.userId),
  ]
)

/**
 * Runner-assigned ops staff on a program slot (room turnover, door during class, etc.).
 * Times are explicit so floaters can have windows that differ from the class block.
 */
export const scheduleSlotStaff = pgTable(
  'schedule_slot_staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleSlotId: uuid('schedule_slot_id')
      .notNull()
      .references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleLabel: varchar('role_label', { length: 128 }).notNull().default('staff'),
    station: varchar('station', { length: 512 }),
    notes: text('notes'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('schedule_slot_staff_slot_idx').on(t.scheduleSlotId),
    index('schedule_slot_staff_user_idx').on(t.userId),
  ]
)

/** Standalone runner-assigned staff duties (floaters, build blocks) not tied to one program row. */
export const conventionStaffDuties = pgTable(
  'convention_staff_duties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleLabel: varchar('role_label', { length: 128 }).notNull().default('staff'),
    station: varchar('station', { length: 512 }),
    location: varchar('location', { length: 512 }),
    notes: text('notes'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    importKey: varchar('import_key', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_staff_duties_convention_idx').on(t.conventionId),
    index('convention_staff_duties_user_idx').on(t.userId),
    index('convention_staff_duties_import_key_idx').on(t.conventionId, t.importKey),
  ]
)

export const eventContributorKindEnum = pgEnum('event_contributor_kind', [
  'vendor',
  'playspace',
  'sponsor',
  'presenter_support',
  'other',
])

export const eventContributors = pgTable(
  'event_contributors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    kind: eventContributorKindEnum('kind').notNull().default('other'),
    vendorProfileId: uuid('vendor_profile_id').references(() => vendorProfiles.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 255 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('event_contributors_event_idx').on(t.eventId)]
)

/** Post-event vendor appearances from organizer contributor assignments (worker-synced). */
export const vendorEventCredits = pgTable(
  'vendor_event_credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorProfileId: uuid('vendor_profile_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    eventName: varchar('event_name', { length: 512 }).notNull(),
    eventDate: date('event_date'),
    conventionId: uuid('convention_id').references(() => conventions.id, { onDelete: 'set null' }),
    conventionSlug: varchar('convention_slug', { length: 128 }),
    verified: boolean('verified').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_event_credits_vendor_idx').on(t.vendorProfileId),
    uniqueIndex('vendor_event_credits_vendor_event_uq').on(t.vendorProfileId, t.eventId),
  ],
)

/* --- Event-scoped matchmaker (opt-in per event) --- */

export const eventMatchmakerSettings = pgTable('event_matchmaker_settings', {
  eventId: uuid('event_id')
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  /** Versioned JSON schema for ISO form fields (checkboxes, scales). */
  formSchema: jsonb('form_schema').notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const eventMatchmakerResponses = pgTable(
  'event_matchmaker_responses',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_matchmaker_responses_event_user_idx').on(t.eventId, t.userId)]
)

export const eventMatchmakerSwipes = pgTable(
  'event_matchmaker_swipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    liked: boolean('liked').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('event_matchmaker_swipes_event_actor_target_idx').on(t.eventId, t.actorId, t.targetId),
    index('event_matchmaker_swipes_event_actor_idx').on(t.eventId, t.actorId),
  ]
)

export const eventMatchmakerMatches = pgTable(
  'event_matchmaker_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** Lexicographically smaller user id (stable pair key). */
    userLow: uuid('user_low')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userHigh: uuid('user_high')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_matchmaker_matches_event_pair_idx').on(t.eventId, t.userLow, t.userHigh)]
)

export const conventionDocumentVisibilityEnum = pgEnum('convention_document_visibility', [
  'ATTENDEE',
  'STAFF',
  'PUBLIC',
])

export const conventionAccessRoleEnum = pgEnum('convention_access_role', ['ATTENDEE', 'STAFF', 'MODERATOR'])

export const conventionPresenterRequestStatusEnum = pgEnum('convention_presenter_request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'OFFERED',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
])

export const conventionPageVisibilityEnum = pgEnum('convention_page_visibility', ['ATTENDEE', 'STAFF', 'PUBLIC'])

export const orgMessageReactionKindEnum = pgEnum('org_message_reaction_kind', [
  'like',
  'fire',
  'heart',
  'mind_blown',
])

export const conventionDocuments = pgTable(
  'convention_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 64 }).notNull().default('general'),
    url: text('url').notNull(),
    visibility: conventionDocumentVisibilityEnum('visibility').notNull().default('ATTENDEE'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_documents_convention_idx').on(t.conventionId)]
)

export const conventionAccessGrants = pgTable(
  'convention_access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: conventionAccessRoleEnum('role').notNull().default('ATTENDEE'),
    paidConfirmed: boolean('paid_confirmed').notNull().default(false),
    attendingConfirmed: boolean('attending_confirmed').notNull().default(false),
    staffPreAccess: boolean('staff_pre_access').notNull().default(false),
    /** When true (with staff access), user may create/edit standalone staff duties for this convention. */
    canAssignStaffSchedules: boolean('can_assign_staff_schedules').notNull().default(false),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    grantedByUserId: uuid('granted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('convention_access_grants_convention_user_idx').on(t.conventionId, t.userId),
    index('convention_access_grants_convention_idx').on(t.conventionId),
  ]
)

export const conventionStaffInviteTokens = pgTable(
  'convention_staff_invite_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 128 }).notNull().unique(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    redeemedByUserId: uuid('redeemed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_staff_invite_tokens_convention_idx').on(t.conventionId)]
)

/** One-time org ownership transfer for ECKE bootstrap handoff. */
export const organizationClaimTokens = pgTable(
  'organization_claim_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 128 }).notNull().unique(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    redeemedByUserId: uuid('redeemed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('organization_claim_tokens_org_idx').on(t.organizationId)]
)

export const scheduleSlotSignups = pgTable(
  'schedule_slot_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleSlotId: uuid('schedule_slot_id')
      .notNull()
      .references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('schedule_slot_signups_slot_user_idx').on(t.scheduleSlotId, t.userId),
    index('schedule_slot_signups_user_idx').on(t.userId),
  ]
)

export const dancecardEntries = pgTable(
  'dancecard_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    sourceKind: varchar('source_kind', { length: 32 }).notNull().default('manual'),
    sourceId: uuid('source_id'),
    location: varchar('location', { length: 512 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dancecard_entries_convention_user_idx').on(t.conventionId, t.userId)]
)

export const conventionDancecardPrefs = pgTable(
  'convention_dancecard_prefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Multiples of 15 minutes, 0–120; extends busy intervals on the trailing edge for free-time math. */
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_dancecard_prefs_convention_user_uq').on(t.conventionId, t.userId),
    index('convention_dancecard_prefs_user_idx').on(t.userId),
  ]
)

export const conventionDancecardShareLinks = pgTable(
  'convention_dancecard_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    label: varchar('label', { length: 128 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_dancecard_share_links_convention_owner_idx').on(t.conventionId, t.ownerUserId),
  ]
)

export const dancecardBookingRequests = pgTable(
  'dancecard_booking_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guestUserId: uuid('guest_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    proposedStartsAt: timestamp('proposed_starts_at', { withTimezone: true }),
    proposedEndsAt: timestamp('proposed_ends_at', { withTimezone: true }),
    proposedByUserId: uuid('proposed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    rescheduleNote: varchar('reschedule_note', { length: 500 }),
    hostEntryId: uuid('host_entry_id').references(() => dancecardEntries.id, { onDelete: 'set null' }),
    guestEntryId: uuid('guest_entry_id').references(() => dancecardEntries.id, { onDelete: 'set null' }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dancecard_booking_requests_host_status_idx').on(t.hostUserId, t.status),
    index('dancecard_booking_requests_guest_idx').on(t.guestUserId),
    index('dancecard_booking_requests_convention_idx').on(t.conventionId),
  ]
)

export const conventionPresenterRequests = pgTable(
  'convention_presenter_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    presenterUserId: uuid('presenter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    presenterOfferingId: uuid('presenter_offering_id').references(() => presenterOfferings.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    roomNeeds: text('room_needs'),
    materialNeeds: text('material_needs'),
    status: conventionPresenterRequestStatusEnum('status').notNull().default('PENDING'),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_presenter_requests_convention_idx').on(t.conventionId),
    index('convention_presenter_requests_presenter_idx').on(t.presenterUserId),
  ]
)

export const scheduleSlotMaterials = pgTable(
  'schedule_slot_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleSlotId: uuid('schedule_slot_id')
      .notNull()
      .references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    url: text('url').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('schedule_slot_materials_slot_idx').on(t.scheduleSlotId)]
)

/** Staff volunteer ops - not the same as program `schedule_slots`. */
export const conventionVolunteerShifts = pgTable(
  'convention_volunteer_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    location: varchar('location', { length: 512 }),
    locationId: uuid('location_id'),
    capacityMax: integer('capacity_max'),
    shiftStatus: varchar('shift_status', { length: 32 }).notNull().default('assigned'),
    personId: uuid('person_id').references(() => users.id, { onDelete: 'set null' }),
    personName: varchar('person_name', { length: 255 }),
    role: varchar('role', { length: 128 }),
    claimedByUserId: uuid('claimed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    organizerNotesStaffOnly: text('organizer_notes_staff_only'),
    droppedAt: timestamp('dropped_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_volunteer_shifts_convention_idx').on(t.conventionId)]
)

export const conventionVolunteerShiftSignups = pgTable(
  'convention_volunteer_shift_signups',
  {
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => conventionVolunteerShifts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.shiftId, t.userId] }),
    index('convention_volunteer_shift_signups_user_idx').on(t.userId),
  ]
)

/** On-site attendance check-in (no payment; staff or QR token flow later). */
export const conventionCheckIns = pgTable(
  'convention_check_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
    checkedInByUserId: uuid('checked_in_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    method: varchar('method', { length: 32 }).notNull().default('staff'),
  },
  (t) => [
    uniqueIndex('convention_check_ins_conv_user_idx').on(t.conventionId, t.userId),
    index('convention_check_ins_convention_idx').on(t.conventionId),
  ]
)

export const conventionCustomPages = pgTable(
  'convention_custom_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    visibility: conventionPageVisibilityEnum('visibility').notNull().default('ATTENDEE'),
    sortOrder: integer('sort_order').notNull().default(0),
    content: jsonb('content').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('convention_custom_pages_convention_slug_idx').on(t.conventionId, t.slug)]
)

export const orgChannelMessageReplies = pgTable(
  'org_channel_message_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgChannelMessageId: uuid('org_channel_message_id')
      .notNull()
      .references(() => orgChannelMessages.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('org_channel_message_replies_message_idx').on(t.orgChannelMessageId)]
)

export const orgChannelMessageReactions = pgTable(
  'org_channel_message_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgChannelMessageId: uuid('org_channel_message_id')
      .notNull()
      .references(() => orgChannelMessages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: orgMessageReactionKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('org_channel_message_reactions_message_user_kind_idx').on(
      t.orgChannelMessageId,
      t.userId,
      t.kind
    ),
    index('org_channel_message_reactions_message_idx').on(t.orgChannelMessageId),
  ]
)

/* --- E9: Safety / moderation --- */

export const moderationJobs = pgTable('moderation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: varchar('kind', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Append-only peer feedback applied to `profiles.trustScore`. */
export const profileReputationEvents = pgTable(
  'profile_reputation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceUserId: uuid('source_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    weightApplied: integer('weight_applied').notNull(),
    connectionWeight: doublePrecision('connection_weight').notNull(),
    sourceIpPrefix: varchar('source_ip_prefix', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('profile_reputation_events_target_idx').on(t.targetUserId),
    index('profile_reputation_events_source_idx').on(t.sourceUserId),
    index('profile_reputation_events_target_created_idx').on(t.targetUserId, t.createdAt),
  ]
)

export const profileReviewFlags = pgTable(
  'profile_review_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('OPEN'),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('profile_review_flags_target_idx').on(t.targetUserId)]
)

export const identityBans = pgTable(
  'identity_bans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ipPrefix: varchar('ip_prefix', { length: 64 }).notNull(),
    macAddress: varchar('mac_address', { length: 32 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: varchar('reason', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('identity_bans_ip_prefix_idx').on(t.ipPrefix)]
)

/* --- ECKE publish bridge (C2K control plane → ECKE runtime) --- */

export const eckePublishScopeEnum = pgEnum('ecke_publish_scope', [
  'organization',
  'convention',
  'group',
  'event',
  'education_article',
  'vendor_profile',
  'presenter_profile',
  'venue_profile',
])

export const eckePublishTargetKindEnum = pgEnum('ecke_publish_target_kind', [
  'ecke_listing',
  'dancecard_event',
  'ecke_event',
  'ecke_vendor',
  'ecke_article',
  'ecke_dungeon',
])

export const eckePublishStatusEnum = pgEnum('ecke_publish_status', [
  'never',
  'draft',
  'published',
  'error',
  'stale',
  'unpublished',
])

export const eckePublishTargets = pgTable(
  'ecke_publish_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: eckePublishScopeEnum('scope_type').notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    conventionId: uuid('convention_id').references(() => conventions.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    educationArticleId: uuid('education_article_id').references(() => educationArticles.id, { onDelete: 'cascade' }),
    vendorProfileId: uuid('vendor_profile_id').references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    presenterUserId: uuid('presenter_user_id').references(() => users.id, { onDelete: 'cascade' }),
    communityPlaceId: uuid('community_place_id').references(() => communityPlaces.id, { onDelete: 'cascade' }),
    targetKind: eckePublishTargetKindEnum('target_kind').notNull(),
    externalSlug: varchar('external_slug', { length: 128 }).notNull(),
    status: eckePublishStatusEnum('status').notNull().default('never'),
    contentHash: varchar('content_hash', { length: 64 }),
    publishedContentHash: varchar('published_content_hash', { length: 64 }),
    lastPreviewAt: timestamp('last_preview_at', { withTimezone: true }),
    lastPublishedAt: timestamp('last_published_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastError: text('last_error'),
    publishedByUserId: uuid('published_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    eckePublicUrl: text('ecke_public_url'),
    eckeRecordId: uuid('ecke_record_id'),
    mediaHash: varchar('media_hash', { length: 64 }),
    mediaManifestVersion: integer('media_manifest_version').notNull().default(1),
    unpublishedAt: timestamp('unpublished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ecke_publish_targets_org_kind_uq').on(t.organizationId, t.targetKind),
    uniqueIndex('ecke_publish_targets_conv_kind_uq').on(t.conventionId, t.targetKind),
    uniqueIndex('ecke_publish_targets_group_kind_uq').on(t.groupId, t.targetKind),
    uniqueIndex('ecke_publish_targets_article_kind_uq').on(t.educationArticleId, t.targetKind),
    uniqueIndex('ecke_publish_targets_vendor_kind_uq').on(t.vendorProfileId, t.targetKind),
    uniqueIndex('ecke_publish_targets_event_kind_uq').on(t.eventId, t.targetKind),
    uniqueIndex('ecke_publish_targets_presenter_kind_uq').on(t.presenterUserId, t.targetKind),
    uniqueIndex('ecke_publish_targets_place_kind_uq').on(t.communityPlaceId, t.targetKind),
    index('ecke_publish_targets_external_slug_idx').on(t.externalSlug),
  ]
)

export const eckePublishTargetMediaRoleEnum = pgEnum('ecke_publish_target_media_role', [
  'hero',
  'gallery',
  'logo',
  'thumbnail',
])

/** Persisted photo manifest rows for an ECKE publish target (publisher side). */
export const eckePublishTargetMedia = pgTable(
  'ecke_publish_target_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetId: uuid('target_id')
      .notNull()
      .references(() => eckePublishTargets.id, { onDelete: 'cascade' }),
    sourceMediaAssetId: uuid('source_media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    role: eckePublishTargetMediaRoleEnum('role').notNull(),
    ordinal: integer('ordinal').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    sha256Hash: varchar('sha256_hash', { length: 128 }),
    sourceUrl: text('source_url'),
    altText: text('alt_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ecke_publish_target_media_target_asset_uq').on(t.targetId, t.sourceMediaAssetId),
    uniqueIndex('ecke_publish_target_media_target_role_ord_uq').on(t.targetId, t.role, t.ordinal),
  ],
)

/* --- In-app notifications --- */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_id_created_idx').on(t.userId, t.createdAt)]
)

/* --- Trust & accountability signals (alpha) --- */

export const trustScopeTypeEnum = pgEnum('trust_scope_type', [
  'organization',
  'group',
  'event',
  'convention',
])

export const trustSignalVisibilityEnum = pgEnum('trust_signal_visibility', [
  'PUBLIC_POSITIVE',
  'SELF_ONLY',
  'SCOPED_MOD',
  'PLATFORM_MOD',
  'SITE_ADMIN_ONLY',
])

export const trustSignalStatusEnum = pgEnum('trust_signal_status', [
  'ACTIVE',
  'EXPIRED',
  'OVERTURNED',
  'SUPERSEDED',
])

export const communityTrustLevelEnum = pgEnum('community_trust_level', [
  'NEW_MEMBER',
  'BUILDING_TRUST',
  'ESTABLISHED_MEMBER',
  'COMMUNITY_KNOWN',
  'VERIFIED_CONTRIBUTOR',
])

export const scopedStandingEnum = pgEnum('scoped_standing', [
  'GOOD_STANDING',
  'NEEDS_ATTENTION',
  'LIMITED',
  'TIMED_OUT',
  'BANNED',
  'ESCALATED_TO_PLATFORM',
])

export const moderationIncidentStatusEnum = pgEnum('moderation_incident_status', [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'ESCALATED',
  'CLOSED_NO_VIOLATION',
])

export const incidentFindingEnum = pgEnum('incident_finding', [
  'NO_VIOLATION',
  'INSUFFICIENT_INFO',
  'CONCERNING_PATTERN',
  'LOCAL_RULE_VIOLATION',
  'SPAM_OR_DISRUPTION',
  'BOUNDARY_WARNING',
  'CONFIRMED_SPAM',
  'CONFIRMED_HARASSMENT',
  'CONFIRMED_CONSENT_VIOLATION',
  'CONFIRMED_SEVERE_SAFETY_VIOLATION',
  'RETALIATION_OR_BAD_FAITH_REPORT',
  'ESCALATED_TO_PLATFORM',
])

export const incidentParticipantRoleEnum = pgEnum('incident_participant_role', [
  'REPORTED_USER',
  'REPORTER',
  'AFFECTED_USER',
  'WITNESS',
  'MODERATOR',
  'OTHER',
])

export const messagingHealthStateEnum = pgEnum('messaging_health_state', [
  'HEALTHY',
  'NEW_LIMITED_HISTORY',
  'HIGH_OUTREACH_VOLUME',
  'NEEDS_COOLDOWN',
  'MOD_REVIEW_RECOMMENDED',
  'RESTRICTED',
])

export const messagingRestrictionTypeEnum = pgEnum('messaging_restriction_type', [
  'NEW_CONVERSATION_RATE_LIMIT',
  'DM_COOLDOWN',
  'PROFILE_COMPLETION_REQUIRED',
  'SCOPED_MESSAGING_TIMEOUT',
  'PLATFORM_MESSAGING_TIMEOUT',
])

export const messagingRestrictionStatusEnum = pgEnum('messaging_restriction_status', [
  'ACTIVE',
  'EXPIRED',
  'OVERTURNED',
  'SUPERSEDED',
])

export const scopedAppealStatusEnum = pgEnum('scoped_appeal_status', [
  'OPEN',
  'UNDER_REVIEW',
  'APPROVED',
  'DENIED',
  'WITHDRAWN',
  'ESCALATED_TO_PLATFORM',
])

export const trustSignalEvents = pgTable(
  'trust_signal_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: trustScopeTypeEnum('scope_type'),
    scopeId: uuid('scope_id'),
    signalType: varchar('signal_type', { length: 64 }).notNull(),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    sourceId: uuid('source_id'),
    severity: policySeverityEnum('severity'),
    confidence: doublePrecision('confidence'),
    visibility: trustSignalVisibilityEnum('visibility').notNull().default('PLATFORM_MOD'),
    status: trustSignalStatusEnum('status').notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    appealStatus: varchar('appeal_status', { length: 32 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('trust_signal_events_user_idx').on(t.userId),
    index('trust_signal_events_scope_idx').on(t.scopeType, t.scopeId),
    index('trust_signal_events_status_idx').on(t.status),
    index('trust_signal_events_expires_idx').on(t.expiresAt),
  ]
)

export const trustSignalRollups = pgTable(
  'trust_signal_rollups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: trustScopeTypeEnum('scope_type'),
    scopeId: uuid('scope_id'),
    accountLevel: communityTrustLevelEnum('account_level'),
    communityLevel: communityTrustLevelEnum('community_level'),
    scopedStanding: scopedStandingEnum('scoped_standing').notNull().default('GOOD_STANDING'),
    positiveBadgeCount: integer('positive_badge_count').notNull().default(0),
    cautionSignalCount: integer('caution_signal_count').notNull().default(0),
    activeRestrictionCount: integer('active_restriction_count').notNull().default(0),
    lastRecomputedAt: timestamp('last_recomputed_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index('trust_signal_rollups_user_idx').on(t.userId),
    index('trust_signal_rollups_scope_idx').on(t.scopeType, t.scopeId),
  ]
)

export const moderationIncidents = pgTable(
  'moderation_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: trustScopeTypeEnum('scope_type'),
    scopeId: uuid('scope_id'),
    primaryUserId: uuid('primary_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    policyReason: policyReasonEnum('policy_reason'),
    severity: policySeverityEnum('severity').notNull().default('MEDIUM'),
    status: moderationIncidentStatusEnum('status').notNull().default('OPEN'),
    finding: incidentFindingEnum('finding'),
    platformCaseId: uuid('platform_case_id').references(() => moderationCases.id, { onDelete: 'set null' }),
    platformEscalatedAt: timestamp('platform_escalated_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    appealStatus: varchar('appeal_status', { length: 32 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('moderation_incidents_primary_user_idx').on(t.primaryUserId),
    index('moderation_incidents_scope_idx').on(t.scopeType, t.scopeId),
    index('moderation_incidents_status_idx').on(t.status),
    index('moderation_incidents_platform_case_idx').on(t.platformCaseId),
  ]
)

export const incidentReports = pgTable(
  'incident_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => moderationIncidents.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    moderationReportId: uuid('moderation_report_id').references(() => moderationReports.id, {
      onDelete: 'set null',
    }),
    reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
    relationshipContext: varchar('relationship_context', { length: 64 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    isDuplicate: boolean('is_duplicate').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('incident_reports_incident_idx').on(t.incidentId),
    index('incident_reports_mod_report_idx').on(t.moderationReportId),
  ]
)

export const incidentParticipants = pgTable(
  'incident_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => moderationIncidents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: incidentParticipantRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('incident_participants_incident_idx').on(t.incidentId)]
)

export const incidentActions = pgTable(
  'incident_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => moderationIncidents.id, { onDelete: 'cascade' }),
    actionType: varchar('action_type', { length: 64 }).notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    scopeType: trustScopeTypeEnum('scope_type'),
    scopeId: uuid('scope_id'),
    moderationActionId: uuid('moderation_action_id'),
    scopeBanId: uuid('scope_ban_id').references(() => scopeBans.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('incident_actions_incident_idx').on(t.incidentId)]
)

export const messagingHealthRollups = pgTable(
  'messaging_health_rollups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    outboundMessageCount: integer('outbound_message_count').notNull().default(0),
    uniqueRecipientCount: integer('unique_recipient_count').notNull().default(0),
    newConversationCount: integer('new_conversation_count').notNull().default(0),
    repeatedMessageScore: doublePrecision('repeated_message_score'),
    replyRatio: doublePrecision('reply_ratio'),
    blockAfterContactCount: integer('block_after_contact_count').notNull().default(0),
    muteAfterContactCount: integer('mute_after_contact_count').notNull().default(0),
    reportAfterContactCount: integer('report_after_contact_count').notNull().default(0),
    independentReporterCount: integer('independent_reporter_count').notNull().default(0),
    state: messagingHealthStateEnum('state').notNull().default('HEALTHY'),
    lastRecomputedAt: timestamp('last_recomputed_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index('messaging_health_rollups_user_idx').on(t.userId),
    index('messaging_health_rollups_window_idx').on(t.userId, t.windowStart, t.windowEnd),
    index('messaging_health_rollups_state_idx').on(t.state),
  ]
)

export const messagingRestrictions = pgTable(
  'messaging_restrictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    restrictionType: messagingRestrictionTypeEnum('restriction_type').notNull(),
    reasonCategory: varchar('reason_category', { length: 64 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    incidentId: uuid('incident_id').references(() => moderationIncidents.id, { onDelete: 'set null' }),
    status: messagingRestrictionStatusEnum('status').notNull().default('ACTIVE'),
    appealId: uuid('appeal_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index('messaging_restrictions_user_idx').on(t.userId),
    index('messaging_restrictions_status_idx').on(t.status),
    index('messaging_restrictions_expires_idx').on(t.expiresAt),
  ]
)

export const scopedStandingEvents = pgTable(
  'scoped_standing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: trustScopeTypeEnum('scope_type').notNull(),
    scopeId: uuid('scope_id').notNull(),
    standingBefore: scopedStandingEnum('standing_before').notNull(),
    standingAfter: scopedStandingEnum('standing_after').notNull(),
    reasonCategory: varchar('reason_category', { length: 64 }).notNull(),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    sourceId: uuid('source_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    appealStatus: varchar('appeal_status', { length: 32 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scoped_standing_events_user_scope_idx').on(t.userId, t.scopeType, t.scopeId),
    index('scoped_standing_events_created_idx').on(t.createdAt),
  ]
)

export const scopedModerationAppeals = pgTable(
  'scoped_moderation_appeals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: trustScopeTypeEnum('scope_type').notNull(),
    scopeId: uuid('scope_id').notNull(),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    sourceId: uuid('source_id').notNull(),
    reason: text('reason').notNull(),
    status: scopedAppealStatusEnum('status').notNull().default('OPEN'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('scoped_moderation_appeals_user_idx').on(t.userId),
    index('scoped_moderation_appeals_scope_idx').on(t.scopeType, t.scopeId),
    index('scoped_moderation_appeals_status_idx').on(t.status),
  ]
)

export type TrustSignalEvent = typeof trustSignalEvents.$inferSelect
export type ModerationIncident = typeof moderationIncidents.$inferSelect
export type MessagingHealthRollup = typeof messagingHealthRollups.$inferSelect
export type MessagingRestriction = typeof messagingRestrictions.$inferSelect
export type ScopedStandingEvent = typeof scopedStandingEvents.$inferSelect
export type ScopedModerationAppeal = typeof scopedModerationAppeals.$inferSelect

/* --- Alpha demo seed tracking --- */

export const alphaSeedBatches = pgTable(
  'alpha_seed_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchKey: varchar('batch_key', { length: 128 }).notNull().unique(),
    sourceName: varchar('source_name', { length: 255 }).notNull(),
    sourceUrl: text('source_url'),
    sourceRepo: text('source_repo'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('alpha_seed_batches_created_idx').on(t.createdAt)],
)

export const alphaSeedItems = pgTable(
  'alpha_seed_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => alphaSeedBatches.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 64 }).notNull(),
    targetId: text('target_id').notNull(),
    sourceType: varchar('source_type', { length: 64 }),
    sourceSlug: varchar('source_slug', { length: 255 }),
    labelText: varchar('label_text', { length: 64 }).notNull().default('ALPHA TEST'),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    isPublicSource: boolean('is_public_source').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('alpha_seed_items_target_idx').on(t.targetType, t.targetId),
    index('alpha_seed_items_batch_idx').on(t.batchId),
    uniqueIndex('alpha_seed_items_batch_target_uq').on(t.batchId, t.targetType, t.targetId),
  ],
)

export type AlphaSeedBatch = typeof alphaSeedBatches.$inferSelect
export type AlphaSeedItem = typeof alphaSeedItems.$inferSelect

/* --- Stripe Connect correlation (thin; Stripe is money ledger) --- */

export const stripeCheckoutSessions = pgTable(
  'stripe_checkout_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Org ticket/membership Checkout; null for vendor product Checkout. */
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conventionId: uuid('convention_id').references(() => conventions.id, { onDelete: 'set null' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    vendorProfileId: uuid('vendor_profile_id').references(() => vendorProfiles.id, { onDelete: 'set null' }),
    productId: uuid('product_id'),
    categoryId: uuid('category_id'),
    stripeSessionId: text('stripe_session_id').notNull(),
    stripeAccountId: text('stripe_account_id').notNull(),
    mode: varchar('mode', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    amountCents: integer('amount_cents'),
    currency: varchar('currency', { length: 8 }).notNull().default('usd'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('stripe_checkout_sessions_session_id_uq').on(t.stripeSessionId),
    index('stripe_checkout_sessions_org_idx').on(t.orgId),
    index('stripe_checkout_sessions_user_idx').on(t.userId),
    index('stripe_checkout_sessions_event_idx').on(t.eventId),
    index('stripe_checkout_sessions_vendor_idx').on(t.vendorProfileId),
  ],
)

export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeEventId: text('stripe_event_id').notNull(),
    type: varchar('type', { length: 128 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('stripe_webhook_events_event_id_uq').on(t.stripeEventId)],
)

export type StripeCheckoutSessionRow = typeof stripeCheckoutSessions.$inferSelect
export type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect

/* --- Play Spaces (user-owned dancecard gatherings; not org conventions) --- */

export const playSpaces = pgTable(
  'play_spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    locationLabel: varchar('location_label', { length: 512 }),
    /** public = listed in directory; unlisted = invite/link only; private = invite code required */
    visibility: varchar('visibility', { length: 32 }).notNull().default('public'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('America/New_York'),
    /** Opaque join token for private/unlisted spaces (shown to owner). */
    inviteCode: varchar('invite_code', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('play_spaces_owner_idx').on(t.ownerUserId),
    index('play_spaces_starts_at_idx').on(t.startsAt),
    index('play_spaces_visibility_idx').on(t.visibility),
  ],
)

export const playSpaceMembers = pgTable(
  'play_space_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('play_space_members_space_user_uq').on(t.playSpaceId, t.userId),
    index('play_space_members_user_idx').on(t.userId),
  ],
)

/** Personal dancecard blocks inside a play space (separate from convention dancecard_entries). */
export const playSpaceDancecardEntries = pgTable(
  'play_space_dancecard_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    location: varchar('location', { length: 512 }),
    notes: text('notes'),
    /** manual | slot_signup | scene_booking */
    sourceKind: varchar('source_kind', { length: 32 }).notNull().default('manual'),
    sourceId: uuid('source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('play_space_dancecard_entries_space_user_idx').on(t.playSpaceId, t.userId)],
)

export const playSpaceDancecardPrefs = pgTable(
  'play_space_dancecard_prefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    /** Compare/profile fields for this play space */
    displayName: varchar('display_name', { length: 128 }),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    contactNote: varchar('contact_note', { length: 512 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('play_space_dancecard_prefs_space_user_uq').on(t.playSpaceId, t.userId),
    index('play_space_dancecard_prefs_user_idx').on(t.userId),
  ],
)

export const playSpaceDancecardShareLinks = pgTable(
  'play_space_dancecard_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    label: varchar('label', { length: 128 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('play_space_dancecard_share_links_space_owner_idx').on(t.playSpaceId, t.ownerUserId)],
)

/**
 * Booking / reserve requests. guestUserId nullable so guests without a KS account
 * can request via share link (guestDisplayName required in that case).
 */
export const playSpaceBookingRequests = pgTable(
  'play_space_booking_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guestUserId: uuid('guest_user_id').references(() => users.id, { onDelete: 'cascade' }),
    guestDisplayName: varchar('guest_display_name', { length: 128 }),
    guestContact: varchar('guest_contact', { length: 255 }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** Free-text meet spot (e.g. "dungeon", "barn loft") — not a map pin. */
    location: varchar('location', { length: 512 }),
    description: text('description').notNull().default(''),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    hostEntryId: uuid('host_entry_id').references(() => playSpaceDancecardEntries.id, {
      onDelete: 'set null',
    }),
    guestEntryId: uuid('guest_entry_id').references(() => playSpaceDancecardEntries.id, {
      onDelete: 'set null',
    }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('play_space_booking_requests_host_status_idx').on(t.hostUserId, t.status),
    index('play_space_booking_requests_space_idx').on(t.playSpaceId),
  ],
)

export const playSpaceProgramSlots = pgTable(
  'play_space_program_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    location: varchar('location', { length: 512 }),
    published: boolean('published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('play_space_program_slots_space_starts_idx').on(t.playSpaceId, t.startsAt)],
)

export const playSpaceMaps = pgTable(
  'play_space_maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull().default('Venue map'),
    imageUrl: text('image_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('play_space_maps_space_idx').on(t.playSpaceId)],
)

/** Play-space lounge chat (mirrors convention hub channels). */
export const playSpaceHubChannels = pgTable(
  'play_space_hub_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('CHAT'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('play_space_hub_channels_space_slug_idx').on(t.playSpaceId, t.slug),
    index('play_space_hub_channels_space_idx').on(t.playSpaceId, t.sortOrder),
  ],
)

export const playSpaceHubChannelMessages = pgTable(
  'play_space_hub_channel_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => playSpaceHubChannels.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    parentMessageId: uuid('parent_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('play_space_hub_channel_messages_channel_idx').on(t.channelId, t.createdAt)],
)

export const playSpaceHubChannelReads = pgTable(
  'play_space_hub_channel_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => playSpaceHubChannels.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })],
)

/** Member lists their profile ISO on this play space board. */
export const playSpaceIsoListings = pgTable(
  'play_space_iso_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    removedByStaffAt: timestamp('removed_by_staff_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('play_space_iso_listings_space_user_idx').on(t.playSpaceId, t.userId),
    index('play_space_iso_listings_space_idx').on(t.playSpaceId),
  ],
)

/** Pickup-play matchmaker (opt-in per play space; default enabled for Dancecard hubs). */
export const playSpaceMatchmakerSettings = pgTable('play_space_matchmaker_settings', {
  playSpaceId: uuid('play_space_id')
    .primaryKey()
    .references(() => playSpaces.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  formSchema: jsonb('form_schema').notNull().default(sql`'{"kind":"pickup_play_v1"}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playSpaceMatchmakerResponses = pgTable(
  'play_space_matchmaker_responses',
  {
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('play_space_matchmaker_responses_space_user_idx').on(t.playSpaceId, t.userId)],
)

export const playSpaceMatchmakerSwipes = pgTable(
  'play_space_matchmaker_swipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    liked: boolean('liked').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('play_space_matchmaker_swipes_space_actor_target_idx').on(
      t.playSpaceId,
      t.actorId,
      t.targetId,
    ),
    index('play_space_matchmaker_swipes_space_actor_idx').on(t.playSpaceId, t.actorId),
  ],
)

export const playSpaceMatchmakerMatches = pgTable(
  'play_space_matchmaker_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playSpaceId: uuid('play_space_id')
      .notNull()
      .references(() => playSpaces.id, { onDelete: 'cascade' }),
    userLow: uuid('user_low')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userHigh: uuid('user_high')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('play_space_matchmaker_matches_space_pair_idx').on(t.playSpaceId, t.userLow, t.userHigh)],
)

export type PlaySpaceRow = typeof playSpaces.$inferSelect
export type PlaySpaceMemberRow = typeof playSpaceMembers.$inferSelect
export type PlaySpaceDancecardEntryRow = typeof playSpaceDancecardEntries.$inferSelect
export type PlaySpaceDancecardPrefsRow = typeof playSpaceDancecardPrefs.$inferSelect
export type PlaySpaceBookingRequestRow = typeof playSpaceBookingRequests.$inferSelect
export type PlaySpaceProgramSlotRow = typeof playSpaceProgramSlots.$inferSelect
export type PlaySpaceMapRow = typeof playSpaceMaps.$inferSelect
export type PlaySpaceHubChannelRow = typeof playSpaceHubChannels.$inferSelect

export * from './convention-organizer-schema.js'
