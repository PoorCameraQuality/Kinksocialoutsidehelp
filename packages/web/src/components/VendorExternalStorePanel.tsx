import { normalizeVendorWebsite } from '@c2k/shared'
import { useEffect, useState } from 'react'
import {
  vendorEtsyPath,
  vendorExternalStorePath,
  vendorExternalSyncPath,
} from '@/lib/vendor-api-paths'

const TAB_DESCRIPTIONS = {
  etsy: {
    body: 'Connect with your own Etsy developer app key (bring-your-own). Platform Etsy OAuth is not offered right now.',
    setup:
      'Create an app at etsy.com/developers, copy the keystring:shared_secret as your x-api-key, and paste your shop URL or name.',
  },
  shopify: {
    body: 'Connect with an Admin API access token from a custom app in your Shopify admin (bring-your-own).',
    setup:
      'Shopify Admin → Settings → Apps → Develop apps → create an app with read_products → install → copy Admin API access token and your *.myshopify.com domain.',
  },
  woocommerce: {
    body: 'Enter your WooCommerce site URL and read-only REST API credentials.',
    setup: 'WooCommerce → Settings → Advanced → REST API → add key with Read permission.',
  },
  link: {
    body: 'Add a store URL without syncing product listings. Your vendor page will show a visit-store link (use curated products for a catalog).',
    setup: null,
  },
} as const

type StoreTab = 'etsy' | 'shopify' | 'woocommerce' | 'link'

type Props = {
  externalStoreType: string
  etsyShopUrl: string
  wooSiteUrl?: string
  shopifyShop?: string
  syncedAt: string | null
  syncError: string | null
  onUpdated: () => void
  variant?: 'default' | 'onboarding' | 'advanced' | 'link-only'
  /** Limit visible tabs (e.g. link-only surface vs BYO sync). */
  allowedTabs?: readonly StoreTab[]
  /** When set, API calls target this shop (for runners managing a shop they do not own). */
  vendorProfileId?: string | null
}

const ALL_TABS: readonly StoreTab[] = ['link', 'etsy', 'shopify', 'woocommerce']
const LINK_ONLY_TABS: readonly StoreTab[] = ['link']
const BYO_TABS: readonly StoreTab[] = ['etsy', 'shopify', 'woocommerce']

export default function VendorExternalStorePanel({
  externalStoreType,
  etsyShopUrl,
  wooSiteUrl,
  shopifyShop: shopifyShopProp,
  syncedAt,
  syncError,
  onUpdated,
  variant = 'default',
  allowedTabs,
  vendorProfileId = null,
}: Props) {
  const tabs =
    allowedTabs && allowedTabs.length > 0 ? allowedTabs
    : variant === 'link-only' ? LINK_ONLY_TABS
    : variant === 'advanced' ? BYO_TABS
    : ALL_TABS
  const [tab, setTab] = useState<StoreTab>(tabs[0] ?? 'link')
  const [etsyUrl, setEtsyUrl] = useState(etsyShopUrl)
  const [etsyKey, setEtsyKey] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [wooSite, setWooSite] = useState(wooSiteUrl ?? '')
  const [wooKey, setWooKey] = useState('')
  const [wooSecret, setWooSecret] = useState('')
  const [shopifyShop, setShopifyShop] = useState(shopifyShopProp ?? '')
  const [shopifyToken, setShopifyToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setEtsyUrl(etsyShopUrl)
  }, [etsyShopUrl])

  useEffect(() => {
    if (wooSiteUrl) setWooSite(wooSiteUrl)
  }, [wooSiteUrl])

  useEffect(() => {
    if (shopifyShopProp) setShopifyShop(shopifyShopProp)
  }, [shopifyShopProp])

  const tabsKey = tabs.join(',')
  useEffect(() => {
    const preferred: StoreTab =
      externalStoreType === 'shopify' ? 'shopify'
      : externalStoreType === 'woocommerce' ? 'woocommerce'
      : externalStoreType === 'etsy' ? 'etsy'
      : externalStoreType === 'link_only' ? 'link'
      : (tabs[0] ?? 'link')
    setTab(tabs.includes(preferred) ? preferred : (tabs[0] ?? 'link'))
    // tabsKey captures allowed tab set without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tabsKey stands in for tabs
  }, [externalStoreType, tabsKey])

  async function syncNow() {
    setErr(null)
    setMsg(null)
    setSyncing(true)
    try {
      const r = await fetch(vendorExternalSyncPath(vendorProfileId), {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number }
      if (r.status === 429) {
        setErr(j.error ?? `Wait ${j.retryAfterSec ?? 60}s before syncing again.`)
        return
      }
      if (!r.ok) {
        setErr(j.error ?? `Sync failed (${r.status})`)
        return
      }
      setMsg('Listings synced.')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSyncing(false)
    }
  }

  async function saveEtsy(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const trimmed = etsyUrl.trim()
    if (!trimmed) {
      setErr('Enter Etsy shop URL or name.')
      return
    }
    if (!etsyKey.trim()) {
      setErr('Paste your Etsy app API key (keystring:shared_secret).')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(vendorEtsyPath(vendorProfileId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopUrl: normalizeVendorWebsite(trimmed) ?? trimmed,
          xApiKey: etsyKey.trim(),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? `Could not connect (${r.status})`)
        return
      }
      setMsg('Etsy linked with your API key. Sync will run shortly.')
      setEtsyKey('')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function disconnectAll() {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const r = await fetch(vendorExternalStorePath(vendorProfileId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'none' }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not disconnect')
        return
      }
      setMsg('External store disconnected.')
      setEtsyUrl('')
      setLinkUrl('')
      setWooKey('')
      setWooSecret('')
      setShopifyToken('')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function saveLinkOnly(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const u = linkUrl.trim()
    if (!u) {
      setErr('Enter a store URL.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(vendorExternalStorePath(vendorProfileId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'link_only', storeUrl: normalizeVendorWebsite(u) ?? u }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? `Failed (${r.status})`)
        return
      }
      setMsg('Store link saved (no product sync).')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function saveWoo(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (!wooSite.trim() || !wooKey.trim() || !wooSecret.trim()) {
      setErr('Site URL, consumer key, and consumer secret are required.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(vendorExternalStorePath(vendorProfileId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'woocommerce',
          siteUrl: normalizeVendorWebsite(wooSite.trim()) ?? wooSite.trim(),
          consumerKey: wooKey.trim(),
          consumerSecret: wooSecret.trim(),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? `Failed (${r.status})`)
        return
      }
      setMsg('WooCommerce connected. Sync will run shortly.')
      setWooKey('')
      setWooSecret('')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function saveShopify(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const shop = shopifyShop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
    if (!shop.includes('.')) {
      setErr('Enter your Shopify domain, e.g. your-store.myshopify.com')
      return
    }
    if (!shopifyToken.trim()) {
      setErr('Paste the Admin API access token from your custom app.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(vendorExternalStorePath(vendorProfileId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'shopify',
          shopDomain: shop,
          accessToken: shopifyToken.trim(),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? `Failed (${r.status})`)
        return
      }
      setMsg('Shopify connected with your token. Sync will run shortly.')
      setShopifyToken('')
      onUpdated()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  const showSync =
    externalStoreType === 'etsy' ||
    externalStoreType === 'shopify' ||
    externalStoreType === 'woocommerce'

  const heading =
    variant === 'advanced' ? 'Advanced: sync with your own API keys'
    : variant === 'link-only' ? 'Link your storefront'
    : variant === 'onboarding' ? null
    : 'External store sync'

  return (
    <div className="mb-6 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">
      {heading ?
        <>
          <h3 className="mb-1 text-sm font-semibold uppercase text-dc-muted">{heading}</h3>
          <p className="mb-4 text-sm text-dc-text-muted">
            {variant === 'link-only' ?
              'Show a Visit store button without syncing a product grid. You can still add curated products above.'
            : 'Optional. Prefer curated products or CSV when you can. Checkout always stays on your store.'}
          </p>
        </>
      : null}

      {tabs.length > 1 ?
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="External sync type">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === t ? 'bg-dc-accent text-dc-text' : 'bg-dc-elevated-solid text-dc-text-muted hover:text-dc-text'
              }`}
            >
              {t === 'link' ? 'Link only'
              : t === 'woocommerce' ? 'WooCommerce'
              : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      : null}

      {syncError ?
        <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          Last sync error: {syncError}
        </p>
      : null}
      {msg ? <p className="mb-3 text-sm text-emerald-300/90">{msg}</p> : null}
      {err ?
        <div
          className="mb-3 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1">{err}</p>
            <button
              type="button"
              onClick={() => setErr(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}

      {tab === 'etsy' ?
        <form onSubmit={(e) => void saveEtsy(e)} className="space-y-3">
          <p className="text-sm text-dc-text-muted">{TAB_DESCRIPTIONS.etsy.body}</p>
          <p className="text-xs text-dc-muted">{TAB_DESCRIPTIONS.etsy.setup}</p>
          <input
            type="text"
            value={etsyUrl}
            onChange={(e) => setEtsyUrl(e.target.value)}
            placeholder="https://www.etsy.com/shop/… or shop name"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <input
            type="password"
            value={etsyKey}
            onChange={(e) => setEtsyKey(e.target.value)}
            placeholder="Etsy x-api-key (keystring:shared_secret)"
            autoComplete="off"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Connect Etsy with my key'}
          </button>
        </form>
      : null}

      {tab === 'shopify' ?
        <form onSubmit={(e) => void saveShopify(e)} className="space-y-3">
          <p className="text-sm text-dc-text-muted">{TAB_DESCRIPTIONS.shopify.body}</p>
          <p className="text-xs text-dc-muted">{TAB_DESCRIPTIONS.shopify.setup}</p>
          <input
            type="text"
            value={shopifyShop}
            onChange={(e) => setShopifyShop(e.target.value)}
            placeholder="your-store.myshopify.com"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <input
            type="password"
            value={shopifyToken}
            onChange={(e) => setShopifyToken(e.target.value)}
            placeholder="Admin API access token"
            autoComplete="off"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Connect Shopify with my token'}
          </button>
        </form>
      : null}

      {tab === 'woocommerce' ?
        <form onSubmit={(e) => void saveWoo(e)} className="space-y-3">
          <p className="text-sm text-dc-text-muted">{TAB_DESCRIPTIONS.woocommerce.body}</p>
          <p className="text-xs text-dc-muted">{TAB_DESCRIPTIONS.woocommerce.setup}</p>
          <input
            type="text"
            value={wooSite}
            onChange={(e) => setWooSite(e.target.value)}
            placeholder="your-wordpress-site.com"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <input
            type="text"
            value={wooKey}
            onChange={(e) => setWooKey(e.target.value)}
            placeholder="Consumer key"
            autoComplete="off"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <input
            type="password"
            value={wooSecret}
            onChange={(e) => setWooSecret(e.target.value)}
            placeholder="Consumer secret"
            autoComplete="off"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Connect WooCommerce'}
          </button>
        </form>
      : null}

      {tab === 'link' ?
        <form onSubmit={(e) => void saveLinkOnly(e)} className="space-y-3">
          <p className="text-sm text-dc-text-muted">{TAB_DESCRIPTIONS.link.body}</p>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="your-store.com"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            Save store link
          </button>
        </form>
      : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-dc-border pt-4">
        {showSync ?
          <div className="w-full space-y-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncNow()}
              className="min-h-10 rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync listings now'}
            </button>
          </div>
        : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void disconnectAll()}
          className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
        >
          Disconnect external store
        </button>
      </div>

      {syncedAt ?
        <p className="mt-3 text-xs text-dc-muted">Last listing sync: {new Date(syncedAt).toLocaleString()}</p>
      : null}
    </div>
  )
}
