import type { APIRequestContext } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025'

export function extractConfirmToken(body: string): string | null {
  const match =
    body.match(/\/email\/confirm\?token=([a-f0-9]+)/i) ?? body.match(/token=([a-f0-9]{32,})/i)
  return match?.[1] ?? null
}

export async function clearMailpit(request: APIRequestContext): Promise<void> {
  await request.delete(`${MAILPIT}/api/v1/messages`).catch(() => {})
}

export async function pollMailpitConfirmToken(
  request: APIRequestContext,
  targetEmail: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listRes = await request.get(`${MAILPIT}/api/v1/messages`)
    if (!listRes.ok()) return null
    const list = (await listRes.json()) as {
      messages?: Array<{ ID?: string; Created?: string; Subject?: string }>
    }
    const sorted = [...(list.messages ?? [])].sort(
      (a, b) => new Date(b.Created ?? 0).getTime() - new Date(a.Created ?? 0).getTime(),
    )
    for (const msg of sorted) {
      if (!msg.ID) continue
      const detailRes = await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)
      if (!detailRes.ok()) continue
      const detail = (await detailRes.json()) as {
        To?: Array<{ Address?: string }>
        Subject?: string
        Text?: string
        HTML?: string
      }
      const to = (detail.To ?? []).map((t) => t.Address ?? '').join(' ').toLowerCase()
      if (!to.includes(targetEmail.toLowerCase())) continue
      if (!/confirm/i.test(detail.Subject ?? '')) continue
      const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`
      const token = extractConfirmToken(body)
      if (token) return token
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}
