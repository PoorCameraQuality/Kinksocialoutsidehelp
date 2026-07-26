/**
 * Scoped VPS deploy: participation public sync + profile reload fix + pronoun backfill.
 *
 * Usage: SSH_PASS='...' node scripts/vps/patch-followups-vps.mjs
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
  'packages/api/src/lib/convention-participation-offers.ts',
  'packages/web/src/components/conventions/ConventionGetInvolvedPanel.tsx',
  'packages/web/src/hooks/useApiConventionParticipation.ts',
  'packages/web/src/components/dancecard/organizer/applications/RoleWindowsBoard.tsx',
  'packages/web/src/app/profile/ProfilePageClient.tsx',
]

const pronounBackfillSql = `
UPDATE profiles p SET
  pronoun_tags = CASE lower(trim(p.pronouns))
    WHEN 'he/they' THEN ARRAY['He/Him', 'They/Them']::text[]
    WHEN 'she/her' THEN ARRAY['She/Her']::text[]
    WHEN 'they/them' THEN ARRAY['They/Them']::text[]
    ELSE p.pronoun_tags
  END,
  pronouns = CASE lower(trim(p.pronouns))
    WHEN 'he/they' THEN 'He/Him · They/Them'
    WHEN 'she/her' THEN 'She/Her'
    WHEN 'they/them' THEN 'They/Them'
    ELSE p.pronouns
  END
WHERE cardinality(p.pronoun_tags) = 0
  AND p.pronouns IS NOT NULL
  AND trim(p.pronouns) <> '';
`.replace(/\s+/g, ' ').trim()

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
    conn.exec(`cd /opt/c2k && ${cmd}`, (err, stream) => {
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
    if (!existsSync(local)) throw new Error(`Missing ${rel}`)
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

  await exec(conn, `npm run build -w @c2k/api 2>&1`, 'Build api on host')
  await exec(conn, `${compose} build api web 2>&1`, 'Docker build api + web')
  await exec(conn, `${compose} up -d api web 2>&1`, 'Restart api + web')
  await exec(conn, 'sleep 18', 'Wait for services')

  await exec(
    conn,
    `${compose} exec -T postgres psql -U c2k -d c2k -P pager=off -c "${pronounBackfillSql.replace(/"/g, '\\"')}"`,
    'Backfill legacy pronoun_tags from pronouns varchar',
  )
  await exec(
    conn,
    `${compose} exec -T postgres psql -U c2k -d c2k -P pager=off -c "SELECT u.username, p.pronouns, p.pronoun_tags FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.username IN ('ShutterSeed','LeatherCraftDemo','RopeDreamer') ORDER BY u.username;"`,
    'Verify seed pronoun backfill',
  )

  await exec(conn, 'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/', 'Smoke home')
  await exec(conn, 'curl -sf https://kink.social/api/health/ready | head -c 400 && echo', 'Smoke health')
  await exec(
    conn,
    'curl -sf "https://kink.social/api/v1/public/conventions/seed-demo-con-gated/participation-opportunities" | head -c 900 && echo',
    'Smoke participation API (trustedRoles)',
  )

  conn.end()
  console.log('\nPATCH OK — participation sync live; pronouns backfilled; profile save no longer refetches /api/profile/me.')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
