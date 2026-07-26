import { db, schema } from '../db/index.js'
import type { MailIntakeMailboxConfig } from './mail-intake-config.js'
import { notifyMailIntakeImported } from './mail-intake-notify.js'
import { sanitizeEmailSubject, sanitizeDisplayName, stripHeaderInjection } from './mail-safety.js'
import { sanitizeInboundEmailHtml } from './sanitize-email-html.js'

export type ParsedInboundMail = {
  messageId: string
  threadKey?: string
  fromName?: string
  fromEmail: string
  toEmail: string
  subject: string
  receivedAt: Date
  plainTextBody?: string
  htmlBody?: string
  attachmentMetadata: Array<{ filename: string; contentType?: string; size?: number }>
}

export async function importMailIntakeMessage(
  mailbox: MailIntakeMailboxConfig,
  parsed: ParsedInboundMail,
): Promise<{ imported: boolean; itemId?: string }> {
  const messageId = stripHeaderInjection(parsed.messageId, 512)
  if (!messageId) return { imported: false }

  const sanitizedHtml = parsed.htmlBody ? sanitizeInboundEmailHtml(parsed.htmlBody) : null
  const plainText = parsed.plainTextBody ? stripHeaderInjection(parsed.plainTextBody, 500_000) : null

  try {
    const [row] = await db
      .insert(schema.mailIntakeItems)
      .values({
        mailbox: mailbox.mailbox,
        messageId,
        threadKey: parsed.threadKey ? stripHeaderInjection(parsed.threadKey, 512) : null,
        fromName: parsed.fromName ? sanitizeDisplayName(parsed.fromName) : null,
        fromEmail: stripHeaderInjection(parsed.fromEmail, 320),
        toEmail: stripHeaderInjection(parsed.toEmail, 320),
        subject: sanitizeEmailSubject(parsed.subject || '(no subject)'),
        receivedAt: parsed.receivedAt,
        plainTextBody: plainText,
        sanitizedHtmlBody: sanitizedHtml,
        attachmentMetadata: parsed.attachmentMetadata.map((a) => ({
          filename: stripHeaderInjection(a.filename, 255),
          contentType: a.contentType ? stripHeaderInjection(a.contentType, 128) : undefined,
          size: typeof a.size === 'number' ? a.size : undefined,
        })),
        visibility: mailbox.visibility,
        status: 'new',
        priority: 'normal',
      })
      .onConflictDoNothing({
        target: [schema.mailIntakeItems.mailbox, schema.mailIntakeItems.messageId],
      })
      .returning()

    if (!row) return { imported: false }

    await notifyMailIntakeImported({ mailboxKey: mailbox.key, itemId: row.id })
    return { imported: true, itemId: row.id }
  } catch {
    return { imported: false }
  }
}

export async function runMailIntakeImportSweep(log: Pick<Console, 'info' | 'warn'> = console): Promise<{
  scanned: number
  imported: number
}> {
  const { configuredMailIntakeMailboxes, isMailIntakeEnabled, mailIntakeImapHost, mailIntakeImapPort, mailIntakeImapSecure } =
    await import('./mail-intake-config.js')

  if (!isMailIntakeEnabled()) {
    return { scanned: 0, imported: 0 }
  }

  const mailboxes = configuredMailIntakeMailboxes()
  if (mailboxes.length === 0) {
    log.warn('[mail-intake] enabled but no mailbox credentials configured')
    return { scanned: 0, imported: 0 }
  }

  let scanned = 0
  let imported = 0

  try {
    const { fetchUnreadMessagesForMailbox } = await import('./mail-intake-imap.js')
    for (const mb of mailboxes) {
      const messages = await fetchUnreadMessagesForMailbox({
        host: mailIntakeImapHost(),
        port: mailIntakeImapPort(),
        secure: mailIntakeImapSecure(),
        user: mb.user,
        pass: mb.pass,
      })
      scanned += messages.length
      for (const msg of messages) {
        const r = await importMailIntakeMessage(mb, msg)
        if (r.imported) imported += 1
      }
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, '[mail-intake] sweep failed')
  }

  if (imported > 0) {
    log.info(`[mail-intake] imported ${imported} message(s)`)
  }

  return { scanned, imported }
}
