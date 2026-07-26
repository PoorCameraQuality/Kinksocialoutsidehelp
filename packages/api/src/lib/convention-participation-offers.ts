import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  formatFeeAmount,
  isParticipationWindowOpen,
  mergeOfferLetterTemplate,
  NOTIFICATION_TYPES,
  participationFromConventionSettings,
  type ParticipationOfferSourceType,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { createNotification } from './create-notification.js'
import { enqueueParticipationOfferEmail } from './convention-participation-offer-queue.js'
import { requestConventionPeopleDirectorySync } from './convention-people-sync-queue.js'
import { isTrustedRoleApplyOpen } from './convention-organizer/registration.js'

export function mapParticipationOffer(
  row: typeof schema.conventionParticipationOffers.$inferSelect,
) {
  return {
    id: row.id,
    conventionId: row.conventionId,
    applicantUserId: row.applicantUserId,
    createdByUserId: row.createdByUserId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    status: row.status,
    letterHtml: row.letterHtml,
    letterText: row.letterText,
    registrationCategoryId: row.registrationCategoryId,
    accessCode: row.accessCode,
    boothLabel: row.boothLabel,
    feeCents: row.feeCents,
    feeInstructions: row.feeInstructions,
    expectedHours: row.expectedHours,
    grantsStaffAccess: row.grantsStaffAccess,
    approvedOfferingIds: row.approvedOfferingIds ?? [],
    expiresAt: row.expiresAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    payload: row.payload ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const OfferBody = z.object({
  sourceType: z.enum(['presenter_request', 'vetting_application', 'vendor_application']),
  sourceId: z.string().uuid(),
  letterHtml: z.string().max(100_000).nullable().optional(),
  letterText: z.string().max(100_000).nullable().optional(),
  registrationCategoryId: z.string().uuid().nullable().optional(),
  accessCode: z.string().max(128).nullable().optional(),
  boothLabel: z.string().max(128).nullable().optional(),
  feeCents: z.number().int().nullable().optional(),
  feeInstructions: z.string().max(10_000).nullable().optional(),
  expectedHours: z.number().nullable().optional(),
  grantsStaffAccess: z.boolean().optional(),
  approvedOfferingIds: z.array(z.string().uuid()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export async function resolveOfferApplicant(
  sourceType: ParticipationOfferSourceType,
  sourceId: string,
  conventionId: string,
): Promise<{ applicantUserId: string } | null> {
  if (sourceType === 'presenter_request') {
    const [row] = await db
      .select({ userId: schema.conventionPresenterRequests.presenterUserId })
      .from(schema.conventionPresenterRequests)
      .where(
        and(
          eq(schema.conventionPresenterRequests.id, sourceId),
          eq(schema.conventionPresenterRequests.conventionId, conventionId),
        ),
      )
      .limit(1)
    return row ? { applicantUserId: row.userId } : null
  }
  if (sourceType === 'vetting_application') {
    const [row] = await db
      .select({ userId: schema.conventionVettingApplications.applicantUserId })
      .from(schema.conventionVettingApplications)
      .where(
        and(
          eq(schema.conventionVettingApplications.id, sourceId),
          eq(schema.conventionVettingApplications.conventionId, conventionId),
        ),
      )
      .limit(1)
    return row?.userId ? { applicantUserId: row.userId } : null
  }
  if (sourceType === 'vendor_application') {
    const [row] = await db
      .select({ userId: schema.conventionExhibitors.applicantUserId })
      .from(schema.conventionExhibitors)
      .where(
        and(
          eq(schema.conventionExhibitors.id, sourceId),
          eq(schema.conventionExhibitors.conventionId, conventionId),
        ),
      )
      .limit(1)
    return row?.userId ? { applicantUserId: row.userId } : null
  }
  return null
}

async function supersedeActiveOffers(
  sourceType: ParticipationOfferSourceType,
  sourceId: string,
): Promise<void> {
  await db
    .update(schema.conventionParticipationOffers)
    .set({ status: 'superseded', updatedAt: new Date() })
    .where(
      and(
        eq(schema.conventionParticipationOffers.sourceType, sourceType),
        eq(schema.conventionParticipationOffers.sourceId, sourceId),
        inArray(schema.conventionParticipationOffers.status, ['draft', 'sent']),
      ),
    )
}

async function markSourceOffered(
  sourceType: ParticipationOfferSourceType,
  sourceId: string,
): Promise<void> {
  if (sourceType === 'presenter_request') {
    await db
      .update(schema.conventionPresenterRequests)
      .set({ status: 'OFFERED', updatedAt: new Date() })
      .where(eq(schema.conventionPresenterRequests.id, sourceId))
    return
  }
  if (sourceType === 'vetting_application') {
    await db
      .update(schema.conventionVettingApplications)
      .set({ status: 'offered', updatedAt: new Date() })
      .where(eq(schema.conventionVettingApplications.id, sourceId))
    return
  }
  if (sourceType === 'vendor_application') {
    await db
      .update(schema.conventionExhibitors)
      .set({ applicationStatus: 'offered', updatedAt: new Date() })
      .where(eq(schema.conventionExhibitors.id, sourceId))
  }
}

async function markSourceOfferResponse(
  sourceType: ParticipationOfferSourceType,
  sourceId: string,
  accepted: boolean,
): Promise<void> {
  if (sourceType === 'presenter_request') {
    await db
      .update(schema.conventionPresenterRequests)
      .set({
        status: accepted ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED',
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionPresenterRequests.id, sourceId))
    return
  }
  if (sourceType === 'vetting_application') {
    await db
      .update(schema.conventionVettingApplications)
      .set({
        status: accepted ? 'offer_accepted' : 'offer_declined',
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionVettingApplications.id, sourceId))
    return
  }
  if (sourceType === 'vendor_application') {
    await db
      .update(schema.conventionExhibitors)
      .set({
        applicationStatus: accepted ? 'accepted' : 'rejected',
        isPublished: accepted,
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionExhibitors.id, sourceId))
  }
}

export async function createParticipationOfferDraft(input: {
  conventionId: string
  createdByUserId: string
  body: z.infer<typeof OfferBody>
  conventionName: string
  applicantName: string
  settings: Record<string, unknown> | null | undefined
}) {
  const applicant = await resolveOfferApplicant(
    input.body.sourceType,
    input.body.sourceId,
    input.conventionId,
  )
  if (!applicant) return { error: 'source_not_found' as const }

  const participation = participationFromConventionSettings(input.settings)
  const templateKey =
    input.body.sourceType === 'presenter_request' ? 'presenter'
    : input.body.sourceType === 'vendor_application' ? 'vendor'
    : 'staff'
  const template = participation.offerTemplates?.[templateKey as keyof typeof participation.offerTemplates]
  const defaultDays = participation.defaultOfferExpiresDays ?? 14
  const expiresAt =
    input.body.expiresAt ?
      new Date(input.body.expiresAt)
    : new Date(Date.now() + defaultDays * 864e5)

  let accessCode = input.body.accessCode ?? null
  if (!accessCode && input.body.registrationCategoryId) {
    const [cat] = await db
      .select()
      .from(schema.conventionRegistrationCategories)
      .where(eq(schema.conventionRegistrationCategories.id, input.body.registrationCategoryId))
      .limit(1)
    accessCode = cat?.accessCode ?? cat?.compCode ?? null
  }

  const letterTemplate = input.body.letterText ?? input.body.letterHtml ?? template?.letterHtml ?? ''
  const mergedLetter = mergeOfferLetterTemplate(letterTemplate, {
    applicantName: input.applicantName,
    conventionName: input.conventionName,
    accessCode: accessCode ?? '',
    boothLabel: input.body.boothLabel ?? '',
    feeAmount: formatFeeAmount(input.body.feeCents ?? null),
    expectedHours: input.body.expectedHours != null ? String(input.body.expectedHours) : '',
  })

  await supersedeActiveOffers(input.body.sourceType, input.body.sourceId)

  const [row] = await db
    .insert(schema.conventionParticipationOffers)
    .values({
      conventionId: input.conventionId,
      applicantUserId: applicant.applicantUserId,
      createdByUserId: input.createdByUserId,
      sourceType: input.body.sourceType,
      sourceId: input.body.sourceId,
      status: 'draft',
      letterHtml: input.body.letterHtml ?? mergedLetter,
      letterText: input.body.letterText ?? mergedLetter,
      registrationCategoryId: input.body.registrationCategoryId ?? template?.registrationCategoryId ?? null,
      accessCode,
      boothLabel: input.body.boothLabel ?? null,
      feeCents: input.body.feeCents ?? null,
      feeInstructions: input.body.feeInstructions ?? template?.feeInstructions ?? null,
      expectedHours: input.body.expectedHours ?? template?.expectedHours ?? null,
      grantsStaffAccess: input.body.grantsStaffAccess ?? false,
      approvedOfferingIds: input.body.approvedOfferingIds ?? [],
      expiresAt,
      payload: input.body.payload ?? {},
    })
    .returning()

  return { offer: mapParticipationOffer(row!) }
}

export async function sendParticipationOffer(offerId: string, conventionId: string): Promise<
  | { offer: ReturnType<typeof mapParticipationOffer> }
  | { error: string }
> {
  const [row] = await db
    .select()
    .from(schema.conventionParticipationOffers)
    .where(
      and(
        eq(schema.conventionParticipationOffers.id, offerId),
        eq(schema.conventionParticipationOffers.conventionId, conventionId),
      ),
    )
    .limit(1)
  if (!row) return { error: 'not_found' }
  if (row.status !== 'draft') return { error: 'invalid_status' }

  const now = new Date()
  const [updated] = await db
    .update(schema.conventionParticipationOffers)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(eq(schema.conventionParticipationOffers.id, offerId))
    .returning()

  await markSourceOffered(row.sourceType, row.sourceId)

  await createNotification(row.applicantUserId, NOTIFICATION_TYPES.conventionParticipationOfferSent, {
    offerId: row.id,
    conventionId,
    sourceType: row.sourceType,
  })

  await enqueueParticipationOfferEmail(offerId, conventionId)

  return { offer: mapParticipationOffer(updated!) }
}

export async function acceptParticipationOffer(
  offerId: string,
  conventionId: string,
  applicantUserId: string,
  conventionSlug: string,
): Promise<{ offer: ReturnType<typeof mapParticipationOffer>; registerUrl?: string } | { error: string }> {
  const [row] = await db
    .select()
    .from(schema.conventionParticipationOffers)
    .where(
      and(
        eq(schema.conventionParticipationOffers.id, offerId),
        eq(schema.conventionParticipationOffers.conventionId, conventionId),
        eq(schema.conventionParticipationOffers.applicantUserId, applicantUserId),
      ),
    )
    .limit(1)
  if (!row) return { error: 'not_found' }
  if (row.status !== 'sent') return { error: 'invalid_status' }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db
      .update(schema.conventionParticipationOffers)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(schema.conventionParticipationOffers.id, offerId))
    return { error: 'expired' }
  }

  const now = new Date()
  const [updated] = await db
    .update(schema.conventionParticipationOffers)
    .set({ status: 'accepted', respondedAt: now, updatedAt: now })
    .where(eq(schema.conventionParticipationOffers.id, offerId))
    .returning()

  await markSourceOfferResponse(row.sourceType, row.sourceId, true)

  if (row.sourceType === 'vendor_application') {
    await requestConventionPeopleDirectorySync(conventionId)
  }

  if (row.createdByUserId) {
    await createNotification(row.createdByUserId, NOTIFICATION_TYPES.conventionParticipationOfferResponded, {
      offerId: row.id,
      conventionId,
      response: 'accepted',
    })
  }

  let registerUrl: string | undefined
  if (row.registrationCategoryId && row.accessCode) {
    const base = (process.env.C2K_PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')
    registerUrl = `${base}/conventions/${encodeURIComponent(conventionSlug)}/register?category=${encodeURIComponent(row.registrationCategoryId)}&code=${encodeURIComponent(row.accessCode)}`
  }

  return { offer: mapParticipationOffer(updated!), registerUrl }
}

export async function declineParticipationOffer(
  offerId: string,
  conventionId: string,
  applicantUserId: string,
  reason?: string,
): Promise<{ offer: ReturnType<typeof mapParticipationOffer> } | { error: string }> {
  const [row] = await db
    .select()
    .from(schema.conventionParticipationOffers)
    .where(
      and(
        eq(schema.conventionParticipationOffers.id, offerId),
        eq(schema.conventionParticipationOffers.conventionId, conventionId),
        eq(schema.conventionParticipationOffers.applicantUserId, applicantUserId),
      ),
    )
    .limit(1)
  if (!row) return { error: 'not_found' }
  if (row.status !== 'sent') return { error: 'invalid_status' }

  const payload = { ...(row.payload as Record<string, unknown>), declineReason: reason ?? null }
  const now = new Date()
  const [updated] = await db
    .update(schema.conventionParticipationOffers)
    .set({ status: 'declined', respondedAt: now, updatedAt: now, payload })
    .where(eq(schema.conventionParticipationOffers.id, offerId))
    .returning()

  await markSourceOfferResponse(row.sourceType, row.sourceId, false)

  if (row.createdByUserId) {
    await createNotification(row.createdByUserId, NOTIFICATION_TYPES.conventionParticipationOfferResponded, {
      offerId: row.id,
      conventionId,
      response: 'declined',
    })
  }

  return { offer: mapParticipationOffer(updated!) }
}

export async function loadParticipationOpportunities(
  conventionId: string,
  conventionSlug: string,
  settings: Record<string, unknown> | null | undefined,
  userId: string | null,
) {
  const participation = participationFromConventionSettings(settings)
  const staffRoleId = participation.staffRoleId
  const volunteerRoleId = participation.volunteerRoleId

  const allRoles = await db
    .select()
    .from(schema.conventionTrustedRoles)
    .where(eq(schema.conventionTrustedRoles.conventionId, conventionId))
    .orderBy(asc(schema.conventionTrustedRoles.sortOrder), asc(schema.conventionTrustedRoles.title))

  const roleById = new Map(allRoles.map((r) => [r.id, r]))

  function trustedRoleApplyUrl(role: (typeof allRoles)[number]): string {
    const slug = role.applySlug?.trim() || role.slug
    return `/conventions/${conventionSlug}/apply/${encodeURIComponent(slug)}`
  }

  function pathwayForLinkedRole(linkedId: string | null | undefined, fallbackKind: string) {
    const role =
      (linkedId ? roleById.get(linkedId) : undefined) ??
      allRoles.find((r) => r.status === 'published' && r.roleKind === fallbackKind)
    if (!role || role.status !== 'published') {
      return { open: false, applyUrl: null as string | null }
    }
    return {
      open: isTrustedRoleApplyOpen(role),
      applyUrl: trustedRoleApplyUrl(role),
    }
  }

  const trustedRoles = allRoles
    .filter((r) => r.status === 'published')
    .map((r) => ({
      id: r.id,
      name: r.title,
      roleKind: r.roleKind ?? 'custom',
      applySlug: r.applySlug?.trim() || r.slug,
      open: isTrustedRoleApplyOpen(r),
      applyUrl: trustedRoleApplyUrl(r),
      introHtml: typeof r.introText === 'string' ? r.introText : null,
    }))

  const pathways = {
    present: {
      open: isParticipationWindowOpen(participation.presenterApply),
      applyUrl: `/conventions/${conventionSlug}/present/apply`,
      introHtml: participation.presenterApply?.introHtml ?? null,
    },
    vendor: {
      open: isParticipationWindowOpen(participation.vendorApply),
      applyUrl: `/conventions/${conventionSlug}/vend/apply`,
      introHtml: participation.vendorApply?.introHtml ?? null,
    },
    staff: pathwayForLinkedRole(staffRoleId, 'staff'),
    volunteer: pathwayForLinkedRole(volunteerRoleId, 'volunteer'),
  }

  let myStatus: Record<string, unknown> | null = null
  if (userId) {
    const [presenterPending] = await db
      .select({ c: schema.conventionPresenterRequests.id })
      .from(schema.conventionPresenterRequests)
      .where(
        and(
          eq(schema.conventionPresenterRequests.conventionId, conventionId),
          eq(schema.conventionPresenterRequests.presenterUserId, userId),
          inArray(schema.conventionPresenterRequests.status, ['PENDING', 'OFFERED']),
        ),
      )
      .limit(1)

    const offers = await db
      .select()
      .from(schema.conventionParticipationOffers)
      .where(
        and(
          eq(schema.conventionParticipationOffers.conventionId, conventionId),
          eq(schema.conventionParticipationOffers.applicantUserId, userId),
          inArray(schema.conventionParticipationOffers.status, ['sent', 'accepted']),
        ),
      )
      .orderBy(desc(schema.conventionParticipationOffers.updatedAt))

    myStatus = {
      presenterPending: Boolean(presenterPending),
      pendingOffers: offers.filter((o) => o.status === 'sent').length,
      offers: offers.map(mapParticipationOffer),
      myOffersUrl: `/conventions/${conventionSlug}/my-offers`,
    }
  }

  return { pathways, trustedRoles, myStatus, participation }
}

export { OfferBody }
