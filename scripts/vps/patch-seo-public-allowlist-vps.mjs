/**
 * Scoped deploy: FetLife-style brand/legal SEO allowlist + GSC sitemap fetch harden.
 * Uploads SEO/Caddy/nginx sources only; rebuilds web and recreates caddy (no api/worker/npm ci).
 * Usage: SSH_PASS='...' node scripts/vps/patch-seo-public-allowlist-vps.mjs
 */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'Caddyfile',
  'docker/nginx-spa.conf',
  'packages/shared/src/seo-policy.ts',
  'packages/shared/src/index.ts',
  'packages/web/public/robots.txt',
  'packages/web/vite.config.ts',
  'packages/web/src/components/seo/AppRobotsMeta.tsx',
  'packages/web/src/components/seo/LandingPageMeta.tsx',
]

const compose =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn)).on('error', reject)
    conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 120000 })
  })
}

function exec(conn, cmd, label = '') {
  return new Promise((resolve, reject) => {
    if (label) console.log(`\n>>> ${label}`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => (code !== 0 ? reject(new Error(`${label || cmd} exit ${code}`)) : resolve()))
    })
  })
}

async function uploadAll(conn) {
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  for (const rel of files) {
    const local = join(root, rel)
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    const remoteDir = dirname(remote).replace(/\\/g, '/')
    await new Promise((resolve, reject) => {
      sftp.mkdir(remoteDir, { mode: 0o755 }, () => {
        sftp.writeFile(remote, readFileSync(local), (wErr) => {
          if (wErr) return reject(wErr)
          console.log('uploaded', rel)
          resolve()
        })
      })
    })
  }
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  await uploadAll(conn)
  await exec(conn, `cd /opt/c2k && ${compose} build web 2>&1`, 'Build web only')
  await exec(conn, `cd /opt/c2k && ${compose} up -d web 2>&1`, 'Restart web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d --force-recreate caddy 2>&1`, 'Recreate caddy')
  await exec(conn, 'sleep 12', 'Wait for web/caddy')
  await exec(
    conn,
    `echo '--- robots ---' && curl -sf https://kink.social/robots.txt && echo && \
echo '--- sitemap ctype ---' && curl -sSI https://kink.social/sitemap.xml | tr -d '\\r' | grep -iE 'HTTP/|content-type|cache-control|x-robots' && \
echo '--- sitemap locs ---' && curl -sf https://kink.social/sitemap.xml | grep -o '<loc>[^<]*</loc>' | wc -l && \
echo '--- about / home x-robots ---' && \
curl -sI https://kink.social/about | tr -d '\\r' | grep -iE 'HTTP/|x-robots' || true; \
curl -sI https://kink.social/home | tr -d '\\r' | grep -iE 'HTTP/|x-robots' || true; \
echo '--- health ---' && curl -sf https://kink.social/api/health/ready | head -c 200 && echo`,
    'Smoke GSC SEO allowlist',
  )
  conn.end()
  console.log('\nPATCH OK — resubmit https://kink.social/sitemap.xml in Search Console')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
