import { Client } from 'ssh2'

const password = process.env.SSH_PASSWORD
const assetId = process.argv[2] ?? 'b4ffcf01-29b9-4ee2-b070-2e4973d5ad0d'
if (!password) process.exit(1)

const js = `
import { eq } from 'drizzle-orm';
import { finalizeMediaAfterAttestation } from './dist/lib/media-pipeline.js';
import { db, schema } from './dist/db/index.js';
const id = '${assetId}';
const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id)).limit(1);
if (!asset) { console.log('missing asset'); process.exit(1); }
const pipeline = await finalizeMediaAfterAttestation({
  mediaAssetId: id,
  userId: asset.uploaderUserId,
  lane: 'GREEN',
  uploadStatus: 'AUTO_APPROVED',
});
console.log(JSON.stringify(pipeline, null, 2));
`.trim()

const cmd = `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T api node --input-type=module -e ${JSON.stringify(js)}`

const conn = new Client()
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) process.exit(1)
    stream.on('close', (c) => { conn.end(); process.exit(c ?? 0) })
    stream.on('data', (d) => process.stdout.write(d))
    stream.stderr.on('data', (d) => process.stderr.write(d))
  })
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 20000 })
