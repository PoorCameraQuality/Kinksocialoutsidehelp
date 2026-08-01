import { copyTextToClipboard } from '@/lib/iso-share'

export type ShareOrCopyResult = 'shared' | 'copied' | 'dismissed' | 'failed'

/**
 * Mobile-first share: prefer the system share sheet, then clipboard + legacy fallback.
 * Always call from a user gesture (tap) so iOS allows share/clipboard.
 */
export async function shareOrCopyUrl(opts: {
  url: string
  title?: string
  text?: string
}): Promise<ShareOrCopyResult> {
  const url = opts.url.trim()
  if (!url) return 'failed'

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed'
      /* continue to clipboard */
    }
  }

  const ok = await copyTextToClipboard(url)
  return ok ? 'copied' : 'failed'
}
