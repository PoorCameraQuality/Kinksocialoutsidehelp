/** Upload Premium Surface Pass 1 web files and rebuild web container only (changed-files-only). */
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
  'packages/web/src/app/globals.css',
  'packages/web/src/components/events/EventsListRow.tsx',
  'packages/web/src/components/events/EventsMobileFastFilters.tsx',
  'packages/web/src/components/home/HomeActivationCard.tsx',
  'packages/web/src/components/messaging/MessagingSafetyPanel.tsx',
  'packages/web/src/components/notifications/NotificationsSafetyFooter.tsx',
  'packages/web/src/components/shell/CreateSheet.tsx',
  'packages/web/src/components/templates/FilterSheet.tsx',
  'packages/web/src/components/ui/Badge.tsx',
  'packages/web/src/components/ui/Button.tsx',
  'packages/web/src/components/ui/Card.tsx',
  'packages/web/src/components/ui/Dialog.tsx',
  'packages/web/src/components/ui/EmptyState.tsx',
  'packages/web/src/components/ui/FormField.tsx',
  'packages/web/src/components/ui/MediaCard.tsx',
  'packages/web/src/lib/card-surface.ts',
  'packages/web/src/styles/dancecard-motion.css',
  'packages/web/src/styles/dancecard-tokens.css',
  'packages/web/src/styles/desktop-surfaces.css',
  'packages/web/src/styles/premium-surfaces.css',
  'packages/web/src/styles/shared-surfaces.css',
]

const compose =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

const postDeploy = `
cd /opt/c2k && ${compose} build web && ${compose} up -d web && sleep 18
curl -sf -o /dev/null -w "root=%{http_code}\\n" https://kink.social/
curl -sf -o /dev/null -w "events=%{http_code}\\n" https://kink.social/events
CSS=$(curl -sf https://kink.social/ | grep -o 'assets/index-[^"]*\\.css' | head -1)
echo "css_bundle=$CSS"
curl -sf "https://kink.social/$CSS" | grep -q 'dc-premium-btn' && echo PREMIUM_CSS_OK || echo PREMIUM_CSS_MISSING
`

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
          conn.exec(postDeploy, (e, stream) => {
            stream.on('data', (d) => process.stdout.write(d))
            stream.stderr.on('data', (d) => process.stderr.write(d))
            stream.on('close', (code) => {
              conn.end()
              process.exit(code ?? 0)
            })
          })
        }
      })
    }
  })
})
conn.on('error', (e) => {
  console.error(e.message)
  process.exit(1)
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 180000 })
