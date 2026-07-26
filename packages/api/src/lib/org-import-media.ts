/**
 * Fetch remote images and rehost under organizations/{orgId}/ on S3 for org import scripts.
 */
import { randomUUID } from 'node:crypto'
import { defaultBucket, getS3Client, isBrowserReachablePublicUrl, publicUrlForKey, putObject } from './s3-upload.js'
import { fetchSafeOutboundUrl } from './safe-outbound-url.js'

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.endsWith('.jpeg') || path.endsWith('.jpg')) return '.jpg'
    if (path.endsWith('.png')) return '.png'
    if (path.endsWith('.webp')) return '.webp'
    if (path.endsWith('.gif')) return '.gif'
  } catch {
    /* ignore */
  }
  return '.jpg'
}

function normalizeSourceUrl(url: string, width = 1500): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes('images.squarespace-cdn.com') && !trimmed.includes('format=')) {
    const sep = trimmed.includes('?') ? '&' : '?'
    return `${trimmed}${sep}format=${width}w`
  }
  return trimmed
}

/** Download a public image and upload to S3; falls back to the source URL when S3 is unavailable. */
export async function rehostOrgImportImage(params: {
  orgId: string
  assetName: string
  sourceUrl: string
  width?: number
}): Promise<string | null> {
  const sourceUrl = normalizeSourceUrl(params.sourceUrl, params.width ?? 1500)
  if (!sourceUrl) return null

  const client = getS3Client()
  if (!client) {
    if (isBrowserReachablePublicUrl(sourceUrl)) return sourceUrl
    console.warn(`S3 not configured and source URL may be unreachable: ${sourceUrl}`)
    return sourceUrl
  }

  // PR 3 (M7): SSRF guard — https-only, no private/metadata hosts,
  // redirects re-validated hop by hop instead of followed blindly.
  const res = await fetchSafeOutboundUrl(sourceUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: HTTP ${res.status}`)
  }
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  const ext = IMAGE_EXT[contentType] ?? extFromUrl(sourceUrl)
  const body = Buffer.from(await res.arrayBuffer())
  if (body.length === 0) throw new Error(`Empty response from ${sourceUrl}`)

  const bucket = defaultBucket()
  const key = `organizations/${params.orgId}/${params.assetName}-${randomUUID()}${ext}`
  await putObject(client, {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'image/jpeg',
  })
  const publicUrl = publicUrlForKey(key, bucket)
  if (!publicUrl) throw new Error('Upload succeeded but S3_PUBLIC_BASE_URL is not configured')
  return publicUrl
}
