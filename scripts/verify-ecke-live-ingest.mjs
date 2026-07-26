import { Client } from 'ssh2'

const password = process.env.SSH_PASS
if (!password) {
  console.error('SSH_PASS required')
  process.exit(1)
}

const SOURCE_ID = '407058cc-70b2-433d-a51f-134ef8a0721d'
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
  preferredSlug: 'kink-social-alpha-preflight',
  allowSlugSuffix: false,
  payload: {
    title: 'Kink.Social Comes Online in Alpha Testing Phase',
    slug: 'kink-social-alpha-preflight',
    excerpt: 'kink.social begins alpha testing for the community.',
    bodyHtml:
      '<p>kink.social is now in alpha. Visit kink.social to learn more about the platform launch.</p>',
    authorDisplayName: 'C2K Team',
    authorUsername: 'demo',
    authorProfileUrl: 'https://kink.social/profile/demo',
    contentWarnings: [],
    categories: ['Education'],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    heroImageUrl: null,
  },
}

const conn = new Client()
conn.on('ready', () => {
  conn.exec(
    "cd /opt/c2k && set -a && . ./.env.production && set +a && curl -s -w '\\nHTTP:%{http_code}' -X POST \"$ECKE_PUBLISH_ENDPOINT\" -H \"Authorization: Bearer $ECKE_PUBLISH_SECRET\" -H 'Content-Type: application/json' -d @- <<'EOF'\n" +
      JSON.stringify(envelope) +
      "\nEOF",
    (err, stream) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        conn.end()
        process.exit(code ?? 0)
      })
    },
  )
}).connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 45000 })
