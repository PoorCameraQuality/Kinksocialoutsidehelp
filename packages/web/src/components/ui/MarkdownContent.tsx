import { useMemo, type ReactNode } from 'react'
import { renderProfileMarkdown } from '@/lib/markdown'

const PROSE_CLASS =
  'prose prose-invert prose-sm max-w-none text-dc-text-muted leading-relaxed [&_a]:text-dc-accent [&_h2]:text-dc-text [&_h3]:text-dc-text [&_strong]:text-dc-text [&_hr]:border-dc-border'

type Props = {
  markdown: string
  className?: string
  emptyFallback?: ReactNode
}

export default function MarkdownContent({ markdown, className = '', emptyFallback = null }: Props) {
  const html = useMemo(() => renderProfileMarkdown(markdown), [markdown])

  if (!markdown.trim()) {
    return emptyFallback ? <>{emptyFallback}</> : null
  }

  return (
    <div
      className={`${PROSE_CLASS} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
