import { TRUST_PILLS } from '@/components/landing/landing-content'

export default function LandingTrustPillRow() {
  return (
    <ul className="hero-trust-strip" aria-label="Community trust signals">
      {TRUST_PILLS.map((pill, index) => (
        <li key={pill.title} className="hero-trust-strip__item">
          {index > 0 ?
            <span className="hero-trust-strip__sep" aria-hidden>
              ·
            </span>
          : null}
          <span className="hero-trust-strip__title">{pill.title}</span>
          <span className="hero-trust-strip__sub">{pill.subtitle}</span>
        </li>
      ))}
    </ul>
  )
}
