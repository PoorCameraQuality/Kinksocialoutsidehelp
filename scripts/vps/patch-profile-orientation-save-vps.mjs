/**
 * Scoped VPS deploy: profile orientation save race + mobile composer FAB overlap.
 * Uploads runtime source only — no DB migration required.
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-profile-orientation-save-vps.mjs
 */
import { Client } from 'ssh2'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'packages/shared/src/profile-identity-arrays.ts',
  'packages/api/src/routes/profile.ts',
  'packages/web/src/contexts/ProfileEditContext.tsx',
  'packages/web/src/components/home/HomeFeedRichComposer.tsx',
  'packages/web/src/layouts/RootLayout.tsx',
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

function sftpMkdirp(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, { mode: 0o755 }, () => resolve())
  })
}

async function uploadAll(conn) {
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  for (const rel of files) {
    const local = join(root, rel)
    if (!existsSync(local)) {
      throw new Error(`Missing local file: ${rel}`)
    }
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    await sftpMkdirp(sftp, dirname(remote))
    await new Promise((resolve, reject) => {
      sftp.writeFile(remote, readFileSync(local), (wErr) => {
        if (wErr) return reject(wErr)
        console.log('uploaded', rel)
        resolve()
      })
    })
  }
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  await uploadAll(conn)

  await exec(
    conn,
    `cd /opt/c2k && npm run build -w @c2k/shared && npm run build -w @c2k/api 2>&1`,
    'Build shared + api on host',
  )
  await exec(conn, `cd /opt/c2k && ${compose} build api web 2>&1`, 'Docker build api + web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d api web 2>&1`, 'Restart api + web')
  await exec(conn, 'sleep 20', 'Wait for services')
  await exec(conn, 'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/', 'Smoke home')
  await exec(conn, 'curl -sf https://kink.social/api/health/ready | head -c 400 && echo', 'Smoke health')
  await exec(
    conn,
    `${compose} exec -T api grep -c parseLegacySexualityLabels /app/packages/api/dist/routes/profile.js`,
    'Verify api orientation parser',
  )
  await exec(
    conn,
    `${compose} exec -T web sh -c "grep -c identityHydratedRef /usr/share/nginx/html/assets/index-*.js | head -1"`,
    'Verify web hydration guard',
  )

  conn.end()
  console.log('\nPATCH OK — hard-refresh Profile Studio; re-save orientations under Identity & Community.')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
