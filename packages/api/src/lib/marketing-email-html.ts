/**
 * Inbox-safe marketing HTML wrappers for organizer campaigns.
 * Prefer table layout + inline styles; no scripts/external CSS.
 */

const ALLOWED_TAGS =
  /<\/?(?:p|br|div|span|strong|b|em|i|u|a|ul|ol|li|h2|h3|h4|img|hr|blockquote|table|tr|td|th|thead|tbody)(\s[^>]*)?>/gi

export function stripToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function publicWebOrigin(): string {
  const raw =
    process.env.C2K_PUBLIC_WEB_URL?.trim() ||
    process.env.C2K_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    'https://kink.social'
  return raw.replace(/\/+$/, '')
}

/** Rewrite root-relative media URLs so inbox clients can load images. */
export function absolutizeMarketingHtmlUrls(html: string, origin = publicWebOrigin()): string {
  return html.replace(
    /(\s(?:src|href)=["'])(\/(?:c2k-uploads|api\/v1\/media)[^"']*)(["'])/gi,
    (_m, pre: string, path: string, post: string) => `${pre}${origin}${path}${post}`,
  )
}

/** Very small sanitizer: drop script/style/iframe and unknown tags; keep href/src on a/img. */
export function sanitizeMarketingBodyHtml(html: string): string {
  let out = absolutizeMarketingHtmlUrls(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // Strip tags not in allowlist by replacing disallowed open/close tags with empty
  out = out.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string) => {
    const t = tag.toLowerCase()
    const allowed = [
      'p',
      'br',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'h2',
      'h3',
      'h4',
      'img',
      'hr',
      'blockquote',
    ]
    if (!allowed.includes(t)) return ''
    if (t === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(full)
      const url = (href?.[2] ?? href?.[3] ?? '').trim()
      if (!/^https?:\/\//i.test(url)) return ''
      return `<a href="${url}" style="color:#6d28d9;text-decoration:underline;">`
    }
    if (t === 'img') {
      const src = /src\s*=\s*("([^"]*)"|'([^']*)')/i.exec(full)
      const url = (src?.[2] ?? src?.[3] ?? '').trim()
      if (!/^https?:\/\//i.test(url)) return ''
      const altMatch = /alt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(full)
      const alt = (altMatch?.[2] ?? altMatch?.[3] ?? '').replace(/[<>"]/g, '')
      return `<img src="${url}" alt="${alt}" width="560" style="display:block;max-width:100%;height:auto;border:0;margin:12px 0;" />`
    }
    if (t === 'br') return '<br />'
    if (t === 'p') return full.startsWith('</') ? '</p>' : '<p style="margin:0 0 12px;line-height:1.5;color:#1f2937;">'
    if (t === 'h2')
      return full.startsWith('</') ? '</h2>' : '<h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">'
    if (t === 'h3')
      return full.startsWith('</') ? '</h3>' : '<h3 style="margin:0 0 10px;font-size:17px;line-height:1.3;color:#111827;">'
    if (t === 'ul') return full.startsWith('</') ? '</ul>' : '<ul style="margin:0 0 12px;padding-left:20px;color:#1f2937;">'
    if (t === 'ol') return full.startsWith('</') ? '</ol>' : '<ol style="margin:0 0 12px;padding-left:20px;color:#1f2937;">'
    if (t === 'li') return full.startsWith('</') ? '</li>' : '<li style="margin:0 0 6px;">'
    return full.startsWith('</') ? `</${t}>` : `<${t}>`
  })
  // Drop leftover ALLOWED_TAGS noise unused
  void ALLOWED_TAGS
  return out.trim() || '<p style="margin:0 0 12px;line-height:1.5;color:#1f2937;">(empty message)</p>'
}

export function wrapMarketingCampaignEmail(input: {
  subject: string
  bodyHtml: string
  orgOrEventName: string
  preheader?: string
}): { html: string; text: string } {
  const body = sanitizeMarketingBodyHtml(input.bodyHtml)
  const text = stripToPlainText(body)
  const preheader = (input.preheader ?? text).slice(0, 140)
  const brand = input.orgOrEventName.trim() || 'kink.social'
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeAttr(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:#111827;color:#ffffff;font-family:Georgia,serif;font-size:18px;">
            ${escapeAttr(brand)}
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1f2937;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#6b7280;border-top:1px solid #e5e7eb;">
            Sent via kink.social for ${escapeAttr(brand)}. You received this because you marked going or interested for this event.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
  return { html, text }
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
