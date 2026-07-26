import { useCallback, useEffect, useState } from 'react'
import { vendorAppearancePatchPath } from '@/lib/vendor-api-paths'
import type { VendorShopHeaderLayout } from './VendorShopHeader'

type Props = {
  vendorSlug: string
  initialBannerUrl: string | null
  initialLogoUrl: string | null
  initialLayout: VendorShopHeaderLayout
  onSaved: () => void | Promise<void>
  /** When set, PATCH targets this shop (for runners). */
  vendorProfileId?: string | null
}

export default function VendorShopAppearancePanel({
  vendorSlug,
  initialBannerUrl,
  initialLogoUrl,
  initialLayout,
  onSaved,
  vendorProfileId = null,
}: Props) {
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl ?? '')
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [layout, setLayout] = useState<VendorShopHeaderLayout>(initialLayout)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'banner' | 'logo' | null>(null)

  useEffect(() => {
    setBannerUrl(initialBannerUrl ?? '')
    setLogoUrl(initialLogoUrl ?? '')
    setLayout(initialLayout)
  }, [initialBannerUrl, initialLogoUrl, initialLayout])

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true)
      setMsg(null)
      try {
        const r = await fetch(vendorAppearancePatchPath(vendorProfileId), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          setMsg(j.error ?? 'Could not save')
          return
        }
        await onSaved()
        setMsg('Saved.')
      } catch {
        setMsg('Network error')
      } finally {
        setSaving(false)
      }
    },
    [onSaved, vendorProfileId]
  )

  const pickAndUpload = useCallback(
    (kind: 'banner' | 'logo') => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        setUploading(kind)
        setMsg(null)
        try {
          const fd = new FormData()
          fd.append('purpose', 'vendor_branding')
          fd.append('file', file)
          const up = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
          const data = (await up.json().catch(() => ({}))) as { url?: string; error?: string }
          if (!up.ok || !data.url) {
            setMsg(data.error ?? 'Upload failed')
            return
          }
          if (kind === 'banner') setBannerUrl(data.url)
          else setLogoUrl(data.url)
          await patch(kind === 'banner' ? { bannerUrl: data.url } : { logoUrl: data.url })
        } finally {
          setUploading(null)
        }
      }
      input.click()
    },
    [patch]
  )

  return (
    <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-6">
      <h3 className="text-sm font-semibold text-dc-muted uppercase mb-1">Shop appearance</h3>
      <p className="text-xs text-dc-muted mb-4">
        Banner spans the full width at the top. Choose whether your shop name, rating, and tags sit on the banner or in a
        card below (better if you use a logo mark).
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-dc-text-muted mb-2">Header layout</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-dc-text cursor-pointer">
              <input
                type="radio"
                name="shopHeaderLayout"
                checked={layout === 'OVERLAY'}
                onChange={() => {
                  setLayout('OVERLAY')
                  void patch({ shopHeaderLayout: 'OVERLAY' })
                }}
                disabled={saving}
              />
              On banner
            </label>
            <label className="flex items-center gap-2 text-sm text-dc-text cursor-pointer">
              <input
                type="radio"
                name="shopHeaderLayout"
                checked={layout === 'BELOW'}
                onChange={() => {
                  setLayout('BELOW')
                  void patch({ shopHeaderLayout: 'BELOW' })
                }}
                disabled={saving}
              />
              Card below banner
            </label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-dc-text-muted mb-2">Banner image</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(uploading) || saving}
                onClick={() => pickAndUpload('banner')}
                className="px-3 py-2 rounded-lg bg-dc-accent text-dc-text text-sm font-medium disabled:opacity-50"
              >
                {uploading === 'banner' ? 'Uploading…' : 'Upload banner'}
              </button>
              {bannerUrl ?
                <button
                  type="button"
                  disabled={Boolean(uploading) || saving}
                  onClick={() => {
                    setBannerUrl('')
                    void patch({ bannerUrl: '' })
                  }}
                  className="px-3 py-2 rounded-lg border border-dc-border text-dc-text-muted text-sm hover:text-dc-text"
                >
                  Remove
                </button>
              : null}
            </div>
            {bannerUrl ?
              <p className="text-xs text-dc-muted mt-2 truncate" title={bannerUrl}>
                {bannerUrl}
              </p>
            : null}
          </div>
          <div>
            <p className="text-sm text-dc-text-muted mb-2">Logo (optional)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(uploading) || saving}
                onClick={() => pickAndUpload('logo')}
                className="px-3 py-2 rounded-lg bg-dc-elevated-solid text-dc-text text-sm font-medium border border-dc-border disabled:opacity-50"
              >
                {uploading === 'logo' ? 'Uploading…' : 'Upload logo'}
              </button>
              {logoUrl ?
                <button
                  type="button"
                  disabled={Boolean(uploading) || saving}
                  onClick={() => {
                    setLogoUrl('')
                    void patch({ logoUrl: '' })
                  }}
                  className="px-3 py-2 rounded-lg border border-dc-border text-dc-text-muted text-sm hover:text-dc-text"
                >
                  Remove
                </button>
              : null}
            </div>
            {logoUrl ?
              <p className="text-xs text-dc-muted mt-2 truncate" title={logoUrl}>
                {logoUrl}
              </p>
            : null}
          </div>
        </div>
      </div>

      <p className="text-xs text-dc-muted mt-4">Public URL: /vendors/{vendorSlug}</p>
      {msg ? <p className="text-sm mt-2 text-dc-text-muted">{msg}</p> : null}
    </div>
  )
}
