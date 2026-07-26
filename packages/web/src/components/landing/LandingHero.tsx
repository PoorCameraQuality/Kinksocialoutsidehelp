import { Link } from 'react-router-dom'
import {
  LANDING_CTA_PRIMARY,
  LANDING_CTA_SECONDARY,
  LANDING_HERO_EYEBROW,
  LANDING_HERO_HEADLINE,
  LANDING_HERO_HEADLINE_ACCENT,
  LANDING_HERO_LEDE,
  LANDING_TRUST_LINE,
} from '@/components/landing/landing-beta-content'

export default function LandingHero() {
  return (
    <header className="beta-hero">
      <div className="public-container beta-hero__grid">
        <div>
          <p className="beta-eyebrow">
            <span className="beta-eyebrow__dot" aria-hidden />
            {LANDING_HERO_EYEBROW}
          </p>
          <h1>
            {LANDING_HERO_HEADLINE}
            <br />
            <span className="beta-hero__accent">{LANDING_HERO_HEADLINE_ACCENT}</span>
          </h1>
          <p className="beta-hero__lede">{LANDING_HERO_LEDE}</p>
          <div className="beta-hero__actions">
            <a href="#join" className="beta-btn beta-btn--primary">
              {LANDING_CTA_PRIMARY}
            </a>
            <Link to="/events" className="beta-btn beta-btn--secondary">
              {LANDING_CTA_SECONDARY}
            </Link>
          </div>
          <ul className="beta-trustline" aria-label="Community values">
            {LANDING_TRUST_LINE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="beta-stage" aria-hidden>
          <div className="beta-stage__glow" />
          <div className="beta-device">
            <div className="beta-device__bar">
              <div>
                kink<span>.social</span>
              </div>
            </div>
            <div className="beta-device__body">
              <div className="beta-device__sidebar">
                <div className="beta-sideitem beta-sideitem--active" />
                <div className="beta-sideitem" />
                <div className="beta-sideitem" />
                <div className="beta-sideitem" />
                <div className="beta-sideitem" />
              </div>
              <div className="beta-device__content">
                <div className="beta-cardgrid">
                  <div className="beta-event-card">
                    <div className="beta-event-card__pic" />
                    <span className="beta-tag">Community event</span>
                    <h3>Summer community weekend</h3>
                    <p>Workshops, socials, vendors, and shared experiences</p>
                  </div>
                  <div className="beta-small-card">
                    <span className="beta-tag">Education</span>
                    <h3>Consent in practice</h3>
                    <p>A practical workshop series</p>
                  </div>
                  <div className="beta-small-card">
                    <span className="beta-tag">Local group</span>
                    <h3>Central PA community</h3>
                    <p>Discussion · Events · Resources</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="beta-float beta-float--one">
            <small>Organizer tools</small>
            <b>Schedule, staff, applications, check-in</b>
            <div className="beta-float__bar" />
          </div>
          <div className="beta-float beta-float--two">
            <small>Your visibility, your choice</small>
            <b>Profile controls, blocking, and reporting</b>
          </div>
        </div>
      </div>
    </header>
  )
}
