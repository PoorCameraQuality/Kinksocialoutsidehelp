import { Link } from 'react-router-dom'
import {
  LANDING_18_PLUS,
  LANDING_ALPHA_BADGE,
  LANDING_ALPHA_DISCLAIMER,
  LANDING_ALPHA_FRAMING,
  LANDING_CTA_EVENTS,
  LANDING_CTA_GROUPS,
  LANDING_CTA_PRIVACY,
  LANDING_VALUE_HEADLINE,
} from '@/lib/alpha-activation-copy'
import { LANDING_BASIC_TRUST, LANDING_SIDE_HERO_FEATURES } from '@/components/landing/landing-content'

export default function LandingSideHero() {
  return (
    <div className="landing-side-hero">
      <div className="landing-side-hero__backdrop" aria-hidden />

      <div className="landing-side-hero__inner pub-animate">
        <p className="landing-side-hero__eyebrow">
          {LANDING_ALPHA_BADGE} · {LANDING_18_PLUS}
        </p>
        <h2 className="landing-side-hero__headline">{LANDING_VALUE_HEADLINE}</h2>
        <p className="landing-side-hero__lede">{LANDING_ALPHA_FRAMING}</p>
        <nav className="landing-side-hero__cta-row" aria-label="Explore before joining">
          <Link to="/events" className="pub-secondary-cta landing-side-hero__cta">
            {LANDING_CTA_EVENTS}
          </Link>
          <Link to="/groups" className="pub-secondary-cta landing-side-hero__cta">
            {LANDING_CTA_GROUPS}
          </Link>
          <Link to="/privacy" className="pub-tertiary-cta">
            {LANDING_CTA_PRIVACY}
          </Link>
        </nav>
        <p className="landing-side-hero__alpha-note" role="note">
          {LANDING_ALPHA_DISCLAIMER}
        </p>

        <nav className="landing-side-hero__nav" aria-label="Explore the platform">
          <ul className="landing-side-hero__links">
            {LANDING_SIDE_HERO_FEATURES.map((item) => (
              <li key={item.label}>
                <Link to={item.href} className="landing-side-hero__link">
                  <span className="landing-side-hero__link-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="landing-side-hero__trust" aria-label="Community values">
          {LANDING_BASIC_TRUST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
