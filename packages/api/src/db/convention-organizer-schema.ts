/**
 * Dancecard organizer parity tables (mirrors dancecard-integration-kit migrations 007–059).
 * Imported from schema.ts - references conventions, users, scheduleSlots, conventionVolunteerShifts.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { conventions, users } from './schema.js'

/* --- Enums --- */

export const conventionImportBatchKindEnum = pgEnum('convention_import_batch_kind', ['program', 'staff'])
export const conventionImportBatchStatusEnum = pgEnum('convention_import_batch_status', [
  'uploaded',
  'validated',
  'published',
  'discarded',
])
export const conventionImportRowKindEnum = pgEnum('convention_import_row_kind', ['program', 'staff'])
export const conventionImportRowActionEnum = pgEnum('convention_import_row_action', [
  'add',
  'update',
  'delete',
  'unchanged',
  'ignore',
])
export const conventionImportRowDraftStatusEnum = pgEnum('convention_import_row_draft_status', [
  'unplaced',
  'placed',
  'invalid',
  'ignored',
])
export const conventionStaffShiftStatusEnum = pgEnum('convention_staff_shift_status', [
  'draft',
  'open',
  'assigned',
  'dropped',
])
export const conventionShiftSwapStatusEnum = pgEnum('convention_shift_swap_status', [
  'pending',
  'approved',
  'denied',
  'cancelled',
])
export const conventionSlotVisibilityEnum = pgEnum('convention_slot_visibility', [
  'ATTENDEE',
  'STAFF',
  'HIDDEN',
])
export const conventionTagScopeEnum = pgEnum('convention_tag_scope', [
  'session',
  'person',
  'registrant',
  'location',
])
export const conventionMessageDeliveryStatusEnum = pgEnum('convention_message_delivery_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
])
export const conventionVettingStatusEnum = pgEnum('convention_vetting_status', [
  'pending',
  'approved',
  'denied',
  'withdrawn',
  'offered',
  'offer_accepted',
  'offer_declined',
])

export const conventionPolicyKindEnum = pgEnum('convention_policy_kind', [
  'coc',
  'waiver',
  'photo',
  'marketing',
  'other',
])

export const conventionParticipationOfferSourceEnum = pgEnum('convention_participation_offer_source', [
  'presenter_request',
  'vetting_application',
  'vendor_application',
])

export const conventionParticipationOfferStatusEnum = pgEnum('convention_participation_offer_status', [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'superseded',
])

export const conventionExhibitorApplicationStatusEnum = pgEnum('convention_exhibitor_application_status', [
  'pending',
  'offered',
  'accepted',
  'rejected',
])

export const conventionTrustedRoleStatusEnum = pgEnum('convention_trusted_role_status', [
  'draft',
  'published',
  'archived',
])

export const conventionRegistrationFormStatusEnum = pgEnum('convention_registration_form_status', [
  'draft',
  'published',
])

export const conventionMessageCampaignStatusEnum = pgEnum('convention_message_campaign_status', [
  'draft',
  'queued',
  'sending',
  'sent',
  'failed',
])

export const conventionCalendarFeedScopeEnum = pgEnum('convention_calendar_feed_scope', [
  'full',
  'track',
  'location',
  'person',
])

/* --- Locations (007 + 013) --- */

export const conventionLocations = pgTable(
  'convention_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    shortName: varchar('short_name', { length: 64 }),
    capacity: integer('capacity'),
    notes: text('notes'),
    parentId: uuid('parent_id'),
    kind: varchar('kind', { length: 64 }),
    accessibilityNotes: text('accessibility_notes'),
    directionsPublic: text('directions_public'),
    internalNotes: text('internal_notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_locations_conv_lower_name_idx').on(t.conventionId, sql`lower(${t.name})`),
    index('convention_locations_conv_parent_sort_idx').on(t.conventionId, t.parentId, t.sortOrder),
  ],
)

/* --- Tracks & tags (010) --- */

export const conventionTracks = pgTable(
  'convention_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    color: varchar('color', { length: 32 }).notNull().default('#22d3ee'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_tracks_conv_lower_name_idx').on(t.conventionId, sql`lower(${t.name})`),
    index('convention_tracks_conv_sort_idx').on(t.conventionId, t.sortOrder),
  ],
)

export const conventionTags = pgTable(
  'convention_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    scope: conventionTagScopeEnum('scope').notNull().default('session'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_tags_conv_scope_lower_name_idx').on(
      t.conventionId,
      t.scope,
      sql`lower(${t.name})`,
    ),
  ],
)

export const scheduleSlotTags = pgTable(
  'schedule_slot_tags',
  {
    slotId: uuid('slot_id').notNull(),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => conventionTags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.slotId, t.tagId] }), index('schedule_slot_tags_tag_idx').on(t.tagId)],
)

/* --- Maps (014) --- */

export const conventionMaps = pgTable(
  'convention_maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull().default('Venue map'),
    imagePath: text('image_path').notNull(),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_maps_conv_sort_idx').on(t.conventionId, t.sortOrder)],
)

export const conventionMapPins = pgTable(
  'convention_map_pins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mapId: uuid('map_id')
      .notNull()
      .references(() => conventionMaps.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => conventionLocations.id, { onDelete: 'cascade' }),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    label: varchar('label', { length: 128 }),
    zoneShape: varchar('zone_shape', { length: 32 }),
    zoneSize: doublePrecision('zone_size'),
    zoneRotation: doublePrecision('zone_rotation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_map_pins_map_location_idx').on(t.mapId, t.locationId),
    index('convention_map_pins_location_idx').on(t.locationId),
  ],
)

/* --- DM requirements (016) --- */

export const conventionDmRequirements = pgTable(
  'convention_dm_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => conventionLocations.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    minLead: integer('min_lead').notNull().default(1),
    minFloat: integer('min_float').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_dm_req_conv_loc_idx').on(t.conventionId, t.locationId, t.startsAt)],
)

/* --- Import workflow (007) --- */

export const conventionImportBatches = pgTable(
  'convention_import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    organizerUserId: uuid('organizer_user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: conventionImportBatchKindEnum('kind').notNull(),
    status: conventionImportBatchStatusEnum('status').notNull().default('uploaded'),
    sourceFilename: varchar('source_filename', { length: 512 }),
    sheetName: varchar('sheet_name', { length: 255 }),
    columnMapping: jsonb('column_mapping').notNull().default(sql`'{}'::jsonb`),
    summary: jsonb('summary').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [index('convention_import_batches_conv_idx').on(t.conventionId, t.createdAt)],
)

export const conventionImportRows = pgTable(
  'convention_import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => conventionImportBatches.id, { onDelete: 'cascade' }),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    rowKey: varchar('row_key', { length: 128 }).notNull(),
    kind: conventionImportRowKindEnum('kind').notNull(),
    action: conventionImportRowActionEnum('action').notNull().default('add'),
    draftStatus: conventionImportRowDraftStatusEnum('draft_status').notNull().default('unplaced'),
    sourceRefId: uuid('source_ref_id'),
    title: varchar('title', { length: 512 }),
    personName: varchar('person_name', { length: 255 }),
    role: varchar('role', { length: 128 }),
    track: varchar('track', { length: 128 }),
    room: varchar('room', { length: 128 }),
    locationId: uuid('location_id').references(() => conventionLocations.id, { onDelete: 'set null' }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes'),
    description: text('description'),
    rawRow: jsonb('raw_row').notNull().default(sql`'{}'::jsonb`),
    validationErrors: jsonb('validation_errors').notNull().default(sql`'[]'::jsonb`),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_import_rows_batch_row_key_idx').on(t.batchId, t.rowKey),
    index('convention_import_rows_batch_sort_idx').on(t.batchId, t.sortOrder),
  ],
)

export const conventionImportMappingProfiles = pgTable(
  'convention_import_mapping_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    kind: conventionImportBatchKindEnum('kind').notNull(),
    importFormat: varchar('import_format', { length: 32 }).notNull().default('flat_rows'),
    spreadsheetId: varchar('spreadsheet_id', { length: 128 }),
    headerRowIndex: integer('header_row_index').notNull().default(0),
    columnMapping: jsonb('column_mapping').notNull().default(sql`'{}'::jsonb`),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_import_mapping_profiles_conv_kind_name_idx').on(t.conventionId, t.kind, t.name),
    index('convention_import_mapping_profiles_conv_idx').on(t.conventionId, t.kind),
  ],
)

export const conventionScheduleAuditLog = pgTable(
  'convention_schedule_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').references(() => conventionImportBatches.id, { onDelete: 'set null' }),
    organizerUserId: uuid('organizer_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 128 }).notNull(),
    summary: jsonb('summary').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_schedule_audit_conv_idx').on(t.conventionId, t.createdAt)],
)

export const scheduleSlotAudit = pgTable(
  'schedule_slot_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: uuid('slot_id').notNull(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    organizerUserId: uuid('organizer_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    beforeSnapshot: jsonb('before_snapshot').notNull().default(sql`'{}'::jsonb`),
    afterSnapshot: jsonb('after_snapshot').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('schedule_slot_audit_slot_idx').on(t.slotId, t.createdAt)],
)

/* --- People (011) --- */

export const conventionPersons = pgTable(
  'convention_persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    showLegalNameOnPublic: boolean('show_legal_name_on_public').notNull().default(false),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    bio: text('bio'),
    internalNotes: text('internal_notes'),
    photoUrl: text('photo_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_persons_conv_idx').on(t.conventionId, t.sortOrder)],
)

export const conventionPersonRoleAssignments = pgTable(
  'convention_person_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => conventionPersons.id, { onDelete: 'cascade' }),
    roleLabel: varchar('role_label', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_person_roles_person_idx').on(t.personId)],
)

export const scheduleSlotPersons = pgTable(
  'schedule_slot_persons',
  {
    slotId: uuid('slot_id').notNull(),
    personId: uuid('person_id')
      .notNull()
      .references(() => conventionPersons.id, { onDelete: 'cascade' }),
    roleLabel: varchar('role_label', { length: 128 }).notNull().default('presenter'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.slotId, t.personId, t.roleLabel] }),
    index('schedule_slot_persons_person_idx').on(t.personId),
  ],
)

/* --- Registration (012 + 018) --- */

export const conventionRegistrationCategories = pgTable(
  'convention_registration_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    capacityMax: integer('capacity_max'),
    priceCents: integer('price_cents'),
    compCode: varchar('comp_code', { length: 64 }),
    accessCode: varchar('access_code', { length: 64 }),
    grantsStaffAccess: boolean('grants_staff_access').notNull().default(false),
    roleKind: varchar('role_kind', { length: 32 }).notNull().default('attendee'),
    isPublic: boolean('is_public').notNull().default(true),
    expectedHours: doublePrecision('expected_hours'),
    checkInValidFrom: timestamp('check_in_valid_from', { withTimezone: true, mode: 'date' }),
    checkInValidThrough: timestamp('check_in_valid_through', { withTimezone: true, mode: 'date' }),
    externalSourceRef: text('external_source_ref'),
    importedPaymentStatus: varchar('imported_payment_status', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_reg_categories_conv_idx').on(t.conventionId, t.sortOrder)],
)

export const conventionRegistrationForms = pgTable(
  'convention_registration_forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' })
      .unique(),
    status: conventionRegistrationFormStatusEnum('status').notNull().default('draft'),
    introHtml: text('intro_html'),
    introText: text('intro_text').notNull().default(''),
    confirmationText: text('confirmation_text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
)

export const conventionRegistrationQuestions = pgTable(
  'convention_registration_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => conventionRegistrationForms.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 512 }).notNull(),
    fieldType: varchar('field_type', { length: 32 }).notNull().default('text'),
    required: boolean('required').notNull().default(false),
    options: jsonb('options').notNull().default(sql`'[]'::jsonb`),
    optionsJson: jsonb('options_json').notNull().default(sql`'[]'::jsonb`),
    visibilityRulesJson: jsonb('visibility_rules_json').notNull().default(sql`'{}'::jsonb`),
    requiredForCategoryIds: jsonb('required_for_category_ids').notNull().default(sql`'[]'::jsonb`),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_reg_questions_form_idx').on(t.formId, t.sortOrder)],
)

export const conventionRegistrants = pgTable(
  'convention_registrants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => conventionRegistrationCategories.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    badgeName: varchar('badge_name', { length: 255 }),
    pronouns: varchar('pronouns', { length: 64 }),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    checkInToken: varchar('check_in_token', { length: 128 }),
    checkedInTiming: varchar('checked_in_timing', { length: 32 }),
    externalId: varchar('external_id', { length: 128 }),
    externalSource: varchar('external_source', { length: 64 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    notes: text('notes'),
    registrationStatus: varchar('registration_status', { length: 32 }).notNull().default('confirmed'),
    vettingStatus: varchar('vetting_status', { length: 32 }).notNull().default('approved'),
    vettingSafetyNotes: text('vetting_safety_notes'),
    importedPaymentStatus: varchar('imported_payment_status', { length: 64 }),
    consentWaiverAckAt: timestamp('consent_waiver_ack_at', { withTimezone: true }),
    consentPhotoAckAt: timestamp('consent_photo_ack_at', { withTimezone: true }),
    rabbitsignFolderId: varchar('rabbitsign_folder_id', { length: 128 }),
    rabbitsignStatus: varchar('rabbitsign_status', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_registrants_conv_idx').on(t.conventionId),
    index('convention_registrants_email_idx').on(t.conventionId, t.email),
    uniqueIndex('convention_registrants_conv_user_idx').on(t.conventionId, t.userId),
    index('convention_registrants_conv_status_idx').on(t.conventionId, t.registrationStatus),
    index('convention_registrants_conv_external_idx').on(
      t.conventionId,
      t.externalSource,
      t.externalId,
    ),
  ],
)

export const conventionRegistrantTagAssignments = pgTable(
  'convention_registrant_tag_assignments',
  {
    registrantId: uuid('registrant_id')
      .notNull()
      .references(() => conventionRegistrants.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => conventionTags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.registrantId, t.tagId] }),
    index('convention_registrant_tags_tag_idx').on(t.tagId),
  ],
)

export const conventionRegistrantAnswers = pgTable(
  'convention_registrant_answers',
  {
    registrantId: uuid('registrant_id')
      .notNull()
      .references(() => conventionRegistrants.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => conventionRegistrationQuestions.id, { onDelete: 'cascade' }),
    value: text('value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.registrantId, t.questionId] })],
)

export const conventionPolicyDocuments = pgTable(
  'convention_policy_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    kind: conventionPolicyKindEnum('kind').notNull().default('other'),
    version: integer('version').notNull().default(1),
    title: varchar('title', { length: 255 }).notNull(),
    bodyHtml: text('body_html'),
    bodyMarkdown: text('body_markdown'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    requiredForRegistration: boolean('required_for_registration').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_policy_docs_conv_idx').on(t.conventionId, t.sortOrder),
    index('convention_policy_docs_conv_kind_idx').on(t.conventionId, t.kind),
  ],
)

export const conventionRegistrantPolicyAcceptances = pgTable(
  'convention_registrant_policy_acceptances',
  {
    registrantId: uuid('registrant_id')
      .notNull()
      .references(() => conventionRegistrants.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => conventionPolicyDocuments.id, { onDelete: 'cascade' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
    signerName: varchar('signer_name', { length: 255 }),
    signerEmail: varchar('signer_email', { length: 255 }),
    signatureMethod: varchar('signature_method', { length: 64 }),
    providerRef: varchar('provider_ref', { length: 255 }),
    ipHash: varchar('ip_hash', { length: 128 }),
  },
  (t) => [primaryKey({ columns: [t.registrantId, t.policyId] })],
)

/* --- Staff workflow extensions (015 + 027) --- */

export const conventionShiftSwapRequests = pgTable(
  'convention_shift_swap_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id').notNull(),
    requesterUserId: uuid('requester_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: conventionShiftSwapStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [index('convention_shift_swaps_conv_idx').on(t.conventionId, t.status)],
)

/* --- Messaging (022) --- */

export const conventionMessageTemplates = pgTable(
  'convention_message_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 512 }).notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_message_templates_conv_idx').on(t.conventionId)],
)

export const conventionMessageCampaigns = pgTable(
  'convention_message_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => conventionMessageTemplates.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: conventionMessageCampaignStatusEnum('status').notNull().default('draft'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    audienceFilter: jsonb('audience_filter').notNull().default(sql`'{}'::jsonb`),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    sendError: text('send_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_message_campaigns_conv_idx').on(t.conventionId)],
)

export const conventionMessageDeliveries = pgTable(
  'convention_message_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => conventionMessageCampaigns.id, { onDelete: 'cascade' }),
    registrantId: uuid('registrant_id').references(() => conventionRegistrants.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 255 }).notNull(),
    status: conventionMessageDeliveryStatusEnum('status').notNull().default('pending'),
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_message_deliveries_campaign_idx').on(t.campaignId),
    uniqueIndex('convention_message_deliveries_idempotency_idx').on(t.campaignId, t.idempotencyKey),
  ],
)

/* --- Integrations (024–027) --- */

export const conventionApiKeys = pgTable(
  'convention_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    scopes: jsonb('scopes').notNull().default(sql`'[]'::jsonb`),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_api_keys_conv_idx').on(t.conventionId)],
)

export const conventionWebhookSubscriptions = pgTable(
  'convention_webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: jsonb('events').notNull().default(sql`'[]'::jsonb`),
    secret: varchar('secret', { length: 128 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_webhooks_conv_idx').on(t.conventionId)],
)

export const conventionEmbedTokens = pgTable(
  'convention_embed_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    tokenPrefix: varchar('token_prefix', { length: 16 }).notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('schedule'),
    allowedOrigins: jsonb('allowed_origins').notNull().default(sql`'[]'::jsonb`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_embed_tokens_conv_idx').on(t.conventionId)],
)

export const conventionEventEntitlements = pgTable(
  'convention_event_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    moduleKey: varchar('module_key', { length: 64 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('convention_event_entitlements_conv_module_idx').on(t.conventionId, t.moduleKey)],
)

export const conventionGoogleSheetConnections = pgTable(
  'convention_google_sheet_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' })
      .unique(),
    refreshToken: text('refresh_token'),
    spreadsheetId: varchar('spreadsheet_id', { length: 128 }),
    sheetName: varchar('sheet_name', { length: 255 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
)

export const conventionCalendarFeedTokens = pgTable(
  'convention_calendar_feed_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    label: varchar('label', { length: 255 }),
    scope: conventionCalendarFeedScopeEnum('scope').notNull().default('full'),
    filterTrackId: uuid('filter_track_id').references(() => conventionTracks.id, { onDelete: 'set null' }),
    filterLocationId: uuid('filter_location_id').references(() => conventionLocations.id, {
      onDelete: 'set null',
    }),
    filterPersonId: uuid('filter_person_id').references(() => conventionPersons.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_calendar_feed_tokens_conv_idx').on(t.conventionId)],
)

export const conventionWebhookDeliveries = pgTable(
  'convention_webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => conventionWebhookSubscriptions.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    statusCode: integer('status_code'),
    error: text('error'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_webhook_deliveries_sub_idx').on(t.subscriptionId, t.createdAt),
    index('convention_webhook_deliveries_status_idx').on(t.status, t.nextAttemptAt),
  ],
)

export const conventionAuditLog = pgTable(
  'convention_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 128 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_audit_log_conv_idx').on(t.conventionId, t.createdAt),
    index('convention_audit_log_entity_idx').on(t.conventionId, t.entityType, t.entityId),
  ],
)

export const conventionScheduleChangeNotifications = pgTable(
  'convention_schedule_change_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    slotId: uuid('slot_id'),
    notifiedUserId: uuid('notified_user_id').references(() => users.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    beforeSnapshot: jsonb('before_snapshot').notNull().default(sql`'{}'::jsonb`),
    afterSnapshot: jsonb('after_snapshot').notNull().default(sql`'{}'::jsonb`),
    organizerUserId: uuid('organizer_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_schedule_change_notif_conv_idx').on(t.conventionId, t.createdAt)],
)

export const conventionSessionFeedbackResponses = pgTable(
  'convention_session_feedback_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    slotId: uuid('slot_id').notNull(),
    registrantId: uuid('registrant_id').references(() => conventionRegistrants.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    rating: integer('rating'),
    comment: text('comment'),
    answers: jsonb('answers').notNull().default(sql`'{}'::jsonb`),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_session_feedback_responses_conv_slot_idx').on(t.conventionId, t.slotId),
    uniqueIndex('convention_session_feedback_responses_slot_user_idx').on(t.slotId, t.userId),
  ],
)

/* --- Vetting / safety (027 + 038 + 042) --- */

export const conventionVettingApplications = pgTable(
  'convention_vetting_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    applicantUserId: uuid('applicant_user_id').references(() => users.id, { onDelete: 'set null' }),
    applicantName: varchar('applicant_name', { length: 255 }).notNull(),
    applicantEmail: varchar('applicant_email', { length: 255 }),
    roleApplied: varchar('role_applied', { length: 128 }),
    trustedRoleId: uuid('trusted_role_id').references(() => conventionTrustedRoles.id, {
      onDelete: 'set null',
    }),
    status: conventionVettingStatusEnum('status').notNull().default('pending'),
    organizerNotes: text('organizer_notes'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_vetting_conv_status_idx').on(t.conventionId, t.status),
    index('convention_vetting_role_idx').on(t.conventionId, t.trustedRoleId),
  ],
)

export const conventionTrustedRoles = pgTable(
  'convention_trusted_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    applySlug: varchar('apply_slug', { length: 64 }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: conventionTrustedRoleStatusEnum('status').notNull().default('draft'),
    introText: text('intro_text').notNull().default(''),
    confirmationText: text('confirmation_text').notNull().default(''),
    questions: jsonb('questions').notNull().default(sql`'[]'::jsonb`),
    roleKind: varchar('role_kind', { length: 32 }).notNull().default('custom'),
    /** Per-role application window. `status` is the master on/off; these dates gate within published. */
    applyOpensAt: timestamp('apply_opens_at', { withTimezone: true, mode: 'date' }),
    applyClosesAt: timestamp('apply_closes_at', { withTimezone: true, mode: 'date' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('convention_trusted_roles_conv_slug_idx').on(t.conventionId, t.slug)],
)

export const conventionTrustedRoleQuestions = pgTable(
  'convention_trusted_role_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => conventionTrustedRoles.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull().default('text'),
    label: varchar('label', { length: 512 }).notNull(),
    required: boolean('required').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    optionsJson: jsonb('options_json').notNull().default(sql`'[]'::jsonb`),
    visibilityRulesJson: jsonb('visibility_rules_json').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_trusted_role_questions_role_sort_idx').on(t.roleId, t.sortOrder)],
)

export const conventionSafetyIncidents = pgTable(
  'convention_safety_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    reportedByUserId: uuid('reported_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    locationLabel: varchar('location_label', { length: 255 }),
    severity: varchar('severity', { length: 32 }).notNull().default('medium'),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_safety_incidents_conv_idx').on(t.conventionId, t.createdAt)],
)

/* --- Module tables (049–059) --- */

export const conventionKitIsoPosts = pgTable(
  'convention_kit_iso_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    authorLabel: varchar('author_label', { length: 255 }).notNull(),
    body: text('body').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_kit_iso_posts_conv_idx').on(t.conventionId)],
)

export const conventionSessionFeedback = pgTable(
  'convention_session_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' })
      .unique(),
    enabled: boolean('enabled').notNull().default(false),
    prompt: text('prompt'),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
)

export const conventionMealPeriods = pgTable(
  'convention_meal_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    capacityMax: integer('capacity_max'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_meal_periods_conv_idx').on(t.conventionId, t.startsAt)],
)

export const conventionMealSignups = pgTable(
  'convention_meal_signups',
  {
    periodId: uuid('period_id')
      .notNull()
      .references(() => conventionMealPeriods.id, { onDelete: 'cascade' }),
    registrantId: uuid('registrant_id')
      .notNull()
      .references(() => conventionRegistrants.id, { onDelete: 'cascade' }),
    mealChoice: varchar('meal_choice', { length: 128 }),
    dietaryNotes: text('dietary_notes'),
    status: varchar('status', { length: 32 }).notNull().default('confirmed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.periodId, t.registrantId] })],
)

export const conventionExhibitors = pgTable(
  'convention_exhibitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    boothLabel: varchar('booth_label', { length: 128 }),
    url: text('url'),
    description: text('description'),
    hours: text('hours'),
    logoPath: text('logo_path'),
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    specials: text('specials'),
    viewCount: integer('view_count').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    vendorProfileId: uuid('vendor_profile_id'),
    applicantUserId: uuid('applicant_user_id').references(() => users.id, { onDelete: 'set null' }),
    applicationStatus: conventionExhibitorApplicationStatusEnum('application_status'),
    applicationPayload: jsonb('application_payload').notNull().default(sql`'{}'::jsonb`),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_exhibitors_conv_idx').on(t.conventionId, t.sortOrder)],
)

export const conventionParticipationOffers = pgTable(
  'convention_participation_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    applicantUserId: uuid('applicant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    sourceType: conventionParticipationOfferSourceEnum('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    status: conventionParticipationOfferStatusEnum('status').notNull().default('draft'),
    letterHtml: text('letter_html'),
    letterText: text('letter_text'),
    registrationCategoryId: uuid('registration_category_id'),
    accessCode: varchar('access_code', { length: 128 }),
    boothLabel: varchar('booth_label', { length: 128 }),
    feeCents: integer('fee_cents'),
    feeInstructions: text('fee_instructions'),
    expectedHours: doublePrecision('expected_hours'),
    grantsStaffAccess: boolean('grants_staff_access').notNull().default(false),
    approvedOfferingIds: jsonb('approved_offering_ids').notNull().default(sql`'[]'::jsonb`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('convention_participation_offers_conv_status_idx').on(t.conventionId, t.status),
    index('convention_participation_offers_applicant_idx').on(t.conventionId, t.applicantUserId),
    index('convention_participation_offers_source_idx').on(t.sourceType, t.sourceId),
  ],
)

export const conventionAttendeeGroups = pgTable(
  'convention_attendee_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    visibility: varchar('visibility', { length: 32 }).notNull().default('public'),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    capacity: integer('capacity'),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_attendee_groups_conv_idx').on(t.conventionId)],
)

export const conventionAttendeeGroupMembers = pgTable(
  'convention_attendee_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
)

export const conventionAttendeeGroupJoinRequests = pgTable(
  'convention_attendee_group_join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message'),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('convention_attendee_group_join_req_group_user_idx').on(t.groupId, t.userId),
  ],
)

export const conventionAttendeeGroupAnnouncements = pgTable(
  'convention_attendee_group_announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_attendee_group_announcements_group_idx').on(t.groupId, t.createdAt)],
)

export const conventionAttendeeGroupChores = pgTable(
  'convention_attendee_group_chores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_attendee_group_chores_group_idx').on(t.groupId)],
)

export const conventionAttendeeGroupBringItems = pgTable(
  'convention_attendee_group_bring_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    bringerUserId: uuid('bringer_user_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_attendee_group_bring_items_group_idx').on(t.groupId)],
)

export const conventionAttendeeGroupReports = pgTable(
  'convention_attendee_group_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => conventionAttendeeGroups.id, { onDelete: 'cascade' }),
    reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_attendee_group_reports_group_idx').on(t.groupId, t.createdAt)],
)

export const conventionRegistrantInboundSecrets = pgTable(
  'convention_registrant_inbound_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    secretHash: text('secret_hash').notNull(),
    label: varchar('label', { length: 128 }).notNull().default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convention_registrant_inbound_secrets_conv_label_idx').on(t.conventionId, t.label),
    index('convention_registrant_inbound_secrets_conv_idx').on(t.conventionId),
  ],
)

export const conventionIsoComments = pgTable(
  'convention_iso_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => conventionKitIsoPosts.id, { onDelete: 'cascade' }),
    authorLabel: varchar('author_label', { length: 255 }).notNull(),
    body: text('body').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convention_iso_comments_post_idx').on(t.postId, t.createdAt)],
)

/** Event Systems command-bridge team permissions (separate from attendance grants). */
export const conventionCommandGrants = pgTable(
  'convention_command_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conventionId: uuid('convention_id')
      .notNull()
      .references(() => conventions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canRegistration: boolean('can_registration').notNull().default(false),
    canStaffOps: boolean('can_staff_ops').notNull().default(false),
    canScheduler: boolean('can_scheduler').notNull().default(false),
    grantedByUserId: uuid('granted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('convention_command_grants_conv_user_idx').on(t.conventionId, t.userId),
    index('convention_command_grants_convention_idx').on(t.conventionId),
  ],
)
