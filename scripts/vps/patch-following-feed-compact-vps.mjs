/**
 * Patch deploy: Following feed compact rows (loves/comments), tappable media previews.
 * Usage: SSH_PASS='...' node scripts/vps/patch-following-feed-compact-vps.mjs
 */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'packages/api/src/lib/feed-activities.ts',
  'packages/api/src/lib/feed-following.ts',
  'packages/api/src/lib/feed-post-comments.ts',
  'packages/api/src/routes/feed-routes.ts',
  'packages/web/src/components/feed/FeedMediaStrip.tsx',
  'packages/web/src/components/home/ActivityFeedCard.tsx',
  'packages/web/src/lib/following-feed-present.ts',
  'packages/web/src/lib/following-feed-present.group-thread.test.ts',
  'packages/web/src/styles/feed-activity.css',
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

function sftpUpload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.createWriteStream(remote).on('error', reject).on('close', resolve).end(readFileSync(local))
    })
  })
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  for (const rel of files) {
    await sftpUpload(conn, join(root, rel), `/opt/c2k/${rel.replace(/\\/g, '/')}`)
    console.log('uploaded', rel)
  }
  await exec(conn, `cd /opt/c2k && ${compose} build api web 2>&1`, 'Build api web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d --force-recreate api web 2>&1`, 'Recreate api web')
  await exec(conn, 'sleep 15', 'Wait')
  await exec(
    conn,
    'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/ && curl -s -o /dev/null -w "feed_home=%{http_code}\\n" "https://kink.social/api/v1/feed/home?limit=1"',
    'Smoke home + feed/home',
  )
  conn.end()
  console.log('\nPATCH OK — hard-refresh /home?mode=following and comment on a status to verify compact rows')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
