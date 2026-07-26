import { Link } from 'react-router-dom'
import {
  LANDING_18_PLUS,
  LANDING_ALPHA_BADGE,
  LANDING_ALPHA_DISCLAIMER,
  LANDING_ALPHA_FRAMING,
  LANDING_CTA_EVENTS,
  LANDING_CTA_GROUPS,
  LANDING_CTA_JOIN,
  LANDING_CTA_PRIVACY,
  LANDING_VALUE_BODY,
  LANDING_VALUE_HEADLINE,
} from '@/lib/alpha-activation-copy'

export default function LandingAuthIntro() {
  return (
    <div className="landing-auth-intro pub-animate">
      <p className="landing-auth-intro__eyebrow">{LANDING_ALPHA_BADGE} · {LANDING_18_PLUS}</p>
      <h1 className="landing-auth-intro__headline">{LANDING_VALUE_HEADLINE}</h1>
      <p className="landing-auth-intro__body">{LANDING_ALPHA_FRAMING}</p>
      <p className="landing-auth-intro__sub">{LANDING_VALUE_BODY}</p>
      <nav className="landing-auth-intro__actions" aria-label="Get started">
        <a href="#auth" className="pub-primary-cta landing-auth-intro__cta">
          {LANDING_CTA_JOIN}
        </a>
        <Link to="/events" className="pub-secondary-cta landing-auth-intro__cta">
          {LANDING_CTA_EVENTS}
        </Link>
        <Link to="/groups" className="pub-secondary-cta landing-auth-intro__cta">
          {LANDING_CTA_GROUPS}
        </Link>
        <Link to="/privacy" className="pub-tertiary-cta">
          {LANDING_CTA_PRIVACY}
        </Link>
      </nav>
      <p className="landing-auth-intro__alpha-note" role="note">
        {LANDING_ALPHA_DISCLAIMER}
      </p>
    </div>
  )
}
