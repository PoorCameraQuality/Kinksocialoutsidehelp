import { HeadBucketCommand, ListBucketsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const bucket = process.env.S3_BUCKET ?? 'c2k-uploads';
const key = `smoke/test-${Date.now()}.txt`;

const buckets = await client.send(new ListBucketsCommand({}));
console.log('buckets:', buckets.Buckets?.map((b) => b.Name).join(', '));
await client.send(new HeadBucketCommand({ Bucket: bucket }));
await client.send(
  new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'c2k-s3-smoke', ContentType: 'text/plain' }),
);
const publicUrl = `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '')}/${key}`;
console.log('put_ok:', key);
console.log('public_url:', publicUrl);
