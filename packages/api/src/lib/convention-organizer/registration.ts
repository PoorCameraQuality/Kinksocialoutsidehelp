/**
 * Shared Zod schemas + mappers for the convention registration domain.
 * Kit-shape (camelCase) input, Drizzle column output. One source of truth
 * for organizer routes, public attendee registration, and the seed.
 */
import { z } from 'zod'
import {
  displayRegistrationStatus,
  inferRoleKindFromCategoryName,
  roleKindLabel,
} from '../convention-registrant-fields.js'
import type * as schema from '../../db/schema.js'

/* --- Status / role enums --- */

export const QUESTION_TYPE_VALUES = [
  'text',
  'long_text',
  'email',
  'phone',
  'single_choice',
  'multi_choice',
  'dropdown',
  'date',
  'file_upload',
  'emergency_contact',
  'pronouns',
  'consent_matrix',
] as const

export type QuestionType = (typeof QUESTION_TYPE_VALUES)[number]

export const ROLE_KIND_VALUES = [
  'attendee',
  'staff',
  'volunteer',
  'presenter',
  'photographer',
  'vendor',
  'comp',
  'other',
] as const

export type RoleKind = (typeof ROLE_KIND_VALUES)[number]

export const VETTING_STATUS_VALUES = ['none', 'pending', 'approved', 'rejected', 'hold', 'denied'] as const

export const REGISTRATION_STATUS_VALUES = [
  'imported',
  'pending',
  'confirmed',
  'cancelled',
  'waitlisted',
  'checked_in',
  'registered',
] as const

export const TRUSTED_ROLE_STATUS_VALUES = ['draft', 'published', 'archived'] as const

export const REGISTRATION_FORM_STATUS_VALUES = ['draft', 'published'] as const

export const POLICY_KIND_VALUES = ['coc', 'waiver', 'photo', 'marketing', 'other'] as const

/* --- Helpers --- */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'role'
}

/* --- Registration category --- */

export const RegistrationCategoryBody = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    sortOrder: z.number().int().optional(),
    capacityMax: z.number().int().nullable().optional(),
    capacity: z.number().int().nullable().optional(),
    priceCents: z.number().int().nullable().optional(),
    compCode: z.string().max(64).nullable().optional(),
    accessCode: z.string().max(64).nullable().optional(),
    grantsStaffAccess: z.boolean().optional(),
    roleKind: z.enum(ROLE_KIND_VALUES).optional(),
    isPublic: z.boolean().optional(),
    expectedHours: z.number().nullable().optional(),
    checkInValidFrom: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (v == null || v === '' ? null : new Date(v))),
    checkInValidThrough: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (v == null || v === '' ? null : new Date(v))),
    externalSourceRef: z.string().max(255).nullable().optional(),
    importedPaymentStatus: z.string().max(64).nullable().optional(),
  })
  .partial({
    name: true,
  })

export type RegistrationCategoryInput = z.infer<typeof RegistrationCategoryBody>

export function mapRegistrationCategory(row: typeof schema.conventionRegistrationCategories.$inferSelect) {
  const accessCode = row.accessCode ?? row.compCode ?? null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    capacityMax: row.capacityMax ?? null,
    capacity: row.capacityMax ?? null,
    priceCents: row.priceCents ?? null,
    compCode: row.compCode ?? accessCode ?? null,
    accessCode,
    grantsStaffAccess: row.grantsStaffAccess,
    roleKind: row.roleKind || inferRoleKindFromCategoryName(row.name),
    roleKindLabel: roleKindLabel(row.roleKind || inferRoleKindFromCategoryName(row.name)),
    isPublic: row.isPublic,
    expectedHours: row.expectedHours ?? null,
    checkInValidFrom: row.checkInValidFrom ? new Date(row.checkInValidFrom).toISOString() : null,
    checkInValidThrough: row.checkInValidThrough ? new Date(row.checkInValidThrough).toISOString() : null,
    externalSourceRef: row.externalSourceRef ?? null,
    importedPaymentStatus: row.importedPaymentStatus ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/* --- Registration form + questions --- */

export const RegistrationQuestionBody = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(QUESTION_TYPE_VALUES).optional(),
  fieldType: z.string().max(32).optional(),
  label: z.string().min(1).max(512),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  optionsJson: z.unknown().optional(),
  options: z.unknown().optional(),
  visibilityRulesJson: z.record(z.string(), z.unknown()).optional(),
  requiredForCategoryIds: z.array(z.string().uuid()).optional(),
})

export type RegistrationQuestionInput = z.infer<typeof RegistrationQuestionBody>

export const RegistrationFormBody = z.object({
  status: z.enum(REGISTRATION_FORM_STATUS_VALUES).optional(),
  introHtml: z.string().max(50000).nullable().optional(),
  introText: z.string().max(50000).optional(),
  confirmationText: z.string().max(10000).optional(),
  questions: z.array(RegistrationQuestionBody).optional(),
})

export type RegistrationFormInput = z.infer<typeof RegistrationFormBody>

export function questionTypeFromBody(q: RegistrationQuestionInput): QuestionType {
  if (q.type) return q.type
  if (q.fieldType && (QUESTION_TYPE_VALUES as readonly string[]).includes(q.fieldType)) {
    return q.fieldType as QuestionType
  }
  return 'text'
}

export function questionOptionsFromBody(q: RegistrationQuestionInput): unknown {
  if (q.optionsJson !== undefined) return q.optionsJson
  if (q.options !== undefined) return q.options
  return []
}

export function mapRegistrationQuestion(row: typeof schema.conventionRegistrationQuestions.$inferSelect) {
  const optionsJson =
    row.optionsJson !== undefined && row.optionsJson !== null && (row.optionsJson as unknown as unknown[]).length
      ? row.optionsJson
      : row.options
  const requiredForCategoryIds = Array.isArray(row.requiredForCategoryIds)
    ? (row.requiredForCategoryIds as string[])
    : []
  return {
    id: row.id,
    type: row.fieldType,
    fieldType: row.fieldType,
    label: row.label,
    required: row.required,
    sortOrder: row.sortOrder,
    optionsJson,
    options: optionsJson,
    visibilityRulesJson: row.visibilityRulesJson ?? {},
    requiredForCategoryIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

export function mapRegistrationForm(form: typeof schema.conventionRegistrationForms.$inferSelect | null) {
  if (!form) return null
  return {
    id: form.id,
    status: form.status,
    introHtml: form.introHtml,
    introText: form.introText,
    confirmationText: form.confirmationText,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  }
}

/* --- Trusted roles --- */

export const TrustedRoleQuestionBody = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(QUESTION_TYPE_VALUES).optional(),
  fieldType: z.string().max(32).optional(),
  label: z.string().min(1).max(512),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  optionsJson: z.unknown().optional(),
  options: z.unknown().optional(),
  visibilityRulesJson: z.record(z.string(), z.unknown()).optional(),
})

export const TRUSTED_ROLE_KIND_VALUES = [
  'staff',
  'volunteer',
  'presenter',
  'photographer',
  'educator',
  'performer',
  'custom',
] as const

const trustedRoleWindowDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v == null || v === '' ? null : new Date(v)))

export const TrustedRoleBody = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(64).optional(),
  applySlug: z.string().min(1).max(64).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(TRUSTED_ROLE_STATUS_VALUES).optional(),
  roleKind: z.enum(TRUSTED_ROLE_KIND_VALUES).optional(),
  introText: z.string().max(50000).optional(),
  confirmationText: z.string().max(10000).optional(),
  sortOrder: z.number().int().optional(),
  applyOpensAt: trustedRoleWindowDate,
  applyClosesAt: trustedRoleWindowDate,
  questions: z.array(TrustedRoleQuestionBody).optional(),
})

export type TrustedRoleInput = z.infer<typeof TrustedRoleBody>

export function trustedRoleApplySlug(input: TrustedRoleInput): string | undefined {
  const fromInput = input.applySlug ?? input.slug
  if (fromInput) return slugify(fromInput)
  if (input.name) return slugify(input.name)
  return undefined
}

export function mapTrustedRoleQuestion(
  row: typeof schema.conventionTrustedRoleQuestions.$inferSelect,
) {
  return {
    id: row.id,
    type: row.type,
    fieldType: row.type,
    label: row.label,
    required: row.required,
    sortOrder: row.sortOrder,
    optionsJson: row.optionsJson ?? [],
    options: row.optionsJson ?? [],
    visibilityRulesJson: row.visibilityRulesJson ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapTrustedRole(
  row: typeof schema.conventionTrustedRoles.$inferSelect,
  questions: Array<ReturnType<typeof mapTrustedRoleQuestion>>,
) {
  return {
    id: row.id,
    slug: row.slug,
    applySlug: row.applySlug ?? row.slug,
    name: row.title,
    title: row.title,
    description: row.description,
    status: row.status,
    roleKind: row.roleKind ?? 'custom',
    introText: row.introText,
    confirmationText: row.confirmationText,
    sortOrder: row.sortOrder,
    applyOpensAt: row.applyOpensAt ? new Date(row.applyOpensAt).toISOString() : null,
    applyClosesAt: row.applyClosesAt ? new Date(row.applyClosesAt).toISOString() : null,
    applyOpen: isTrustedRoleApplyOpen(row),
    questions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * True when a trusted role is currently accepting public applications:
 * published, and within its optional open/close window.
 */
export function isTrustedRoleApplyOpen(
  role: {
    status: string
    applyOpensAt?: Date | null
    applyClosesAt?: Date | null
  },
  now: Date = new Date(),
): boolean {
  if (role.status !== 'published') return false
  if (role.applyOpensAt) {
    const opens = new Date(role.applyOpensAt)
    if (Number.isFinite(opens.getTime()) && now < opens) return false
  }
  if (role.applyClosesAt) {
    const closes = new Date(role.applyClosesAt)
    if (Number.isFinite(closes.getTime()) && now > closes) return false
  }
  return true
}

/* --- Public registrant submission --- */

export const PublicRegistrantBody = z.object({
  categoryId: z.string().uuid(),
  accessCode: z.string().max(128).optional(),
  badgeName: z.string().max(255).optional().nullable(),
  legalName: z.string().max(255).optional().nullable(),
  pronouns: z.string().max(64).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  answers: z.record(z.string().uuid(), z.unknown()).optional(),
  policyAcceptances: z
    .array(
      z.object({
        policyId: z.string().uuid(),
        signerName: z.string().max(255).optional(),
        signerEmail: z.string().email().optional(),
        signatureMethod: z.string().max(64).optional(),
      }),
    )
    .optional(),
})

export type PublicRegistrantInput = z.infer<typeof PublicRegistrantBody>

export const PublicTrustedRoleApplicationBody = z.object({
  applicantName: z.string().min(1).max(255).optional(),
  applicantEmail: z.string().email().optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
})

export type PublicTrustedRoleApplicationInput = z.infer<typeof PublicTrustedRoleApplicationBody>

/* --- Unified registrant mapper --- */

export type CheckInEligibility = 'ok' | 'early' | 'late' | 'closed' | 'not_yet'

export function computeCheckInEligibility(
  category: { checkInValidFrom: Date | null; checkInValidThrough: Date | null } | null,
  now = new Date(),
): { eligibility: CheckInEligibility; from: Date | null; through: Date | null } {
  const from = category?.checkInValidFrom ?? null
  const through = category?.checkInValidThrough ?? null
  if (!from && !through) return { eligibility: 'ok', from, through }
  if (from && now < from) return { eligibility: 'early', from, through }
  if (through && now > through) return { eligibility: 'late', from, through }
  return { eligibility: 'ok', from, through }
}

export class CheckInBlockedError extends Error {
  constructor(public readonly eligibility: CheckInEligibility) {
    super(`Check-in blocked: ${eligibility}`)
  }
}

/**
 * Throws CheckInBlockedError if check-in is not allowed for the registrant's
 * category window. Pass earlyOverride=true to skip the check (override is
 * recorded by the route in checkedInTiming = 'early_override').
 */
export function assertCheckInAllowed(
  category: { checkInValidFrom: Date | null; checkInValidThrough: Date | null } | null,
  options: { earlyOverride?: boolean; now?: Date } = {},
) {
  if (options.earlyOverride) return
  const { eligibility } = computeCheckInEligibility(category, options.now)
  if (eligibility === 'early' || eligibility === 'late') {
    throw new CheckInBlockedError(eligibility)
  }
}

export type CheckInApplyResult =
  | {
      ok: true
      patch: {
        checkedInAt: Date
        registrationStatus: 'checked_in'
        checkedInTiming: string
        updatedAt: Date
      }
    }
  | {
      ok: false
      status: 409
      body:
        | {
            error: string
            code: 'EARLY_CHECK_IN'
            validFrom: string | null
            validThrough: string | null
          }
        | {
            error: string
            code: 'NOT_ELIGIBLE'
          }
    }

const CHECK_IN_BLOCKED_STATUSES = new Set(['cancelled', 'waitlisted'])

/** Shared check-in write policy for signups PATCH and door POST (early blocked unless override; late allowed). */
export function resolveCheckInUpdate(
  category: { checkInValidFrom: Date | null; checkInValidThrough: Date | null } | null,
  options: {
    earlyCheckInOverride?: boolean
    now?: Date
    /** Raw DB registrationStatus - blocks waitlisted/cancelled before window checks. */
    registrationStatus?: string | null
  } = {},
): CheckInApplyResult {
  if (
    options.registrationStatus &&
    CHECK_IN_BLOCKED_STATUSES.has(options.registrationStatus)
  ) {
    return {
      ok: false,
      status: 409,
      body: { error: 'Registrant cannot be checked in', code: 'NOT_ELIGIBLE' },
    }
  }
  const now = options.now ?? new Date()
  const { eligibility, from, through } = computeCheckInEligibility(category, now)
  if (eligibility === 'early' && !options.earlyCheckInOverride) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Early check-in',
        code: 'EARLY_CHECK_IN',
        validFrom: from ? from.toISOString() : null,
        validThrough: through ? through.toISOString() : null,
      },
    }
  }
  const checkedInTiming =
    options.earlyCheckInOverride && eligibility === 'early'
      ? 'early_override'
      : eligibility === 'late'
        ? 'late'
        : 'on_time'
  return {
    ok: true,
    patch: {
      checkedInAt: now,
      registrationStatus: 'checked_in',
      checkedInTiming,
      updatedAt: now,
    },
  }
}

export function mapRegistrantFull(
  row: typeof schema.conventionRegistrants.$inferSelect,
  ctx: {
    categoryName?: string | null
    profileDisplayName?: string | null
    categoryRow?:
      | (typeof schema.conventionRegistrationCategories.$inferSelect | null)
      | undefined
    now?: Date
  } = {},
) {
  const sceneDisplayName = ctx.profileDisplayName?.trim() || row.displayName
  const { eligibility, from, through } = computeCheckInEligibility(
    ctx.categoryRow
      ? {
          checkInValidFrom: ctx.categoryRow.checkInValidFrom,
          checkInValidThrough: ctx.categoryRow.checkInValidThrough,
        }
      : null,
    ctx.now,
  )
  return {
    id: row.id,
    categoryId: row.categoryId ?? '',
    categoryName: ctx.categoryName ?? null,
    personId: row.userId,
    status: displayRegistrationStatus(row.registrationStatus, row.checkedInAt),
    sceneDisplayName,
    email: row.email,
    legalName: row.legalName ?? row.badgeName ?? null,
    badgeName: row.badgeName,
    internalNotes: row.notes,
    vettingStatus: row.vettingStatus ?? 'approved',
    vettingSafetyNotes: row.vettingSafetyNotes ?? null,
    importedPaymentStatus: row.importedPaymentStatus ?? null,
    pronouns: row.pronouns,
    phone: row.phone ?? null,
    externalSource: row.externalSource ?? null,
    externalId: row.externalId,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    consentWaiverAckAt: row.consentWaiverAckAt ? row.consentWaiverAckAt.toISOString() : null,
    consentPhotoAckAt: row.consentPhotoAckAt ? row.consentPhotoAckAt.toISOString() : null,
    rabbitsignFolderId: row.rabbitsignFolderId ?? null,
    rabbitsignStatus: row.rabbitsignStatus ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    checkInValidFrom: from ? from.toISOString() : null,
    checkInValidThrough: through ? through.toISOString() : null,
    checkInEligibility: eligibility,
    checkInTiming: row.checkedInTiming ?? null,
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
  }
}
