import { Link } from 'react-router-dom'
import { LANDING_FINAL_CTA_HEADLINE } from '@/components/landing/landing-content'

export default function LandingFinalCta() {
  return (
    <section className="landing-final-cta" aria-labelledby="landing-final-cta-heading">
      <div className="public-container landing-final-cta__inner">
        <h2 id="landing-final-cta-heading" className="landing-final-cta__title">
          {LANDING_FINAL_CTA_HEADLINE}
        </h2>
        <div className="hero-actions landing-final-cta__actions">
          <Link to="/#auth" className="pub-primary-cta">
            Join free
          </Link>
          <Link to="/events" className="pub-secondary-cta">
            Explore events
          </Link>
        </div>
      </div>
    </section>
  )
}
