import { Link } from 'react-router-dom'

import { FEATURE_PILLARS } from '@/components/landing/landing-content'



type Props = {

  className?: string

}



function DesktopFeatureCard({

  title,

  description,

  href,

  linkLabel,

  featureRgb,

  accentColor,

  icon,

}: (typeof FEATURE_PILLARS)[number]) {

  return (

    <Link

      to={href}

      className="feature-card pub-animate"

      style={{ ['--feature-rgb' as string]: featureRgb }}

    >

      <span className="feature-icon" style={{ color: accentColor }}>

        {icon}

      </span>

      <h3 className="text-base font-bold text-[var(--pub-text)]">{title}</h3>

      <p className="mt-2 text-sm leading-relaxed text-[var(--pub-text-muted)]">{description}</p>

      <span className="feature-link">{linkLabel}</span>

    </Link>

  )

}



function MobileFeatureCard({

  title,

  mobileDescription,

  href,

  featureRgb,

  accentColor,

  icon,

}: (typeof FEATURE_PILLARS)[number]) {

  return (

    <Link

      to={href}

      className="mobile-feature-card"

      style={{ ['--feature-rgb' as string]: featureRgb }}

    >

      <span

        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"

        style={{ color: accentColor }}

      >

        {icon}

      </span>

      <span>

        <span className="block text-sm font-bold text-[var(--pub-text)]">{title}</span>

        <span className="mt-0.5 block text-xs text-[var(--pub-text-muted)]">{mobileDescription}</span>

      </span>

      <span className="text-[var(--pub-text-soft)]" aria-hidden>

        ›

      </span>

    </Link>

  )

}



export default function LandingValuePillars({ className = '' }: Props) {

  return (

    <section className={`feature-section ${className}`} aria-labelledby="landing-pillars-heading">

      <div className="public-container">

        <h2 id="landing-pillars-heading" className="mb-6 text-2xl font-bold text-[var(--pub-text)] lg:text-3xl">

          What you can do here

        </h2>



        <div className="feature-grid feature-grid-desktop">
          {FEATURE_PILLARS.map((item, i) => {
            const delayClass =
              i === 1 ? 'pub-animate-delay-1'
              : i === 2 ? 'pub-animate-delay-2'
              : i === 3 ? 'pub-animate-delay-3'
              : 'pub-animate'
            return (
              <div key={item.title} className={delayClass}>
                <DesktopFeatureCard {...item} />
              </div>
            )
          })}
        </div>



        <div className="feature-list-mobile">

          {FEATURE_PILLARS.map((item) => (

            <MobileFeatureCard key={item.title} {...item} />

          ))}

        </div>

      </div>

    </section>

  )

}

