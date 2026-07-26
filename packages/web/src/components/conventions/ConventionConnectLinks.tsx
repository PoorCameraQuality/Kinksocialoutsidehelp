import type { ConventionOfficialLink } from '@/lib/convention-description'

type Props = {
  links: ConventionOfficialLink[]
}

/** Editorial connect list (ECKE overview style): label + accent URL. */
export default function ConventionConnectLinks({ links }: Props) {
  if (!links.length) return null

  return (
    <section aria-labelledby="convention-connect-heading" className="space-y-4">
      <h2 id="convention-connect-heading" className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">
        Connect
      </h2>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={`${link.kind}:${link.href}`} className="min-w-0">
            <p className="text-sm font-semibold text-dc-text">{link.label}</p>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 break-all text-sm font-medium text-dc-accent underline decoration-dc-accent/35 underline-offset-2 hover:decoration-dc-accent"
            >
              {link.href.replace(/^https?:\/\//i, '')}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
