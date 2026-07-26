import { normalizeVendorWebsite } from '@c2k/shared'
import { useEffect, useState } from 'react'
import { useApiVendorProducts, type VendorProduct } from '@/hooks/useApiVendorProducts'
import {
  vendorProductPath,
  vendorProductsCsvPath,
  vendorProductsPath,
} from '@/lib/vendor-api-paths'

const CSV_TEMPLATE = `title,price,listing_url,image_url,description
Example product,24.99,https://your-shop.example/product,https://your-shop.example/image.jpg,Short blurb
`

type Props = {
  enabled?: boolean
  vendorProfileId?: string | null
  onCatalogChange?: (count: number) => void
  variant?: 'default' | 'onboarding'
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export default function VendorCatalogPanel({
  enabled = true,
  vendorProfileId = null,
  onCatalogChange,
  variant = 'default',
}: Props) {
  const catalog = useApiVendorProducts(enabled, vendorProfileId)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [showCsv, setShowCsv] = useState(false)
  const [editing, setEditing] = useState<VendorProduct | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (catalog.status === 'ready') onCatalogChange?.(catalog.items.length)
  }, [catalog.status, catalog.items.length, onCatalogChange])

  function resetForm() {
    setTitle('')
    setPrice('')
    setListingUrl('')
    setImageUrl('')
    setDescription('')
    setEditing(null)
  }

  function startEdit(p: VendorProduct) {
    setEditing(p)
    setTitle(p.title)
    setPrice((p.priceCents / 100).toFixed(2))
    setListingUrl(p.listingUrl)
    setImageUrl(p.primaryImageUrl ?? '')
    setDescription(p.description ?? '')
    setErr(null)
    setMsg(null)
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const priceCents = parsePriceInput(price)
    if (!title.trim()) {
      setErr('Title is required.')
      return
    }
    if (priceCents == null) {
      setErr('Enter a valid price (e.g. 24.99).')
      return
    }
    const url = normalizeVendorWebsite(listingUrl.trim()) ?? listingUrl.trim()
    if (!url.startsWith('http')) {
      setErr('Listing URL must be http(s).')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        priceCents,
        listingUrl: url,
        primaryImageUrl: imageUrl.trim() ? (normalizeVendorWebsite(imageUrl.trim()) ?? imageUrl.trim()) : null,
        description: description.trim() || null,
      }
      const r = await fetch(
        editing ? vendorProductPath(editing.id, vendorProfileId) : vendorProductsPath(vendorProfileId),
        {
          method: editing ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? `Save failed (${r.status})`)
        return
      }
      setMsg(editing ? 'Product updated.' : 'Product added.')
      resetForm()
      catalog.reload()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct(id: string) {
    setErr(null)
    setMsg(null)
    if (!window.confirm('Remove this product from your kink.social catalog?')) return
    const r = await fetch(vendorProductPath(id, vendorProfileId), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setErr(j.error ?? 'Could not delete')
      return
    }
    setMsg('Product removed.')
    if (editing?.id === id) resetForm()
    catalog.reload()
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (!csvText.trim()) {
      setErr('Paste CSV contents first.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(vendorProductsCsvPath(vendorProfileId), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        created?: number
        skipped?: number
        errors?: Array<{ row: number; error: string }>
      }
      if (!r.ok) {
        setErr(j.error ?? `Import failed (${r.status})`)
        return
      }
      const errHint =
        j.errors && j.errors.length > 0 ?
          ` First issues: ${j.errors
            .slice(0, 3)
            .map((x) => `row ${x.row}: ${x.error}`)
            .join('; ')}`
        : ''
      setMsg(`Imported ${j.created ?? 0} row(s); skipped ${j.skipped ?? 0}.${errHint}`)
      setCsvText('')
      catalog.reload()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = 'kink-social-products-template.csv'
    a.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] mb-6">
      {variant === 'default' ?
        <>
          <h3 className="mb-1 text-sm font-semibold uppercase text-dc-muted">Curated catalog</h3>
          <p className="mb-4 text-sm text-dc-text-muted">
            Feature up to {catalog.max} products on your shop page. Each item links out to your store for checkout.
          </p>
        </>
      : <p className="mb-4 text-sm text-dc-text-muted">
          Add featured products buyers will see on your shop. Checkout stays on your external store.
        </p>
      }

      {catalog.status === 'loading' ?
        <p className="mb-3 text-sm text-dc-muted">Loading catalog…</p>
      : null}
      {catalog.status === 'error' ?
        <p className="mb-3 text-sm text-amber-200">Could not load products. Try again after saving your shop.</p>
      : null}

      {msg ? <p className="mb-3 text-sm text-emerald-300">{msg}</p> : null}
      {err ?
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
          {err}
        </p>
      : null}

      {catalog.items.length > 0 ?
        <ul className="mb-5 divide-y divide-dc-border rounded-xl border border-dc-border">
          {catalog.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              {p.primaryImageUrl ?
                <img src={p.primaryImageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              : <div className="h-12 w-12 rounded-lg bg-dc-surface-muted" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-dc-text">{p.title}</p>
                <p className="text-xs text-dc-muted">
                  {formatPrice(p.priceCents)} ·{' '}
                  <a href={p.listingUrl} className="text-dc-accent hover:underline" target="_blank" rel="noreferrer">
                    listing
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="min-h-10 rounded-xl border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void removeProduct(p.id)}
                className="min-h-10 rounded-xl border border-dc-border px-3 text-xs text-dc-text-muted hover:text-red-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      : catalog.status === 'ready' ?
        <p className="mb-4 text-sm text-dc-muted">No curated products yet.</p>
      : null}

      <form onSubmit={(e) => void saveProduct(e)} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
          {editing ? 'Edit product' : 'Add product'}
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-dc-text-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Product name"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dc-text-muted">Price</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="24.99"
              className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dc-text-muted">Shop / buy link</span>
            <input
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://your-shop.example/product"
              className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              required
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-dc-text-muted">Photo URL</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… (product photo)"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-dc-text-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description for your shop page"
            rows={2}
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || (catalog.items.length >= catalog.max && !editing)}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Update product' : 'Add product'}
          </button>
          {editing ?
            <button
              type="button"
              onClick={resetForm}
              className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted"
            >
              Cancel edit
            </button>
          : null}
        </div>
      </form>

      <div className="mt-6 border-t border-dc-border pt-4">
        <button
          type="button"
          onClick={() => setShowCsv((o) => !o)}
          className="mb-2 text-sm font-semibold text-dc-text hover:text-dc-accent"
          aria-expanded={showCsv}
        >
          {showCsv ? '− Hide CSV import' : '+ Import CSV'}
        </button>
        {showCsv ?
          <form onSubmit={(e) => void importCsv(e)} className="space-y-3">
            <p className="text-xs text-dc-muted">
              Columns: <code className="text-dc-text-muted">title</code>,{' '}
              <code className="text-dc-text-muted">price</code> (or price_cents),{' '}
              <code className="text-dc-text-muted">listing_url</code>, optional{' '}
              <code className="text-dc-text-muted">image_url</code>,{' '}
              <code className="text-dc-text-muted">description</code>.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-dc-accent hover:underline"
            >
              Download CSV template
            </button>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={5}
              placeholder="Paste CSV here…"
              className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 font-mono text-xs text-dc-text"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 rounded-xl border border-dc-accent-border px-4 text-sm font-medium text-dc-accent disabled:opacity-50"
            >
              {saving ? 'Importing…' : 'Import CSV'}
            </button>
          </form>
        : null}
      </div>
    </div>
  )
}
