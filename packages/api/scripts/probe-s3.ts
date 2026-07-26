/**
 * One-shot diagnostic: connect to the local S3 (MinIO) using the same env vars
 * the API server reads, and report bucket reachability + a tiny PutObject.
 *
 *   npx tsx packages/api/scripts/probe-s3.ts
 */
import '../src/db/load-dev-env.js'
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

async function main() {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  const bucket = process.env.S3_BUCKET ?? 'c2k-uploads'
  console.log('Env:', { endpoint, bucket, hasKey: !!accessKeyId, hasSecret: !!secretAccessKey })
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.log('Missing S3 env — exiting.')
    return
  }
  const client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    console.log(`HeadBucket OK — '${bucket}' exists.`)
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number }; message?: string }
    console.log(`HeadBucket FAILED — name=${err.name} http=${err.$metadata?.httpStatusCode} msg=${err.message}`)
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Attempting CreateBucket '${bucket}'…`)
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }))
        console.log('CreateBucket OK.')
      } catch (e2) {
        const err2 = e2 as { name?: string; message?: string }
        console.log(`CreateBucket FAILED — name=${err2.name} msg=${err2.message}`)
        return
      }
    } else {
      return
    }
  }
  try {
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
    await client.send(
      new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }),
    )
    console.log('PutBucketPolicy OK — anonymous GetObject allowed.')
  } catch (e) {
    const err = e as { name?: string; message?: string }
    console.log(`PutBucketPolicy FAILED — name=${err.name} msg=${err.message}`)
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `probe/${Date.now()}.txt`,
        Body: Buffer.from('probe'),
        ContentType: 'text/plain',
      }),
    )
    console.log('PutObject OK.')
  } catch (e) {
    const err = e as { name?: string; message?: string }
    console.log(`PutObject FAILED — name=${err.name} msg=${err.message}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
