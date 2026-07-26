import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { defaultBucket, getS3Client } from './s3-upload.js'

export type StorageHealthResult = {
  ok: boolean
  s3: 'ok' | 'error' | 'skipped'
  bucket?: string
  latencyMs?: number
  issues?: string[]
}

/** Non-destructive S3 bucket reachability check (HeadBucket only). */
export async function storageHealthDiagnostic(): Promise<StorageHealthResult> {
  const endpoint = process.env.S3_ENDPOINT?.trim()
  if (!endpoint) {
    return { ok: true, s3: 'skipped' }
  }

  const client = getS3Client()
  if (!client) {
    return {
      ok: false,
      s3: 'error',
      issues: ['S3 endpoint configured but credentials are missing'],
    }
  }

  const bucket = defaultBucket()
  const started = Date.now()
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return { ok: true, s3: 'ok', bucket, latencyMs: Date.now() - started }
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
    const issues = [
      err.name
        ? `HeadBucket failed (${err.name}${err.$metadata?.httpStatusCode ? ` HTTP ${err.$metadata.httpStatusCode}` : ''})`
        : 'HeadBucket failed',
    ]
    return { ok: false, s3: 'error', bucket, latencyMs: Date.now() - started, issues }
  }
}
