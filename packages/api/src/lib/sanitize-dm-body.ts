import sanitizeHtml from 'sanitize-html'

const DM_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'h2',
    'h3',
    'h4',
    'span',
    'img',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    span: ['class'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer', target: '_blank' }),
  },
}

/** Server-side allowlist HTML for rich DM / organizer campaign messages. */
export function sanitizeDmHtml(html: string): string {
  return sanitizeHtml(html, DM_HTML_OPTIONS).slice(0, 250_000)
}

export function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body)
}
