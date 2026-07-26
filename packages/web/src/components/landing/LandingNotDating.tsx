import { LANDING_NOT_DATING } from '@/components/landing/landing-beta-content'

export default function LandingNotDating() {
  return (
    <section className="beta-section beta-statement" aria-labelledby="landing-not-dating-title">
      <div className="public-container beta-statement__grid">
        <div className="beta-big-not" aria-hidden>
          NOT
          <br />
          DATING.
        </div>
        <div>
          <p className="beta-kicker">{LANDING_NOT_DATING.kicker}</p>
          <h2 id="landing-not-dating-title" className="beta-section__title">
            {LANDING_NOT_DATING.title}
          </h2>
          <p className="beta-section__copy">{LANDING_NOT_DATING.body}</p>
          <ul className="beta-bullet-grid">
            {LANDING_NOT_DATING.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
