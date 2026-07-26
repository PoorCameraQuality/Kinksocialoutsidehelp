import sanitizeHtml from 'sanitize-html'

const ALLOWED_IFRAME_SRC =
  /^(https?:\/\/(?:www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]+(?:\?[^"']*)?|https?:\/\/player\.vimeo\.com\/video\/\d+(?:\?[^"']*)?)$/i

const EDUCATION_HTML_OPTIONS: sanitizeHtml.IOptions = {
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
    'pre',
    'code',
    'hr',
    'a',
    'h2',
    'h3',
    'h4',
    'span',
    'img',
    'iframe',
    'figure',
    'figcaption',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    span: ['class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'allowfullscreen', 'loading', 'title', 'allow'],
    code: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
    b: 'strong',
    i: 'em',
    iframe: (_tagName, attribs) => {
      const src = (attribs.src ?? '').trim()
      return {
        tagName: 'iframe',
        attribs: {
          src,
          allowfullscreen: 'true',
          loading: 'lazy',
        },
      }
    },
  },
  exclusiveFilter(frame) {
    if (frame.tag !== 'iframe') return false
    return !ALLOWED_IFRAME_SRC.test((frame.attribs?.src ?? '').trim())
  },
}

/** Sanitize educator article HTML — TipTap formatting + safe YouTube/Vimeo embeds. */
export function sanitizeEducationHtml(html: string): string {
  return sanitizeHtml(html, EDUCATION_HTML_OPTIONS).slice(0, 500_000)
}

export function estimateReadingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  return Math.max(1, Math.ceil(words / 200))
}
