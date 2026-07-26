/**
 * POST education_article ingest envelope with photos manifest to ECKE.
 *
 * Local: set ECKE_PUBLISH_ENDPOINT + ECKE_PUBLISH_SECRET (from .env.local).
 *   node scripts/verify-ecke-ingest-with-media.mjs
 *
 * VPS: set SSH_PASS (runs curl on production host with .env.production).
 *   ECKE_SMOKE_VIA=vps node scripts/verify-ecke-ingest-with-media.mjs
 */

const SOURCE_ID = process.env.ECKE_SMOKE_SOURCE_ID || '407058cc-70b2-433d-a51f-134ef8a0721d'
const HERO_URL = process.env.ECKE_SMOKE_HERO_URL || 'https://cdn.example.com/ecke-smoke-hero.jpg'

const envelope = {
  sourceSystem: 'kink.social',
  entityType: 'education_article',
  sourceId: SOURCE_ID,
  sourceUpdatedAt: new Date().toISOString(),
  action: 'upsert',
  visibility: 'PUBLIC',
  publishToEcke: true,
  publicSafe: true,
  idempotencyKey: `kink.social:education_article:${SOURCE_ID}`,
  canonicalKinkSocialUrl: 'https://kink.social/education/kink-social-alpha',
  preferredSlug: process.env.ECKE_SMOKE_SLUG || 'kink-social-alpha-preflight',
  allowSlugSuffix: false,
  payload: {
    title: 'Kink.Social ECKE photo manifest smoke',
    slug: process.env.ECKE_SMOKE_SLUG || 'kink-social-alpha-preflight',
    excerpt: 'Photo manifest v1 smoke test.',
    bodyHtml: '<p>ECKE photo bridge smoke — public CDN hero only.</p>',
    authorDisplayName: 'C2K Team',
    authorUsername: 'demo',
    authorProfileUrl: 'https://kink.social/profile/demo',
    contentWarnings: [],
    categories: ['Education'],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    heroImageUrl: HERO_URL,
    photos: {
      manifestVersion: 1,
      hero: {
        sourceMediaAssetId: '22222222-2222-4222-8222-222222222222',
        role: 'hero',
        ordinal: 0,
        publicUrl: HERO_URL,
        width: 1200,
        height: 630,
        sha256Hash: null,
        altText: 'ECKE smoke hero',
      },
      gallery: [],
    },
  },
}

async function smokeLocal() {
  const endpoint = process.env.ECKE_PUBLISH_ENDPOINT?.trim()
  const secret = process.env.ECKE_PUBLISH_SECRET?.trim()
  if (!endpoint || !secret) {
    console.error('Set ECKE_PUBLISH_ENDPOINT and ECKE_PUBLISH_SECRET for local smoke')
    process.exit(1)
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  })
  const text = await res.text()
  process.stdout.write(`${text}\nHTTP:${res.status}\n`)
  if (!res.ok) process.exit(1)
}

async function smokeVps() {
  const { Client } = await import('ssh2')
  const password = process.env.SSH_PASS
  if (!password) {
    console.error('SSH_PASS required for ECKE_SMOKE_VIA=vps')
    process.exit(1)
  }
  await new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec(
        "cd /opt/c2k && set -a && . ./.env.production && set +a && curl -s -w '\\nHTTP:%{http_code}' -X POST \"$ECKE_PUBLISH_ENDPOINT\" -H \"Authorization: Bearer $ECKE_PUBLISH_SECRET\" -H 'Content-Type: application/json' -d @- <<'EOF'\n" +
          JSON.stringify(envelope) +
          "\nEOF",
        (err, stream) => {
          if (err) {
            reject(err)
            return
          }
          stream.on('data', (d) => process.stdout.write(d))
          stream.stderr.on('data', (d) => process.stderr.write(d))
          stream.on('close', (code) => {
            conn.end()
            if (code) reject(new Error(`remote curl exit ${code}`))
            else resolve(undefined)
          })
        },
      )
    })
    conn.on('error', reject)
    conn.connect({ host: process.env.SSH_HOST || '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 45000 })
  })
}

const via = (process.env.ECKE_SMOKE_VIA || 'local').toLowerCase()
if (via === 'vps') {
  await smokeVps()
} else {
  await smokeLocal()
}
