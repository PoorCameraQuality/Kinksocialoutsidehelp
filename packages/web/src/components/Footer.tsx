import { Link } from 'react-router-dom'
import { ECKE_KINK_SOCIAL_EXPLAINER_PATH, ECKE_URL } from '@c2k/shared'
import { siteConfig } from '@/config/site.config'

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section aria-labelledby={title.toLowerCase().replace(/\s+/g, '-')}>
    <h3
      id={title.toLowerCase().replace(/\s+/g, '-')}
      className="text-dc-micro uppercase tracking-wide text-dc-muted mb-3"
    >
      {title}
    </h3>
    <ul className="space-y-2">{children}</ul>
  </section>
)

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <li>
    <Link
      to={href}
      className="text-dc-text-muted hover:text-dc-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent rounded"
    >
      {children}
    </Link>
  </li>
)

export default function Footer() {
  return (
    <footer className="border-t border-dc-border-subtle bg-dc-surface-muted">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-dc-accent font-bold text-lg">{siteConfig.name}</span>
            </div>
            <p className="text-sm text-dc-text-muted max-w-prose">
              {siteConfig.tagline} {siteConfig.description}
            </p>
          </div>

          <nav className="md:col-span-8 grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Footer">
            <Section title="Advanced search">
              {siteConfig.footer.directory.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </Section>
            <Section title="Community">
              {siteConfig.navPublic.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
              {siteConfig.footer.community.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </Section>
            <Section title="Legal">
              {siteConfig.footer.legal.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </Section>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-dc-border-subtle flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-dc-muted">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <li>
              <a
                href={`${ECKE_URL}${ECKE_KINK_SOCIAL_EXPLAINER_PATH}`}
                className="text-dc-muted hover:text-dc-text-muted"
                rel="noopener noreferrer"
              >
                Public event directory
              </a>
            </li>
            <li>
              <Link to="/accessibility" className="text-dc-muted hover:text-dc-text-muted">
                Accessibility
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
