import { Link } from 'react-router-dom'
import { LANDING_PRODUCT_PREVIEW_ITEMS } from '@/components/landing/landing-content'

export default function LandingProductPreview() {
  return (
    <section className="landing-capabilities-section" aria-labelledby="landing-preview-heading">
      <div className="public-container">
        <header className="landing-capabilities-header">
          <h2 id="landing-preview-heading" className="landing-capabilities-title">
            See the platform in action
          </h2>
          <p className="landing-capabilities-lede">
            Events, groups, education, and organizer workflows — one account, one place to belong.
          </p>
        </header>

        <ul className="landing-capabilities-list">
          {LANDING_PRODUCT_PREVIEW_ITEMS.map((item) => (
            <li key={item.id}>
              <Link to={item.href} className="landing-capability">
                <h3 className="landing-capability__title">{item.title}</h3>
                <p className="landing-capability__desc">{item.description}</p>
                <span className="landing-capability__link">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
