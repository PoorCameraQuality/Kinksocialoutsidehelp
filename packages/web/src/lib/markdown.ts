import MarkdownIt from 'markdown-it'

const profileMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const defaultLinkOpen =
  profileMarkdown.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

profileMarkdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderProfileMarkdown(markdown: string): string {
  const trimmed = markdown.trim()
  if (!trimmed) return ''
  return profileMarkdown.render(trimmed)
}
