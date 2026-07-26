import sanitizeHtml from 'sanitize-html'

const EMAIL_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'h2', 'h3', 'span', 'div'],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    span: ['class'],
    div: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
  },
}

export function sanitizeInboundEmailHtml(html: string): string {
  return sanitizeHtml(html, EMAIL_HTML_OPTIONS).slice(0, 250_000)
}
