/**
 * Public convention attendee endpoints - used by the C2K convention site.
 *  - GET  /public/conventions/:key/register-info
 *  - POST /public/conventions/:key/registrations
 *  - GET  /public/conventions/:key/trusted-roles/:applySlug
 *  - POST /public/conventions/:key/trusted-roles/:applySlug/apply
 *
 * Identity: requires a logged-in C2K user (req.session.userId). Comp/access
 * codes are validated server-side; never round-tripped to the client.
 */
import { and, asc, eq, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { requestConventionPeopleDirectorySync } from '../lib/convention-people-sync-queue.js'
import { syncAccessGrantOnRegistration } from '../lib/convention-participation.js'
import { createNotification } from '../lib/create-notification.js'
import { NOTIFICATION_TYPES } from '@c2k/shared'
import {
  isTrustedRoleApplyOpen,
  mapRegistrantFull,
  mapRegistrationCategory,
  mapRegistrationForm,
  mapRegistrationQuestion,
  mapTrustedRole,
  mapTrustedRoleQuestion,
  PublicRegistrantBody,
  PublicTrustedRoleApplicationBody,
} from '../lib/convention-organizer/registration.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireUserId(req: FastifyRequest, reply: FastifyReply): string | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Sign in required' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return userId
}

async function loadConvention(key: string) {
  // Resolve by slug first, then by id (mirrors organizer routes).
  const [bySlug] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, key))
    .limit(1)
  if (bySlug) return bySlug
  if (UUID_RE.test(key)) {
    const [byId] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.id, key))
      .limit(1)
    return byId ?? null
  }
  return null
}

async function loadPublicForm(conventionId: string) {
  const [form] = await db
    .select()
    .from(schema.conventionRegistrationForms)
    .where(eq(schema.conventionRegistrationForms.conventionId, conventionId))
    .limit(1)
  if (!form) return { form: null, questions: [] as ReturnType<typeof mapRegistrationQuestion>[] }
  const questions = await db
    .select()
    .from(schema.conventionRegistrationQuestions)
    .where(eq(schema.conventionRegistrationQuestions.formId, form.id))
    .orderBy(asc(schema.conventionRegistrationQuestions.sortOrder))
  return { form, questions: questions.map(mapRegistrationQuestion) }
}

export function registerConventionPublicRoutes(app: FastifyInstance) {
  app.route({
    method: 'GET',
    url: '/api/v1/public/conventions/:key/register-info',
    handler: async (req, reply) => {
      const { key } = req.params as { key: string }
      const conv = await loadConvention(key)
      if (!conv) return reply.status(404).send({ error: 'Not found' })
      const categories = await db
        .select()
        .from(schema.conventionRegistrationCategories)
        .where(eq(schema.conventionRegistrationCategories.conventionId, conv.id))
        .orderBy(
          asc(schema.conventionRegistrationCategories.sortOrder),
          asc(schema.conventionRegistrationCategories.name),
        )
      const policies = await db
        .select()
        .from(schema.conventionPolicyDocuments)
        .where(eq(schema.conventionPolicyDocuments.conventionId, conv.id))
        .orderBy(asc(schema.conventionPolicyDocuments.sortOrder))
      const { form, questions } = await loadPublicForm(conv.id)
      // Filter out internal-only categories from the public view, and mask
      // accessCode / compCode so the client never sees the secret value.
      const publicCategories = categories
        .filter((c) => c.isPublic)
        .map((c) => {
          const m = mapRegistrationCategory(c)
          return {
            ...m,
            accessCode: c.accessCode || c.compCode ? '__REQUIRES_CODE__' : null,
            compCode: c.compCode || c.accessCode ? '__REQUIRES_CODE__' : null,
            requiresAccessCode: Boolean(c.accessCode || c.compCode),
            grantsStaffAccess: c.grantsStaffAccess,
          }
        })
      let payments: {
        processor: 'stripe' | 'external' | 'manual'
        externalPaymentUrl: string | null
        stripeReady: boolean
      } = { processor: 'manual', externalPaymentUrl: null, stripeReady: false }
      if (conv.organizationId) {
        const [orgPay] = await db
          .select({
            paymentProcessor: schema.organizations.paymentProcessor,
            externalPaymentUrl: schema.organizations.externalPaymentUrl,
            stripeConnectAccountId: schema.organizations.stripeConnectAccountId,
            stripeConnectChargesEnabled: schema.organizations.stripeConnectChargesEnabled,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, conv.organizationId))
          .limit(1)
        if (orgPay) {
          const processor =
            orgPay.paymentProcessor === 'external' || orgPay.paymentProcessor === 'manual'
              ? orgPay.paymentProcessor
              : 'stripe'
          payments = {
            processor,
            externalPaymentUrl: orgPay.externalPaymentUrl ?? null,
            stripeReady: Boolean(
              processor === 'stripe' &&
                orgPay.stripeConnectAccountId &&
                orgPay.stripeConnectChargesEnabled,
            ),
          }
        }
      }

      return reply.send({
        convention: { id: conv.id, slug: conv.slug, name: conv.name, title: conv.name },
        categories: publicCategories,
        policies: policies.filter((p) => p.publishedAt || p.requiredForRegistration).map((p) => ({
          id: p.id,
          title: p.title,
          kind: p.kind,
          version: p.version,
          bodyMarkdown: p.bodyMarkdown,
          bodyHtml: p.bodyHtml,
          requiredForRegistration: p.requiredForRegistration,
        })),
        form: form
          ? {
              ...mapRegistrationForm(form),
              questions,
            }
          : null,
        payments,
      })
    },
  })

  app.route({
    method: 'POST',
    url: '/api/v1/public/conventions/:key/registrations',
    handler: async (req, reply) => {
      const userId = requireUserId(req, reply)
      if (!userId) return
      const { key } = req.params as { key: string }
      const parsed = PublicRegistrantBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      const conv = await loadConvention(key)
      if (!conv) return reply.status(404).send({ error: 'Not found' })
      const [category] = await db
        .select()
        .from(schema.conventionRegistrationCategories)
        .where(
          and(
            eq(schema.conventionRegistrationCategories.conventionId, conv.id),
            eq(schema.conventionRegistrationCategories.id, parsed.data.categoryId),
          ),
        )
        .limit(1)
      if (!category) return reply.status(400).send({ error: 'Invalid category' })

      const required = category.accessCode || category.compCode
      if (required) {
        const provided = parsed.data.accessCode?.trim()
        if (!provided || provided !== (category.accessCode ?? category.compCode)) {
          return reply.status(403).send({ error: 'Invalid access code' })
        }
      }
      if (category.grantsStaffAccess && !required) {
        // Defensive: should not happen, but if a category grants staff access
        // it must have an access code per ECKE 033.
        return reply.status(403).send({ error: 'Category requires access code' })
      }

      const [profile] = await db
        .select({
          displayName: schema.profiles.displayName,
          pronouns: schema.profiles.pronouns,
          username: schema.users.username,
          email: schema.users.email,
        })
        .from(schema.users)
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(eq(schema.users.id, userId))
        .limit(1)
      if (!profile) return reply.status(401).send({ error: 'Profile missing' })

      const displayName = (profile.displayName ?? profile.username).trim()
      const badgeName = parsed.data.badgeName?.trim() || displayName

      const [existing] = await db
        .select()
        .from(schema.conventionRegistrants)
        .where(
          and(
            eq(schema.conventionRegistrants.conventionId, conv.id),
            eq(schema.conventionRegistrants.userId, userId),
          ),
        )
        .limit(1)

      let registrantId: string
      if (existing) {
        const [updated] = await db
          .update(schema.conventionRegistrants)
          .set({
            categoryId: category.id,
            displayName,
            badgeName,
            legalName: parsed.data.legalName ?? existing.legalName ?? null,
            pronouns: parsed.data.pronouns ?? profile.pronouns ?? existing.pronouns,
            phone: parsed.data.phone ?? existing.phone ?? null,
            email: existing.email ?? profile.email,
            registrationStatus: 'confirmed',
            updatedAt: new Date(),
          })
          .where(eq(schema.conventionRegistrants.id, existing.id))
          .returning()
        registrantId = updated!.id
      } else {
        const [inserted] = await db
          .insert(schema.conventionRegistrants)
          .values({
            conventionId: conv.id,
            categoryId: category.id,
            userId,
            displayName,
            badgeName,
            legalName: parsed.data.legalName ?? null,
            email: profile.email,
            phone: parsed.data.phone ?? null,
            pronouns: parsed.data.pronouns ?? profile.pronouns ?? null,
            registrationStatus: 'confirmed',
            vettingStatus: 'approved',
          })
          .returning()
        registrantId = inserted!.id
      }

      if (parsed.data.answers) {
        for (const [questionId, value] of Object.entries(parsed.data.answers)) {
          if (!UUID_RE.test(questionId)) continue
          const v = value == null ? null : typeof value === 'string' ? value : JSON.stringify(value)
          await db
            .insert(schema.conventionRegistrantAnswers)
            .values({ registrantId, questionId, value: v })
            .onConflictDoUpdate({
              target: [
                schema.conventionRegistrantAnswers.registrantId,
                schema.conventionRegistrantAnswers.questionId,
              ],
              set: { value: v },
            })
        }
      }

      if (parsed.data.policyAcceptances?.length) {
        for (const acc of parsed.data.policyAcceptances) {
          await db
            .insert(schema.conventionRegistrantPolicyAcceptances)
            .values({
              registrantId,
              policyId: acc.policyId,
              signerName: acc.signerName ?? displayName,
              signerEmail: acc.signerEmail ?? profile.email,
              signatureMethod: acc.signatureMethod ?? 'click',
            })
            .onConflictDoNothing()
        }
      }

      await syncAccessGrantOnRegistration({
        conventionId: conv.id,
        userId,
        grantedByUserId: userId,
        role: category.grantsStaffAccess ? 'STAFF' : 'ATTENDEE',
      })
      await requestConventionPeopleDirectorySync(conv.id)

      const [row] = await db
        .select()
        .from(schema.conventionRegistrants)
        .where(eq(schema.conventionRegistrants.id, registrantId))
        .limit(1)
      return reply.status(existing ? 200 : 201).send({
        registrant: mapRegistrantFull(row!, {
          categoryName: category.name,
          categoryRow: category,
          profileDisplayName: profile.displayName,
        }),
      })
    },
  })

  app.route({
    method: 'GET',
    url: '/api/v1/public/conventions/:key/trusted-roles/:applySlug',
    handler: async (req, reply) => {
      const { key, applySlug } = req.params as { key: string; applySlug: string }
      const conv = await loadConvention(key)
      if (!conv) return reply.status(404).send({ error: 'Not found' })
      const lower = applySlug.toLowerCase()
      const [role] = await db
        .select()
        .from(schema.conventionTrustedRoles)
        .where(eq(schema.conventionTrustedRoles.conventionId, conv.id))
        .limit(50)
        .then((rows) =>
          rows.filter(
            (r) =>
              (r.applySlug ?? '').toLowerCase() === lower ||
              (r.slug ?? '').toLowerCase() === lower,
          ),
        )
      if (!role || role.status !== 'published') return reply.status(404).send({ error: 'Not found' })
      const questions = await db
        .select()
        .from(schema.conventionTrustedRoleQuestions)
        .where(eq(schema.conventionTrustedRoleQuestions.roleId, role.id))
        .orderBy(asc(schema.conventionTrustedRoleQuestions.sortOrder))
      return reply.send({
        convention: { id: conv.id, slug: conv.slug, name: conv.name, title: conv.name },
        role: mapTrustedRole(role, questions.map(mapTrustedRoleQuestion)),
      })
    },
  })

  app.route({
    method: 'POST',
    url: '/api/v1/public/conventions/:key/trusted-roles/:applySlug/apply',
    handler: async (req, reply) => {
      const userId = requireUserId(req, reply)
      if (!userId) return
      const { key, applySlug } = req.params as { key: string; applySlug: string }
      const parsed = PublicTrustedRoleApplicationBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      const conv = await loadConvention(key)
      if (!conv) return reply.status(404).send({ error: 'Not found' })
      const lower = applySlug.toLowerCase()
      const roles = await db
        .select()
        .from(schema.conventionTrustedRoles)
        .where(eq(schema.conventionTrustedRoles.conventionId, conv.id))
      const role = roles.find(
        (r) =>
          (r.applySlug ?? '').toLowerCase() === lower || (r.slug ?? '').toLowerCase() === lower,
      )
      if (!role || role.status !== 'published') return reply.status(404).send({ error: 'Not found' })
      if (!isTrustedRoleApplyOpen(role)) {
        return reply
          .status(403)
          .send({ error: 'Applications for this role are not open right now.', code: 'APPLY_WINDOW_CLOSED' })
      }

      const [profile] = await db
        .select({
          displayName: schema.profiles.displayName,
          username: schema.users.username,
          email: schema.users.email,
        })
        .from(schema.users)
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(eq(schema.users.id, userId))
        .limit(1)
      if (!profile) return reply.status(401).send({ error: 'Profile missing' })

      const applicantName = (parsed.data.applicantName ?? profile.displayName ?? profile.username).trim()
      const applicantEmail = parsed.data.applicantEmail ?? profile.email

      const [row] = await db
        .insert(schema.conventionVettingApplications)
        .values({
          conventionId: conv.id,
          applicantUserId: userId,
          applicantName,
          applicantEmail,
          roleApplied: role.title,
          trustedRoleId: role.id,
          status: 'pending',
          payload: parsed.data.answers ?? {},
          organizerNotes: parsed.data.notes ?? null,
        })
        .returning()

      // After commit: notify organizers who manage registration that an application arrived.
      try {
        const organizers = await db
          .select({ userId: schema.conventionCommandGrants.userId })
          .from(schema.conventionCommandGrants)
          .where(
            and(
              eq(schema.conventionCommandGrants.conventionId, conv.id),
              or(
                eq(schema.conventionCommandGrants.canRegistration, true),
                eq(schema.conventionCommandGrants.canStaffOps, true),
              ),
            ),
          )
        await Promise.all(
          organizers.map((o) =>
            createNotification(o.userId, NOTIFICATION_TYPES.conventionApplicationSubmitted, {
              conventionId: conv.id,
              conventionSlug: conv.slug,
              applicationId: row!.id,
              roleTitle: role.title,
              applicantName,
            }),
          ),
        )
      } catch (err) {
        req.log.error({ err }, 'failed to notify organizers of trusted-role application')
      }

      return reply.status(201).send({
        application: {
          id: row!.id,
          status: row!.status,
          createdAt: row!.createdAt.toISOString(),
        },
      })
    },
  })
}
