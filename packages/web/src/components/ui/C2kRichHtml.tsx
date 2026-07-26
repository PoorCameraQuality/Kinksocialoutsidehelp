import { cn } from '@/lib/cn'

/** Shared prose classes for server-sanitized TipTap / feed / org / education HTML. */
export const C2K_RICH_HTML_CLASS =
  'c2k-rich-html prose prose-invert max-w-none prose-headings:text-dc-text prose-p:text-dc-text-muted prose-li:text-dc-text-muted prose-a:text-dc-accent prose-strong:text-dc-text prose-blockquote:border-dc-border prose-blockquote:text-dc-text-muted'

type Props = {
  html: string
  className?: string
  as?: 'div' | 'article' | 'section'
}

/**
 * Renders trusted, server-sanitized HTML with consistent formatting styles
 * (headings, lists, links, images). Do not pass unsanitized user HTML.
 */
export default function C2kRichHtml({ html, className, as: Tag = 'div' }: Props) {
  if (!html.trim()) return null
  return (
    <Tag
      className={cn(C2K_RICH_HTML_CLASS, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
