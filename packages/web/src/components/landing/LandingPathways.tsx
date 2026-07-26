import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LANDING_PATHWAYS } from '@/components/landing/landing-beta-content'

export default function LandingPathways() {
  return (
    <section id="discover" className="beta-section" aria-labelledby="landing-pathways-title">
      <div className="public-container">
        <p className="beta-kicker">{LANDING_PATHWAYS.kicker}</p>
        <h2 id="landing-pathways-title" className="beta-section__title">
          {LANDING_PATHWAYS.title}
        </h2>
        <p className="beta-section__copy">{LANDING_PATHWAYS.body}</p>
        <div className="beta-pathgrid">
          {LANDING_PATHWAYS.items.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="beta-path"
              style={{ '--path-halo': item.halo } as CSSProperties}
            >
              <div className="beta-path__icon" aria-hidden>
                {item.icon}
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <span className="beta-path__arrow" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
