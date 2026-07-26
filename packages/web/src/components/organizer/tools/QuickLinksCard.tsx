import { Link } from 'react-router-dom'
import { ToolsSection } from '@/components/organizer/tools/tools-ui'

type LinkItem = {
  href: string
  title: string
  description: string
}

type Props = {
  links: LinkItem[]
}

export default function QuickLinksCard({ links }: Props) {
  return (
    <ToolsSection>
      <h3 className="text-lg font-semibold text-dc-text">Quick links</h3>
      <p className="mt-1 text-sm text-dc-text-muted">Jump to the organizer workspaces you use most.</p>
      <ul className="mt-4 space-y-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              to={item.href}
              className="flex min-h-12 flex-col justify-center rounded-xl border border-dc-border bg-dc-surface/30 px-4 py-3 hover:border-dc-accent-border/30 hover:bg-dc-accent/5"
            >
              <span className="text-sm font-medium text-dc-text">{item.title}</span>
              <span className="text-xs text-dc-text-muted">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ToolsSection>
  )
}
