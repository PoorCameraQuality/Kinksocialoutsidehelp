import { Link } from 'react-router-dom'
import { LANDING_SAFETY_BETA } from '@/components/landing/landing-beta-content'

export default function LandingSafetyBetaSection() {
  return (
    <section id="safety" className="beta-section" aria-labelledby="landing-safety-title">
      <div className="public-container">
        <p className="beta-kicker">{LANDING_SAFETY_BETA.kicker}</p>
        <h2 id="landing-safety-title" className="beta-section__title">
          {LANDING_SAFETY_BETA.title}
        </h2>
        <p className="beta-section__copy">{LANDING_SAFETY_BETA.body}</p>
        <div className="beta-safetygrid">
          {LANDING_SAFETY_BETA.cards.map((card) => (
            <div key={card.title} className="beta-safetycard">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-[var(--beta-muted)]">
          <Link to="/guidelines" className="underline decoration-[var(--beta-rose)] underline-offset-4">
            Read community guidelines
          </Link>
          {' · '}
          <Link to="/privacy" className="underline decoration-[var(--beta-rose)] underline-offset-4">
            Privacy policy
          </Link>
        </p>
      </div>
    </section>
  )
}
