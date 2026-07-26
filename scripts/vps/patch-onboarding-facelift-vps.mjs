/**
 * Scoped deploy: onboarding facelift + shared wizard kit (member, vendor, presenter).
 * Uploads runtime source only — web container rebuild (shared bundled in web image).
 * Usage: SSH_PASS='...' node scripts/vps/patch-onboarding-facelift-vps.mjs
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
  'packages/shared/src/onboarding.ts',
  'packages/web/src/components/onboarding/MemberOnboardingWizard.tsx',
  'packages/web/src/components/onboarding/steps/WelcomeStep.tsx',
  'packages/web/src/components/onboarding/steps/SafetyStep.tsx',
  'packages/web/src/components/onboarding/steps/ProfileBasicsStep.tsx',
  'packages/web/src/components/onboarding/steps/PrivacyStep.tsx',
  'packages/web/src/components/onboarding/steps/InterestsStep.tsx',
  'packages/web/src/components/onboarding/steps/FirstStepsStep.tsx',
  'packages/web/src/components/ui/primitives/index.ts',
  'packages/web/src/components/ui/primitives/onboarding/types.ts',
  'packages/web/src/components/ui/primitives/onboarding/WizardShell.tsx',
  'packages/web/src/components/ui/primitives/onboarding/WizardStepper.tsx',
  'packages/web/src/components/ui/primitives/onboarding/WizardFooter.tsx',
  'packages/web/src/components/ui/primitives/onboarding/WizardStepHeader.tsx',
  'packages/web/src/components/ui/primitives/onboarding/WizardChoice.tsx',
  'packages/web/src/components/ui/primitives/onboarding/WizardField.tsx',
  'packages/web/src/components/ui/primitives/onboarding/index.ts',
  'packages/web/src/components/vendors/VendorOnboardingWizard.tsx',
  'packages/web/src/components/presenters/onboarding/PresenterOnboardingRouter.tsx',
  'packages/web/src/components/presenters/onboarding/PresenterTrackChooser.tsx',
  'packages/web/src/components/presenters/onboarding/shared/OnboardingShell.tsx',
  'packages/web/src/components/profile/ProfileOwnerActions.tsx',
  'packages/web/src/lib/presenter-onboarding.ts',
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
  await exec(conn, `cd /opt/c2k && ${compose} build web 2>&1`, 'Build web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d web 2>&1`, 'Restart web')
  await exec(conn, 'sleep 18', 'Wait for web')
  await exec(
    conn,
    `curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/ && \
curl -sf -o /dev/null -w "onboarding=%{http_code}\\n" https://kink.social/onboarding && \
curl -sf -o /dev/null -w "vendors_onb=%{http_code}\\n" https://kink.social/vendors/onboarding && \
curl -sf -o /dev/null -w "presenters_onb=%{http_code}\\n" https://kink.social/presenters/onboarding && \
curl -sf https://kink.social/api/health/ready | head -c 400 && echo`,
    'Smoke onboarding routes + health',
  )
  conn.end()
  console.log('\nPATCH OK — hard-refresh /onboarding, /vendors/onboarding, /presenters/onboarding')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
