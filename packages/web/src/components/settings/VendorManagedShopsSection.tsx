import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

type ManagedShop = {
  id: string
  displayName: string
  slug: string
  visibility: string | null
  role: 'owner' | 'runner'
  logoUrl: string | null
}

function visibilityLabel(v: string | null): string {
  if (v === 'PUBLIC') return 'Public'
  if (v === 'MEMBERS') return 'Members only'
  if (v === 'HIDDEN') return 'Hidden'
  return v ?? 'Unknown'
}

export default function VendorManagedShopsSection() {
  const { isAuthenticated } = useAuth()
  const [shops, setShops] = useState<ManagedShop[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setShops([])
      setLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/v1/vendors/managed', { credentials: 'include' })
        if (!cancelled && r.ok) {
          const d = (await r.json()) as { shops?: ManagedShop[] }
          setShops(Array.isArray(d.shops) ? d.shops : [])
        } else if (!cancelled) {
          setShops([])
        }
      } catch {
        if (!cancelled) setShops([])
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!isAuthenticated || !loaded) return null

  const runnerShops = shops.filter((s) => s.role === 'runner')
  if (shops.length === 0) return null

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Shops you help run</h2>
        <p className="text-sm text-dc-text-muted mt-1">
          Vendor shops where you have runner access{runnerShops.length === 0 ? ', or that you own' : ''}.
        </p>
      </div>
      <ul className="space-y-3">
        {shops.map((shop) => (
          <li
            key={shop.id}
            className="flex flex-col gap-3 rounded-xl border border-dc-border bg-dc-surface-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-dc-border bg-dc-elevated-solid flex items-center justify-center">
                {shop.logoUrl ?
                  <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-semibold text-dc-muted">{shop.displayName.charAt(0)}</span>}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-dc-text truncate">{shop.displayName}</p>
                <p className="text-xs text-dc-muted mt-0.5">
                  Role: {shop.role === 'owner' ? 'Owner' : 'Runner'} · {visibilityLabel(shop.visibility)}
                </p>
              </div>
            </div>
            <Link
              to={`/vendors/${encodeURIComponent(shop.slug)}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
            >
              Manage shop
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
