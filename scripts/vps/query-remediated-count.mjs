import { Client } from 'ssh2'

const password = process.env.SSH_PASSWORD || process.env.SSH_PASS
if (!password) process.exit(1)

const sql =
  "SELECT count(*) FROM media_assets WHERE storage_state = 'VALIDATED_PRIVATE' AND public_storage_key IS NULL AND source_surface = 'profile_gallery' AND storage_key LIKE 'quarantine/%'"

const conn = new Client()
conn.on('ready', () => {
  conn.exec(
    `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql}"`,
    (err, stream) => {
      if (err) process.exit(1)
      stream.on('close', (c) => {
        conn.end()
        process.exit(c ?? 0)
      })
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
    },
  )
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 30000 })
