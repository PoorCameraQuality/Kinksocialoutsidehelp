/** Upload Pass 3 changed files and rebuild API on VPS (changed-files-only deploy). */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS
if (!password) process.exit(1)

const files = [
  'packages/api/src/routes/ecosystem-stubs.ts',
  'packages/api/src/lib/group-access.test.ts',
  'packages/api/src/test/group-membership-privacy-db.test.ts',
  'packages/api/scripts/audit-restricted-public-media.ts',
]

const conn = new Client()
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err
    let pending = files.length
    for (const rel of files) {
      sftp.writeFile(`/opt/c2k/${rel.replace(/\\/g, '/')}`, readFileSync(join(root, rel)), (wErr) => {
        if (wErr) throw wErr
        console.log('uploaded', rel)
        if (--pending === 0) {
          conn.exec(
            `cd /opt/c2k && npm run build -w @c2k/api && docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production build api worker && docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production up -d api worker && sleep 20 && curl -sf -o /dev/null -w "ready=%{http_code}\\n" https://kink.social/api/health/ready`,
            (e, stream) => {
              stream.on('data', (d) => process.stdout.write(d))
              stream.stderr.on('data', (d) => process.stderr.write(d))
              stream.on('close', (code) => {
                conn.end()
                process.exit(code ?? 0)
              })
            },
          )
        }
      })
    }
  })
})
conn.on('error', (e) => {
  console.error(e.message)
  process.exit(1)
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 60000 })
