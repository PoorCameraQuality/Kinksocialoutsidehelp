/**
 * Public legal policy version string from `GET /api/v1/legal/policy-version`.
 * Session-optional — safe for footers and marketing surfaces (not admin-only).
 */
import { useEffect, useState } from 'react'

export function usePolicyVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    void fetch('/api/v1/legal/policy-version')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string } | null) => {
        if (d?.version) setVersion(d.version)
      })
      .catch(() => {})
  }, [])
  return version
}
