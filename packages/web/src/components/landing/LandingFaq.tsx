import { LANDING_FAQ_ITEMS } from '@/components/landing/landing-beta-content'

export default function LandingFaq() {
  return (
    <section id="faq" className="beta-section" aria-labelledby="landing-faq-title">
      <div className="public-container beta-faq">
        <p className="beta-kicker">Common questions</p>
        <h2 id="landing-faq-title" className="beta-section__title">
          What is Kink Social?
        </h2>
        {LANDING_FAQ_ITEMS.map((item) => (
          <article key={item.question} className="beta-faq__item">
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
