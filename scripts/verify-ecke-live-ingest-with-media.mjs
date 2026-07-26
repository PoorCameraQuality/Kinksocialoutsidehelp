/** @deprecated Use scripts/verify-ecke-ingest-with-media.mjs — this wrapper keeps VPS behavior. */
process.env.ECKE_SMOKE_VIA = process.env.ECKE_SMOKE_VIA || 'vps'
await import('./verify-ecke-ingest-with-media.mjs')
