/** Upload Events Mobile UX Pass 1 web files and rebuild web container only (changed-files-only). */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS
if (!password) {
  console.error('Set SSH_PASS')
  process.exit(1)
}

const files = [
  'packages/web/src/app/events/EventsDiscoverPage.tsx',
  'packages/web/src/app/events/[id]/EventDetailClient.tsx',
  'packages/web/src/components/cards/EventCard.tsx',
  'packages/web/src/components/events/EventRsvpPrivacyNote.tsx',
  'packages/web/src/components/events/EventSocialOrientation.tsx',
  'packages/web/src/components/events/EventsListRow.tsx',
  'packages/web/src/components/events/EventDetailMobileFacts.tsx',
  'packages/web/src/components/events/EventsMobileFastFilters.tsx',
]

const compose =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

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
            `cd /opt/c2k && ${compose} build web && ${compose} up -d web && sleep 15 && curl -sf -o /dev/null -w "events=%{http_code}\\n" https://kink.social/events`,
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
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 120000 })
