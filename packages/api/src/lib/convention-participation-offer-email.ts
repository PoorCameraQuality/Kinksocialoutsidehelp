import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildConventionParticipationOfferEmail } from './transactional-email.js'
import { sendEmail } from './mailer.js'
import { getUserEmailById } from './user-email.js'
import { mapParticipationOffer } from './convention-participation-offers.js'

export async function sendParticipationOfferEmail(offerId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(schema.conventionParticipationOffers)
    .where(eq(schema.conventionParticipationOffers.id, offerId))
    .limit(1)
  if (!row || row.status !== 'sent') return

  const [conv] = await db
    .select({ slug: schema.conventions.slug, name: schema.conventions.name })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, row.conventionId))
    .limit(1)
  if (!conv) return

  const recipient = await getUserEmailById(row.applicantUserId)
  if (!recipient) return

  const offer = mapParticipationOffer(row)
  const { subject, text, html } = buildConventionParticipationOfferEmail({
    conventionName: conv.name,
    conventionSlug: conv.slug,
    offer,
  })
  await sendEmail({ to: recipient, subject, text, html })
}
