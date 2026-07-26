import { Client } from 'ssh2'

const password = process.env.SSH_PASSWORD || process.env.SSH_PASS
if (!password) {
  console.error('SSH_PASSWORD required')
  process.exit(1)
}

const assetId = process.argv[2] ?? '1a4eb002-674f-43c7-bff4-199e94aa4d1a'
const publicKey = `media/f222c094-6887-4354-a42a-6b7edf0ec41b/${assetId}.png`
const sql = `SELECT storage_state, public_storage_key, storage_key FROM media_assets WHERE id='${assetId}'`

const conn = new Client()
conn.on('ready', () => {
  const compose =
    'docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml'
  const cmds = [
    `cd /opt/c2k && ${compose} exec -T postgres psql -U c2k -d c2k -c "${sql}"`,
    `cd /opt/c2k && set -a && . ./.env.production && set +a && ${compose} exec -T minio mc stat "local/\${S3_BUCKET:-c2k-uploads}/${publicKey}" 2>&1 || echo MINIO_OBJECT_MISSING`,
    `curl -s -o /dev/null -w 'public_url=%{http_code}\\n' 'https://kink.social/${publicKey}'`,
  ].join(' && echo --- && ')

  conn.exec(cmds, (err, stream) => {
    if (err) process.exit(1)
    stream.on('close', (c) => {
      conn.end()
      process.exit(c ?? 0)
    })
    stream.on('data', (d) => process.stdout.write(d))
    stream.stderr.on('data', (d) => process.stderr.write(d))
  })
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 30000 })
