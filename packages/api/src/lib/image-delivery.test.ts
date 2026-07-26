import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  buildImgproxyProcessingSegment,
  buildSignedImgproxyUrl,
  isAllowedImgproxySource,
  loadImgproxyConfig,
  resetImgproxyConfigCache,
} from './imgproxy.js'
import {
  deliverAvatarUrl,
  deliverCardImageUrl,
  deliverFeedImageUrl,
  deliverImageUrl,
  getImageVariantProcessing,
  IMAGE_VARIANTS,
} from './image-delivery.js'

const S3_PUBLIC = 'https://cdn.example.test/c2k-uploads'

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    prev[key] = process.env[key]
    const value = overrides[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetImgproxyConfigCache()
  try {
    fn()
  } finally {
    for (const key of Object.keys(overrides)) {
      const value = prev[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetImgproxyConfigCache()
  }
}

describe('imgproxy config', () => {
  afterEach(() => resetImgproxyConfigCache())

  test('disabled by default returns original behavior via deliverImageUrl', () => {
    withEnv({ IMGPROXY_ENABLED: 'false' }, () => {
      const src = `${S3_PUBLIC}/media/user/photo.jpg`
      assert.equal(deliverImageUrl(src, 'card_md'), src)
    })
  })

  test('enabled without key/salt fails closed unless unsigned allowed', () => {
    withEnv(
      {
        IMGPROXY_ENABLED: 'true',
        IMGPROXY_BASE_URL: 'http://127.0.0.1:8080',
        S3_PUBLIC_BASE_URL: S3_PUBLIC,
      },
      () => {
        const cfg = loadImgproxyConfig(true)
        assert.equal(cfg.operational, false)
        const src = `${S3_PUBLIC}/media/user/photo.jpg`
        assert.equal(deliverImageUrl(src, 'card_md'), src)
      },
    )
  })

  test('enabled with key/salt generates signed URL', () => {
    withEnv(
      {
        IMGPROXY_ENABLED: 'true',
        IMGPROXY_BASE_URL: 'http://127.0.0.1:8080',
        IMGPROXY_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IMGPROXY_SALT: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        S3_PUBLIC_BASE_URL: S3_PUBLIC,
      },
      () => {
        const src = `${S3_PUBLIC}/media/user/photo.jpg`
        const out = deliverCardImageUrl(src)
        assert.ok(out)
        assert.match(out!, /^http:\/\/127\.0\.0\.1:8080\/[0-9a-f]{64}\//)
        assert.match(out!, /\/plain\//)
      },
    )
  })

  test('unsigned mode only when explicitly allowed', () => {
    withEnv(
      {
        IMGPROXY_ENABLED: 'true',
        IMGPROXY_BASE_URL: 'http://127.0.0.1:8080',
        IMGPROXY_ALLOW_UNSIGNED: 'true',
        S3_PUBLIC_BASE_URL: S3_PUBLIC,
      },
      () => {
        const src = `${S3_PUBLIC}/media/user/photo.jpg`
        const out = deliverFeedImageUrl(src)
        assert.ok(out?.includes('/insecure/'))
      },
    )
  })
})

describe('imgproxy source allowlist', () => {
  afterEach(() => resetImgproxyConfigCache())

  test('rejects auth-gated media proxy paths', () => {
    withEnv({ S3_PUBLIC_BASE_URL: S3_PUBLIC }, () => {
      assert.equal(
        isAllowedImgproxySource('/api/v1/media/assets/550e8400-e29b-41d4-a716-446655440000/content'),
        false,
      )
    })
  })

  test('rejects arbitrary external URLs', () => {
    withEnv({ S3_PUBLIC_BASE_URL: S3_PUBLIC }, () => {
      assert.equal(isAllowedImgproxySource('https://evil.example/steal.jpg'), false)
      assert.equal(isAllowedImgproxySource('https://picsum.photos/seed/demo/640/480'), false)
    })
  })

  test('allows configured storage host', () => {
    withEnv({ S3_PUBLIC_BASE_URL: S3_PUBLIC }, () => {
      assert.equal(isAllowedImgproxySource(`${S3_PUBLIC}/media/user/photo.jpg`), true)
    })
  })
})

describe('image variant registry', () => {
  test('all variants produce processing segments', () => {
    for (const name of Object.keys(IMAGE_VARIANTS) as Array<keyof typeof IMAGE_VARIANTS>) {
      const processing = getImageVariantProcessing(name)
      assert.ok(processing.length > 0)
      assert.match(processing, /q:\d+/)
    }
  })

  test('avatar sizes map to fill crops', () => {
    assert.match(getImageVariantProcessing('avatar_sm'), /rs:fill:64:64:0/)
    assert.match(getImageVariantProcessing('avatar_lg'), /rs:fill:256:256:0/)
  })

  test('deliverAvatarUrl uses size mapping', () => {
    withEnv({ IMGPROXY_ENABLED: 'false' }, () => {
      const src = `${S3_PUBLIC}/avatars/a.jpg`
      assert.equal(deliverAvatarUrl(src, 'sm'), src)
    })
  })
})

describe('buildSignedImgproxyUrl', () => {
  afterEach(() => resetImgproxyConfigCache())

  test('buildImgproxyProcessingSegment respects max width default', () => {
    const segment = buildImgproxyProcessingSegment(['w:320'], {
      defaultQuality: 82,
      maxWidth: 2400,
    })
    assert.match(segment, /w:320/)
    assert.match(segment, /q:82/)
  })

  test('does not sign disallowed sources', () => {
    withEnv(
      {
        IMGPROXY_ENABLED: 'true',
        IMGPROXY_BASE_URL: 'http://127.0.0.1:8080',
        IMGPROXY_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IMGPROXY_SALT: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        S3_PUBLIC_BASE_URL: S3_PUBLIC,
      },
      () => {
        const cfg = loadImgproxyConfig(true)
        assert.equal(
          buildSignedImgproxyUrl('https://attacker.example/x.jpg', getImageVariantProcessing('card_md'), cfg),
          null,
        )
      },
    )
  })
})
