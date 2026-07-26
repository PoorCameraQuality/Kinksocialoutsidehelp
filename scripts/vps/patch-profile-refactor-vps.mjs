/**
 * Patch deploy: photo-forward profiles, personal photo quota, feed composer uploads.
 * Uploads runtime source only (no ECKE ops scripts, docs, or e2e).
 * Usage: SSH_PASS='...' node scripts/vps/patch-profile-refactor-vps.mjs
 */
import { Client } from 'ssh2'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'packages/api/scripts/tsx-web-paths.mjs',
  'packages/api/src/lib/feed-composer-media.ts',
  'packages/api/src/lib/media-social-service.ts',
  'packages/api/src/lib/personal-photo-quota.ts',
  'packages/api/src/lib/retention-jobs.ts',
  'packages/api/src/routes/feed-routes.ts',
  'packages/api/src/routes/profile-photos.ts',
  'packages/api/src/routes/user-media-routes.ts',
  'packages/shared/src/index.ts',
  'packages/shared/src/personal-photo-quota.ts',
  'packages/shared/src/profile-identity-arrays.ts',
  'packages/shared/src/profile-identity-options.ts',
  'packages/web/src/app/profile/ProfilePageClient.tsx',
  'packages/web/src/app/profile/[username]/page.tsx',
  'packages/web/src/components/home/HomeFeedRichComposer.tsx',
  'packages/web/src/components/media/MediaUploadComposer.tsx',
  'packages/web/src/components/media/PersonalPhotoQuotaNotice.tsx',
  'packages/web/src/components/profile/ProfilePhotoManager.tsx',
  'packages/web/src/components/profile/layout/ProfileGalleryStrip.tsx',
  'packages/web/src/components/profile/layout/ProfileHero.tsx',
  'packages/web/src/components/profile/layout/ProfileLayout.tsx',
  'packages/web/src/components/profile/social/ProfileNetworkCard.tsx',
  'packages/web/src/components/profile/story/ProfileAboutBlock.tsx',
  'packages/web/src/components/profile/story/ProfileInterestsCard.tsx',
  'packages/web/src/contexts/ProfileEditContext.tsx',
  'packages/web/src/hooks/usePersonalPhotoQuota.ts',
  'packages/web/src/hooks/useProfilePhotos.ts',
  'packages/web/src/lib/feed-image-upload.ts',
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
    mkdirSync(dirname(local), { recursive: true })
    await new Promise((resolve, reject) => {
      sftp.mkdir(dirname(remote), { mode: 0o755 }, () => {
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
  await exec(conn, `cd /opt/c2k && ${compose} build api web worker 2>&1`, 'Build api + web + worker')
  await exec(conn, `cd /opt/c2k && ${compose} up -d api web worker 2>&1`, 'Restart api + web + worker')
  await exec(conn, 'sleep 18', 'Wait for services')
  await exec(
    conn,
    'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/ && curl -sf https://kink.social/api/health/ready | head -c 400 && echo',
    'Smoke home + health/ready',
  )
  conn.end()
  console.log('\nPATCH OK — hard-refresh kink.social/profile')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
