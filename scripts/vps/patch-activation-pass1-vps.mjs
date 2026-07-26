/** Upload Public Alpha Activation Pass 1 web files and rebuild web container only. */
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
  'packages/web/src/lib/alpha-activation-copy.ts',
  'packages/web/src/lib/home-activation.ts',
  'packages/web/src/lib/onboarding-first-steps.ts',
  'packages/web/src/app/page.tsx',
  'packages/web/src/app/support/page.tsx',
  'packages/web/src/components/LoginCard.tsx',
  'packages/web/src/components/home/HomeActivationCard.tsx',
  'packages/web/src/components/home/HomeFirstSessionDashboard.tsx',
  'packages/web/src/components/landing/LandingAuthIntro.tsx',
  'packages/web/src/components/landing/LandingSideHero.tsx',
  'packages/web/src/components/landing/public-auth.css',
  'packages/web/src/components/onboarding/MemberOnboardingWizard.tsx',
  'packages/web/src/components/onboarding/onboarding-step-icons.tsx',
  'packages/web/src/components/ui/primitives/dashboard.tsx',
  'packages/web/src/components/ui/primitives/layout.tsx',
  'packages/web/src/lib/alpha-activation-copy.test.ts',
  'packages/web/src/lib/home-activation.test.ts',
  'packages/web/src/lib/onboarding-first-steps.test.ts',
  'packages/api/package.json',
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
            `cd /opt/c2k && ${compose} build web && ${compose} up -d web && sleep 15 && curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/ && curl -sf https://kink.social/ | grep -o "Public alpha" | head -1`,
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
