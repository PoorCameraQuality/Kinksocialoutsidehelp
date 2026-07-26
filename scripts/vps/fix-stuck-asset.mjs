import { Client } from 'ssh2'

const password = process.env.SSH_PASSWORD
const assetId = process.argv[2] ?? 'b4ffcf01-29b9-4ee2-b070-2e4973d5ad0d'
if (!password) process.exit(1)

const sql = `UPDATE media_assets SET upload_status = 'AUTO_APPROVED', scan_status = 'PASSED', storage_state = 'APPROVED_PUBLIC', updated_at = NOW() WHERE id = '${assetId}' RETURNING id, upload_status, scan_status, storage_state`

const conn = new Client()
conn.on('ready', () => {
  conn.exec(
    `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql}"`,
    (err, stream) => {
      if (err) process.exit(1)
      stream.on('close', (c) => { conn.end(); process.exit(c ?? 0) })
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
    },
  )
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 20000 })
