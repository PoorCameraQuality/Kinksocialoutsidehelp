export type ParsedRssEpisode = {
  guid: string
  title: string
  description: string | null
  publishedAt: Date | null
  externalAudioUrl: string | null
  link: string | null
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m?.[1] ? decodeXmlEntities(m[1].trim()) : null
}

function attrHref(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*url=["']([^"']+)["']`, 'i')
  return block.match(re)?.[1] ?? null
}

export function parseRssEpisodes(xml: string, maxItems = 50): ParsedRssEpisode[] {
  const items: ParsedRssEpisode[] = []
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1]!
    const title = tagContent(block, 'title') ?? 'Episode'
    const guid = tagContent(block, 'guid') ?? tagContent(block, 'link') ?? title
    const pubRaw = tagContent(block, 'pubDate')
    const publishedAt = pubRaw ? new Date(pubRaw) : null
    const enclosure = block.match(/<enclosure[^>]*url=["']([^"']+)["']/i)?.[1] ?? null
    const link = tagContent(block, 'link')
    items.push({
      guid: guid.slice(0, 500),
      title: title.slice(0, 512),
      description: tagContent(block, 'description')?.slice(0, 8000) ?? null,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      externalAudioUrl: enclosure,
      link,
    })
  }
  return items
}
