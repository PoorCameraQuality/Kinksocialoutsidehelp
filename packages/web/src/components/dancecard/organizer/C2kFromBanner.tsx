'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function C2kFromBanner() {
  const [c2kConvention, setC2kConvention] = useState<string | null>(null)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'c2k') return
    const conv = params.get('convention')
    if (conv) {
      setC2kConvention(conv)
      const stored = window.sessionStorage.getItem('dc-c2k-return-url')
      if (stored) setReturnUrl(stored)
    }
  }, [])

  if (!c2kConvention) return null

  return (
    <div className="mb-6 rounded-2xl border border-dc-accent-border bg-dc-accent-muted px-4 py-3 text-sm text-dc-accent-foreground">
      <p>
        Opened from <strong>Kink Social</strong> (convention <code className="text-dc-accent">{c2kConvention}</code>
        ). Sign in below if needed. Use the same email as your Kink Social organizer account when possible.
      </p>
      {returnUrl ? (
        <p className="mt-2">
          <Link href={returnUrl} className="text-dc-accent hover:underline">
            ← Back to Kink Social
          </Link>
        </p>
      ) : null}
    </div>
  )
}
