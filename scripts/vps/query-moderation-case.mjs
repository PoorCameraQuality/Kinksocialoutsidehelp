/**
 * Query moderation case + scanner results on prod via SSH.
 * Usage: SSH_PASSWORD=... node scripts/vps/query-moderation-case.mjs <caseId>
 */
import { Client } from 'ssh2'

const caseId = process.argv[2] ?? '9042a95b-b62b-49ea-a4e3-33fb730743a7'
const password = process.env.SSH_PASSWORD
if (!password) process.exit(1)

const sql = `
SELECT mc.id, mc.status, mc.queue, mc.policy_reason, mc.severity, mc.target_content_id,
       ma.id AS asset_id, ma.upload_status, ma.scan_status, ma.content_rating,
       ma.source_surface, ma.original_filename, ma.sha256_hash
FROM moderation_cases mc
LEFT JOIN media_assets ma ON ma.id::text = mc.target_content_id OR ma.moderation_case_id = mc.id
WHERE mc.id = '${caseId}';

SELECT scanner_name, status, labels, user_facing_summary, raw_result_private
FROM media_scanner_results
WHERE media_asset_id IN (
  SELECT ma.id FROM moderation_cases mc
  LEFT JOIN media_assets ma ON ma.id::text = mc.target_content_id OR ma.moderation_case_id = mc.id
  WHERE mc.id = '${caseId}'
)
ORDER BY created_at;
`.trim()

const conn = new Client()
conn.on('ready', () => {
  const cmd = `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
  conn.exec(cmd, (err, stream) => {
    if (err) process.exit(1)
    stream.on('close', (c) => { conn.end(); process.exit(c ?? 0) })
    stream.on('data', (d) => process.stdout.write(d))
    stream.stderr.on('data', (d) => process.stderr.write(d))
  })
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 20000 })
