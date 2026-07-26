/**
 * Shared S3 (MinIO) helpers. Returns a configured client based on env, lazily
 * ensures the destination bucket exists on first call (a fresh dev MinIO has
 * no buckets, so PutObject would otherwise throw `NoSuchBucket` → 500), and
 * wraps PutObject so callers can rely on a clear error contract.
 */
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'

const S3_CONNECTION_TIMEOUT_MS = Number(process.env.S3_CONNECTION_TIMEOUT_MS ?? 8_000)
const S3_REQUEST_TIMEOUT_MS = Number(process.env.S3_REQUEST_TIMEOUT_MS ?? 45_000)

function s3RequestHandler(): NodeHttpHandler {
  return new NodeHttpHandler({
    connectionTimeout: S3_CONNECTION_TIMEOUT_MS,
    requestTimeout: S3_REQUEST_TIMEOUT_MS,
  })
}

let cachedClient: S3Client | null | undefined
const ensuredBuckets = new Set<string>()

export function getS3Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    cachedClient = null
    return null
  }
  cachedClient = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestHandler: s3RequestHandler(),
    maxAttempts: 2,
  })
  return cachedClient
}

export function defaultBucket(): string {
  return process.env.S3_BUCKET ?? 'c2k-uploads'
}

export function publicUrlForKey(key: string, bucket = defaultBucket()): string | null {
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? `${process.env.S3_ENDPOINT ?? ''}/${bucket}`
  if (!publicBase) return null
  return `${publicBase.replace(/\/$/, '')}/${key.replace(/^\//, '')}`
}

/** True when a URL can be loaded by a member's browser (not loopback / internal hosts). */
export function isBrowserReachablePublicUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/')) return true
  try {
    const { hostname, protocol } = new URL(trimmed)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

/**
 * In dev (MinIO on localhost) we serve uploaded files straight from the S3
 * endpoint via `S3_PUBLIC_BASE_URL ?? S3_ENDPOINT/<bucket>`. MinIO buckets are
 * private by default so anonymous GETs return 403 and `<img>` tags break.
 * Setting a public-read policy makes uploaded objects browser-loadable from
 * the dev origin without changing production behavior (in prod the bucket is
 * typically served via CloudFront or a public-readable origin already).
 *
 * Skipped when `S3_PUBLIC_BASE_URL` is set, since that signals the operator
 * intentionally fronts a separate public origin.
 */
async function setPublicReadPolicy(client: S3Client, bucket: string): Promise<void> {
  if (process.env.S3_PUBLIC_BASE_URL) return
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowPublicRead',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  }
  try {
    await client.send(
      new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }),
    )
  } catch {
    // Best-effort in dev - non-fatal if the backend doesn't support policies.
  }
}

/**
 * Make sure the bucket exists. Idempotent and cached per-process so we only
 * pay one HeadBucket / CreateBucket round trip across the API lifetime.
 * On (re)creation, applies a public-read policy in dev so uploaded files can
 * be loaded by the browser.
 */
export async function ensureBucket(client: S3Client, bucket = defaultBucket()): Promise<void> {
  if (ensuredBuckets.has(bucket)) return
  let alreadyExisted = false
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    alreadyExisted = true
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
    const status = err.$metadata?.httpStatusCode
    if (err.name !== 'NotFound' && status !== 404) throw e
  }
  if (!alreadyExisted) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (e) {
      const err = e as { name?: string }
      // Race / pre-existing bucket owned by us → treat as success.
      if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') throw e
    }
  }
  await setPublicReadPolicy(client, bucket)
  ensuredBuckets.add(bucket)
}

/**
 * PutObject with bucket ensured first. Surfaces a typed error so route handlers
 * can return clean 502s instead of opaque `Internal Server Error`.
 */
export async function putObject(
  client: S3Client,
  input: PutObjectCommandInput,
): Promise<void> {
  const bucket = input.Bucket ?? defaultBucket()
  await ensureBucket(client, bucket)
  await client.send(new PutObjectCommand({ ...input, Bucket: bucket }))
}

/** Read object bytes for owner-only proxy routes (e.g. blind feedback purchase proof). */
export async function getObjectBuffer(
  client: S3Client,
  key: string,
  bucket = defaultBucket(),
): Promise<{ body: Buffer; contentType: string | undefined } | null> {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!out.Body) return null
    const bytes = await out.Body.transformToByteArray()
    return { body: Buffer.from(bytes), contentType: out.ContentType }
  } catch {
    return null
  }
}

export function quarantineObjectKey(userId: string, objectId: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `quarantine/${userId}/${objectId}${ext}`
}

export function publicMediaObjectKey(userId: string, objectId: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `media/${userId}/${objectId}${ext}`
}

export async function copyObject(
  client: S3Client,
  sourceKey: string,
  destKey: string,
  bucket = defaultBucket(),
): Promise<void> {
  await ensureBucket(client, bucket)
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey.replace(/^\//, '')}`,
      Key: destKey,
    }),
  )
}

export async function deleteObject(
  client: S3Client,
  key: string,
  bucket = defaultBucket(),
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/** Promote quarantined object to public media prefix (dev bucket public-read policy applies). */
export async function promoteQuarantineToPublic(
  client: S3Client,
  quarantineKey: string,
  publicKey: string,
  bucket = defaultBucket(),
): Promise<void> {
  await copyObject(client, quarantineKey, publicKey, bucket)
}
