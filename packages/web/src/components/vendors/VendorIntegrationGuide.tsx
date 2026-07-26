import { Link } from 'react-router-dom'

type Props = {
  shopSlug?: string | null
  compact?: boolean
}

const ROWS = [
  {
    surface: 'Event pages',
    how: 'Org or event staff add your shop as a contributor on the event.',
    action: 'Share your shop slug with the host and ask them to list you under Partners.',
  },
  {
    surface: 'Convention Partners strip',
    how: 'Same contributor list on the convention anchor event.',
    action: 'Register for the con and coordinate with the organizer team.',
  },
  {
    surface: 'Home & discovery rails',
    how: 'Spotlight rails pull from published shops with curated or synced listings.',
    action: 'Publish your shop and add curated products (or CSV). Optional: sync with your own store API keys.',
  },
  {
    surface: 'Org spotlight',
    how: 'Organization admins can feature vendors on their community hub.',
    action: 'Ask an org you work with to add you to their featured vendors list.',
  },
] as const

const BYO_STEPS = [
  {
    title: 'Curated products (recommended)',
    body: 'Add title, price, image URL, and buy link — or import a CSV with columns title, price, listing_url, image_url, description.',
  },
  {
    title: 'Link only',
    body: 'Save your storefront URL for a Visit store button without pulling a product grid.',
  },
  {
    title: 'Etsy (your API key)',
    body: 'Create an app at etsy.com/developers, copy keystring:shared_secret, paste shop URL + key under Advanced sync.',
  },
  {
    title: 'Shopify (custom app token)',
    body: 'Admin → Apps → Develop apps → create app with read_products → install → paste *.myshopify.com + Admin API access token.',
  },
  {
    title: 'WooCommerce',
    body: 'WooCommerce → Settings → Advanced → REST API → Read key → paste site URL + consumer key/secret.',
  },
] as const

export default function VendorIntegrationGuide({ shopSlug, compact = false }: Props) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <p className="text-sm text-dc-text-muted">
        Kink Social showcases your catalog and sends buyers to your external checkout. We do not process payments
        on-platform. Platform Etsy/Shopify OAuth apps are not required — use curated listings, CSV, or your own API keys.
      </p>
      {shopSlug ?
        <p className="text-sm text-dc-text">
          Your shop link:{' '}
          <Link to={`/vendors/${encodeURIComponent(shopSlug)}`} className="text-dc-accent hover:underline">
            /vendors/{shopSlug}
          </Link>
        </p>
      : null}
      {!compact ?
        <ul className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/40 px-4 py-3">
          {BYO_STEPS.map((row) => (
            <li key={row.title}>
              <p className="text-sm font-medium text-dc-text">{row.title}</p>
              <p className="text-xs text-dc-text-muted mt-0.5">{row.body}</p>
            </li>
          ))}
        </ul>
      : null}
      <ul className={`divide-y divide-dc-border rounded-xl border border-dc-border ${compact ? '' : 'bg-dc-elevated/40'}`}>
        {ROWS.map((row) => (
          <li key={row.surface} className="px-4 py-3">
            <p className="text-sm font-medium text-dc-text">{row.surface}</p>
            <p className="text-xs text-dc-text-muted mt-0.5">{row.how}</p>
            <p className="text-xs text-dc-muted mt-1">{row.action}</p>
          </li>
        ))}
      </ul>
      {!compact ?
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/vendors" className="text-dc-accent hover:underline">
            Browse vendor directory
          </Link>
          <Link to="/events" className="text-dc-accent hover:underline">
            Find events to vend at
          </Link>
        </div>
      : null}
    </div>
  )
}
