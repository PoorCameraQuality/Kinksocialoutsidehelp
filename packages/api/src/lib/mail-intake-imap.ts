import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import type { ParsedInboundMail } from './mail-intake-import.js'
import { stripHeaderInjection } from './mail-safety.js'

function firstAddress(
  addr: ParsedMail['from'] | ParsedMail['to'],
): { name?: string; address?: string } | undefined {
  if (!addr) return undefined
  if (Array.isArray(addr)) {
    for (const block of addr) {
      const v = block.value?.[0]
      if (v) return v
    }
    return undefined
  }
  return addr.value?.[0]
}

function mapParsedMail(parsed: ParsedMail, fallbackTo: string): ParsedInboundMail {
  const from = firstAddress(parsed.from)
  const to = firstAddress(parsed.to)
  const messageId = parsed.messageId ?? `${Date.now()}-${Math.random()}`
  const attachments = (parsed.attachments ?? []).map((a: { filename?: string; contentType?: string; size?: number }) => ({
    filename: a.filename ?? 'attachment',
    contentType: a.contentType,
    size: a.size,
  }))

  return {
    messageId: stripHeaderInjection(messageId, 512),
    threadKey: parsed.inReplyTo ? stripHeaderInjection(String(parsed.inReplyTo), 512) : undefined,
    fromName: from?.name ? stripHeaderInjection(from.name, 255) : undefined,
    fromEmail: stripHeaderInjection(from?.address ?? 'unknown@invalid', 320),
    toEmail: stripHeaderInjection(to?.address ?? fallbackTo, 320),
    subject: stripHeaderInjection(parsed.subject ?? '(no subject)', 512),
    receivedAt: parsed.date ?? new Date(),
    plainTextBody: parsed.text ?? undefined,
    htmlBody: parsed.html ? String(parsed.html) : undefined,
    attachmentMetadata: attachments,
  }
}

export async function fetchUnreadMessagesForMailbox(input: {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}): Promise<ParsedInboundMail[]> {
  const client = new ImapFlow({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.pass },
    logger: false,
  })

  const out: ParsedInboundMail[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        if (!msg.source) continue
        const parsed = await simpleParser(msg.source)
        out.push(mapParsedMail(parsed, input.user))
        try {
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
        } catch {
          /* mark seen best-effort; never delete */
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }

  return out
}
