import { Link } from 'react-router-dom'

export default function BrandingGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="text-sm text-dc-muted mb-2">
        <Link to="/support" className="text-dc-accent hover:underline">
          Support
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-dc-text mb-4">Branding &amp; social sharing</h1>
      <p className="text-dc-text-muted text-sm mb-6">
        How to set banners, logos, and link preview images for organizations, groups, and conventions.
      </p>

      <section className="space-y-4 text-sm text-dc-text-muted">
        <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="font-semibold text-dc-text mb-2">Three image types</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-dc-text">Banner</strong>. Wide header on your public page (3:1 or 16:9,
              ~1200×400px).
            </li>
            <li>
              <strong className="text-dc-text">Logo</strong>. Square avatar beside your name (256–512px).
            </li>
            <li>
              <strong className="text-dc-text">Link preview</strong>. What Discord, Facebook, and iMessage show when
              someone shares your URL (1200×630, 1.91:1).
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="font-semibold text-dc-text mb-2">Where to edit</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-dc-text">Organization</strong> · Organizer dashboard → Settings → Branding.
            </li>
            <li>
              <strong className="text-dc-text">Group</strong> · Organizer dashboard → Group → Settings → Branding.
            </li>
            <li>
              <strong className="text-dc-text">Convention</strong> · Event Systems → Settings → Public page (hero +
              social share image).
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="font-semibold text-dc-text mb-2">Fallback order for link previews</h2>
          <p>
            If you do not upload a dedicated link preview image, we use: share image → hero/banner → logo → site
            default.
          </p>
        </div>

        <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="font-semibold text-dc-text mb-2">Testing shares</h2>
          <p className="mb-2">
            In-app previews show in the branding panel. For external apps, use share URLs (API) or paste your public
            link into:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Facebook Sharing Debugger</li>
            <li>Discord embed preview (paste link in a channel)</li>
            <li>iMessage (send link to yourself)</li>
          </ul>
          <p className="mt-2 text-dc-muted">
            Crawler-friendly pages: <code className="text-xs">/share/orgs/:slug</code>,{' '}
            <code className="text-xs">/share/groups/:idOrSlug</code>,{' '}
            <code className="text-xs">/share/conventions/:slug</code> on the API host.
          </p>
        </div>

        <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="font-semibold text-dc-text mb-2">Content policy</h2>
          <p>Use images you have rights to publish. No illegal content; follow community guidelines.</p>
        </div>
      </section>
    </div>
  )
}
