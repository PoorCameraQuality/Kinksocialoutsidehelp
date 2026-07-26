import { eq } from 'drizzle-orm'
import { finalizeMediaAfterAttestation } from './dist/lib/media-pipeline.js'
import { db, schema } from './dist/db/index.js'

const id = process.argv[2] ?? 'b4ffcf01-29b9-4ee2-b070-2e4973d5ad0d'
const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id)).limit(1)
if (!asset) {
  console.log('missing asset')
  process.exit(1)
}
const pipeline = await finalizeMediaAfterAttestation({
  mediaAssetId: id,
  userId: asset.uploaderUserId,
  lane: 'GREEN',
  uploadStatus: 'AUTO_APPROVED',
})
console.log(JSON.stringify(pipeline, null, 2))
