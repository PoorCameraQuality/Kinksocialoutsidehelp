/**
 * Full ECKE education ingest preflight: DB row shape + live production API.
 * Usage: SSH_PASS='...' node scripts/verify-ecke-education-publish-preflight.mjs [article-id]
 */
import { createRequire } from 'module'
import { Client } from 'ssh2'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
require('tsx/esm/api')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const articleId = process.argv[2] || '407058cc-70b2-433d-a51f-134ef8a0721d'
const password = process.env.SSH_PASS

if (!password) {
  console.error('SSH_PASS required')
  process.exit(1)
}

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) return reject(err)
          let out = ''
          stream.on('data', (d) => {
            out += d.toString()
          })
          stream.on('close', (code) => {
            conn.end()
            if (code !== 0) reject(new Error(out || `exit ${code}`))
            else resolve(out.trim())
          })
        })
      })
      .on('error', reject)
      .connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 45000 })
  })
}

async function loadVpsEnv() {
  const raw = await sshExec(
    "cd /opt/c2k && grep -E '^ECKE_(PUBLISH_ENABLED|PUBLISH_ENDPOINT|PUBLISH_SECRET|PUBLIC_BASE_URL)=' .env.production",
  )
  const env = Object.fromEntries(
    raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1)]
      }),
  )
  return env
}

async function loadArticleRow() {
  const sql = `SELECT id::text, slug, title, excerpt, body_html, categories, content_warnings, difficulty, hero_image_url, reading_minutes, published_at, updated_at, visibility, publication_status, ecke_publish, author_user_id::text FROM education_articles WHERE id = '${articleId}'`
  const raw = await sshExec(
    `cd /opt/c2k && docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -t -A -F '|' -c "${sql}"`,
  )
  if (!raw) throw new Error(`Article ${articleId} not found`)
  const [
    id,
    slug,
    title,
    excerpt,
    bodyHtml,
    categories,
    contentWarnings,
    difficulty,
    heroImageUrl,
    readingMinutes,
    publishedAt,
    updatedAt,
    visibility,
    publicationStatus,
    eckePublish,
    authorUserId,
  ] = raw.split('|')
  return {
    id,
    slug,
    title,
    excerpt: excerpt || null,
    bodyHtml,
    categories: categories?.replace(/[{}]/g, '').split(',').filter(Boolean) ?? [],
    contentWarnings: contentWarnings?.replace(/[{}]/g, '').split(',').filter(Boolean) ?? [],
    difficulty: difficulty || null,
    heroImageUrl: heroImageUrl || null,
    readingMinutes: readingMinutes ? Number(readingMinutes) : null,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    updatedAt: new Date(updatedAt),
    visibility,
    publicationStatus,
    eckePublish: eckePublish === 't',
    authorUserId,
  }
}

async function loadAuthor(authorUserId) {
  const sql = `SELECT COALESCE(p.display_name, ''), COALESCE(u.username, '') FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = '${authorUserId}'`
  const raw = await sshExec(
    `cd /opt/c2k && docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -t -A -F '|' -c "${sql}"`,
  )
  const [displayName, username] = raw.split('|')
  return { displayName: displayName || null, username: username || null, presenterUsername: null, presenterDirectoryVisibility: null }
}

async function main() {
  const { buildEckePublicEnvelope, getEducationArticleIneligibilityReason } = await import(
    join(root, 'packages/api/src/lib/ecke-public-publish.ts')
  )

  console.log('=== ECKE education publish preflight ===\n')

  const env = await loadVpsEnv()
  console.log('VPS bridge:', env.ECKE_PUBLISH_ENABLED, env.ECKE_PUBLISH_ENDPOINT)

  const article = await loadArticleRow()
  const author = await loadAuthor(article.authorUserId)
  const ineligible = getEducationArticleIneligibilityReason(article)
  if (ineligible) {
    console.error('INELIGIBLE:', ineligible)
    process.exit(1)
  }

  let envelope
  try {
    envelope = buildEckePublicEnvelope('education_article', article, author)
  } catch (e) {
    console.error('ENVELOPE BUILD FAILED:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  console.log('Title:', envelope.payload.title.slice(0, 80))
  console.log('Slug:', envelope.payload.slug)
  console.log('Body has kink.social text:', /\bkink\.social\b/i.test(envelope.payload.bodyHtml))
  console.log('Body has kink.social URLs:', /https?:\/\/(?:www\.)?kink\.social/i.test(envelope.payload.bodyHtml))

  const res = await fetch(env.ECKE_PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ECKE_PUBLISH_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 500) }
  }

  console.log('\n=== Live ECKE response ===')
  console.log('HTTP', res.status)
  console.log(JSON.stringify(json, null, 2))

  if (res.ok && json.status === 'published') {
    console.log('\nPREFLIGHT OK — publish would succeed')
    process.exit(0)
  }

  console.error('\nPREFLIGHT FAILED')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
