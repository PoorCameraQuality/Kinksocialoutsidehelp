/**
 * Mail intake — import dedupe, visibility, access control.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { canViewMailIntakeItem, canViewMailIntakeTab } from '../lib/mail-intake-auth.js'
import { importMailIntakeMessage } from '../lib/mail-intake-import.js'
import { configuredMailIntakeMailboxes, isMailIntakeEnabled } from '../lib/mail-intake-config.js'
import { sanitizeInboundEmailHtml } from '../lib/sanitize-email-html.js'
import { deleteUsers, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('mail intake config', () => {
  test('disabled by default', () => {
    const prev = process.env.C2K_MAIL_INTAKE_ENABLED
    delete process.env.C2K_MAIL_INTAKE_ENABLED
    assert.equal(isMailIntakeEnabled(), false)
    if (prev) process.env.C2K_MAIL_INTAKE_ENABLED = prev
  })

  test('missing IMAP creds yields empty mailbox list', () => {
    const prev = process.env.C2K_MAIL_INTAKE_SUPPORT_USER
    delete process.env.C2K_MAIL_INTAKE_SUPPORT_USER
    delete process.env.C2K_MAIL_INTAKE_SUPPORT_PASS
    assert.equal(configuredMailIntakeMailboxes().length, 0)
    if (prev) process.env.C2K_MAIL_INTAKE_SUPPORT_USER = prev
  })
})

describe('sanitize inbound email html', () => {
  test('strips script tags', () => {
    const out = sanitizeInboundEmailHtml('<p>Hi</p><script>alert(1)</script>')
    assert.ok(!out.includes('<script'))
    assert.ok(out.includes('Hi'))
  })
})

describe('mail intake db', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let ownerId: string
  let modId: string
  let itemId: string
  const userIds: string[] = []

  before(async () => {
    ensureCiAuthSecret()
    invalidatePlatformStaffCache()
    const owner = await insertCiUser(`mailowner_${tag}`)
    const mod = await insertCiUser(`mailmod_${tag}`)
    ownerId = owner.id
    modId = mod.id
    userIds.push(ownerId, modId)
    await db.insert(schema.platformStaff).values({ userId: ownerId, role: 'OWNER_ADMIN' })
    await db.insert(schema.platformStaff).values({ userId: modId, role: 'MODERATOR' })

    const mb = {
      key: 'support' as const,
      user: `support@test-${tag}.local`,
      pass: 'secret',
      mailbox: `support@test-${tag}.local`,
      visibility: 'support' as const,
    }
    const r = await importMailIntakeMessage(mb, {
      messageId: `<msg-${tag}@example.com>`,
      fromEmail: 'sender@example.com',
      toEmail: mb.mailbox,
      subject: 'Help please',
      receivedAt: new Date(),
      plainTextBody: 'Hello',
      htmlBody: '<p>Hello</p>',
      attachmentMetadata: [{ filename: 'note.txt', size: 12 }],
    })
    assert.equal(r.imported, true)
    itemId = r.itemId!
  })

  after(async () => {
    if (itemId) {
      await db.delete(schema.mailIntakeItems).where(eq(schema.mailIntakeItems.id, itemId))
    }
    await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, ownerId))
    await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, modId))
    await deleteUsers(userIds)
    invalidatePlatformStaffCache()
  })

  test('does not duplicate same messageId', async () => {
    const mb = {
      key: 'support' as const,
      user: `support@test-${tag}.local`,
      pass: 'secret',
      mailbox: `support@test-${tag}.local`,
      visibility: 'support' as const,
    }
    const r = await importMailIntakeMessage(mb, {
      messageId: `<msg-${tag}@example.com>`,
      fromEmail: 'sender@example.com',
      toEmail: mb.mailbox,
      subject: 'Help please',
      receivedAt: new Date(),
      attachmentMetadata: [],
    })
    assert.equal(r.imported, false)
  })

  test('owner can view support tab; moderator cannot view legal', async () => {
    assert.equal(await canViewMailIntakeTab(ownerId, 'support'), true)
    assert.equal(await canViewMailIntakeTab(modId, 'legal'), false)
  })

  test('legal owner_only item blocked for moderator', async () => {
    const [legal] = await db
      .insert(schema.mailIntakeItems)
      .values({
        mailbox: `legal@test-${tag}.local`,
        messageId: `<legal-${tag}@example.com>`,
        fromEmail: 'x@example.com',
        toEmail: `legal@test-${tag}.local`,
        subject: 'Subpoena',
        receivedAt: new Date(),
        visibility: 'owner_only',
        attachmentMetadata: [],
      })
      .returning()
    assert.equal(await canViewMailIntakeItem(modId, legal!), false)
    assert.equal(await canViewMailIntakeItem(ownerId, legal!), true)
    await db.delete(schema.mailIntakeItems).where(eq(schema.mailIntakeItems.id, legal!.id))
  })
})
