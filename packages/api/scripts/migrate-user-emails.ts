/**
 * Encrypt legacy plaintext user emails in batches.
 * Run after apply-incremental-migration when upgrading existing deployments.
 */
import '../src/load-dev-env.js'
import { migratePlaintextEmailsBatch } from '../src/lib/retention-jobs.js'

async function main() {
  const limit = Number(process.env.MIGRATE_EMAIL_BATCH ?? 500)
  const migrated = await migratePlaintextEmailsBatch(limit)
  console.log(`Migrated ${migrated} user email(s) to encrypted storage.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
