import { Link } from 'react-router-dom'
import {
  LANDING_FEATURE_HEADLINE,
  LANDING_FEATURE_SUBLINE,
  LANDING_SHORTCUTS,
} from '@/components/landing/landing-content'

export default function LandingFeatureShortcuts() {
  return (
    <section className="landing-shortcuts-section" aria-labelledby="landing-shortcuts-heading">
      <div className="public-container">
        <header className="landing-shortcuts-header">
          <h2 id="landing-shortcuts-heading" className="landing-shortcuts-title">
            {LANDING_FEATURE_HEADLINE}
          </h2>
          <p className="landing-shortcuts-lede">{LANDING_FEATURE_SUBLINE}</p>
        </header>

        <ul className="landing-shortcuts-grid">
          {LANDING_SHORTCUTS.map((item) => (
            <li key={item.href}>
              <Link to={item.href} className="landing-shortcut-card">
                <span className="landing-shortcut-card__title">{item.label}</span>
                <span className="landing-shortcut-card__desc">{item.description}</span>
                <span className="landing-shortcut-card__link">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
