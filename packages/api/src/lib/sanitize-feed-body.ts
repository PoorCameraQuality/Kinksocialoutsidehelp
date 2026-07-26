import sanitizeHtml from 'sanitize-html'

const FEED_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'h2',
    'h3',
    'span',
    'img',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    span: ['class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
    b: 'strong',
    i: 'em',
  },
}

/** Server-side allowlist HTML sanitizer for UGC feed/org content (aligned with TipTap editors). */
export function sanitizeFeedHtml(html: string): string {
  return sanitizeHtml(html, FEED_HTML_OPTIONS).slice(0, 250_000)
}
