import { Link } from 'react-router-dom'

import { POLICY_CATEGORIES, POLICY_REGISTRY, policiesByCategory } from '@/config/policy-registry'



const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'



const MOBILE_JUMP_LABELS: Record<string, string> = {

  core: 'Agreements',

  safety: 'Safety',

  legal: 'Legal',

  community: 'Community',

  organizer: 'Organizers',

}



export default function PoliciesIndexPage() {

  return (

    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

      {!legalPublished ?

        <div

          className="mb-6 rounded-xl border border-dc-border bg-dc-elevated-muted/60 px-4 py-3 text-sm text-dc-text-muted"

          role="status"

        >

          <span className="font-medium text-dc-text">Draft policies.</span> Counsel review is in progress. Wording may

          change before public launch.

        </div>

      : null}



      <header className="mb-6 sm:mb-8">

        <h1 className="mb-3 text-3xl font-bold text-dc-text">Policy Hub</h1>

        <p className="max-w-2xl text-sm leading-relaxed text-dc-muted">

          Kink Social is an adults-only, organizer-first community operating system. These policies explain how we

          expect members, moderators, and event organizers to participate. We use human moderation, privacy-first

          defaults, and no explicit media in beta.

        </p>

      </header>



      <nav

        className="mb-6 flex gap-2 overflow-x-auto pb-1 c2k-no-scrollbar md:hidden"

        aria-label="Policy categories"

      >

        {POLICY_CATEGORIES.map((cat) => {

          const entries = policiesByCategory(cat.id)

          if (!entries.length) return null

          return (

            <a

              key={cat.id}

              href={`#policy-cat-${cat.id}`}

              className="shrink-0 rounded-full border border-dc-border bg-dc-elevated-solid px-3 py-1.5 text-xs font-medium text-dc-text-muted hover:text-dc-text"

            >

              {MOBILE_JUMP_LABELS[cat.id] ?? cat.label}

            </a>

          )

        })}

      </nav>



      <div className="space-y-8 sm:space-y-10">

        {POLICY_CATEGORIES.map((cat) => {

          const entries = policiesByCategory(cat.id)

          if (!entries.length) return null

          return (

            <section key={cat.id} id={`policy-cat-${cat.id}`} aria-labelledby={`policy-cat-heading-${cat.id}`}>

              <h2 id={`policy-cat-heading-${cat.id}`} className="mb-3 text-lg font-semibold text-dc-text sm:mb-4">

                {cat.label}

              </h2>

              <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3">

                {entries.map((entry) => (

                  <li key={entry.slug}>

                    <Link

                      to={entry.href}

                      className="block rounded-xl border border-dc-border bg-dc-elevated/95 p-3 shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent/40 hover:bg-dc-elevated sm:p-4"

                    >

                      <span className="font-medium text-dc-text">{entry.title}</span>

                      <p className="mt-1 text-sm leading-relaxed text-dc-text-muted">{entry.description}</p>

                    </Link>

                  </li>

                ))}

              </ul>

            </section>

          )

        })}

      </div>



      <p className="mt-10 text-xs text-dc-muted">

        {POLICY_REGISTRY.length} policies · Need help? Visit{' '}

        <Link to="/support" className="text-dc-accent hover:underline">

          Support

        </Link>{' '}

        or{' '}

        <Link to="/contact" className="text-dc-accent hover:underline">

          Contact

        </Link>

        .

      </p>

    </div>

  )

}


