import { LANDING_SHOWCASE } from '@/components/landing/landing-beta-content'

export default function LandingPlatformShowcase() {
  return (
    <section className="beta-section beta-showcase" aria-labelledby="landing-showcase-title">
      <div className="public-container">
        <p className="beta-kicker">{LANDING_SHOWCASE.kicker}</p>
        <h2 id="landing-showcase-title" className="beta-section__title">
          {LANDING_SHOWCASE.title}
        </h2>
        <p className="beta-section__copy">{LANDING_SHOWCASE.body}</p>
        <div className="beta-window">
          <ul className="beta-tabs" aria-label="Platform areas">
            {LANDING_SHOWCASE.tabs.map((tab) => (
              <li key={tab}>{tab}</li>
            ))}
          </ul>
          <div className="beta-window__body">
            <div className="beta-feature-event">
              <span className="beta-tag">{LANDING_SHOWCASE.feature.tag}</span>
              <h3>{LANDING_SHOWCASE.feature.title}</h3>
              <p>{LANDING_SHOWCASE.feature.body}</p>
            </div>
            <div className="beta-side-stack">
              {LANDING_SHOWCASE.cards.map((card) => (
                <div key={card.title} className="beta-preview-card">
                  <span className="beta-tag">{card.tag}</span>
                  <h4>{card.title}</h4>
                  <p>{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
