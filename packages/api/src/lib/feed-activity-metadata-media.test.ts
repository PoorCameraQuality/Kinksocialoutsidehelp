import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeFeedActivityMetadataForViewer } from './feed-media-attachments.js'

describe('sanitizeFeedActivityMetadataForViewer', () => {
  it('strips raw location from event activity metadata', async () => {
    const meta = { type: 'event', id: 'e1', title: 'Rope Weekend', location: 'Baltimore' }
    const out = await sanitizeFeedActivityMetadataForViewer('viewer-1', meta, {
      verb: 'event_rsvp',
      objectType: 'event',
      objectId: 'e1',
    })
    assert.equal(out.title, 'Rope Weekend')
    assert.equal(out.location, 'Baltimore')
    assert.equal(out.previewUrls, undefined)
  })

  it('keeps public static imageUrl for event_created', async () => {
    const meta = { imageUrl: '/landing/sonny-ravesteijn-nQeR7JIGpOk.jpg', title: 'Fest' }
    const out = await sanitizeFeedActivityMetadataForViewer(null, meta, {
      verb: 'event_created',
      objectType: 'event',
      objectId: 'e1',
    })
    assert.equal(out.imageUrl, '/landing/sonny-ravesteijn-nQeR7JIGpOk.jpg')
  })

  it('re-hydrates reaction previews from post attachments only', async () => {
    const meta = {
      type: 'feed_post',
      id: 'post-1',
      previewUrls: ['https://leaked.example.com/secret.jpg'],
      postAuthorUsername: 'alice',
    }
    const out = await sanitizeFeedActivityMetadataForViewer(
      'viewer-1',
      meta,
      { verb: 'loved', objectType: 'feed_post', objectId: 'post-1' },
      ['/api/v1/media/assets/00000000-0000-4000-8000-000000000099/content'],
    )
    assert.deepEqual(out.previewUrls, [
      '/api/v1/media/assets/00000000-0000-4000-8000-000000000099/content',
    ])
    assert.equal(out.previewUrls?.includes('https://leaked.example.com/secret.jpg'), false)
  })

  it('omits reaction previews when post has no visible attachments', async () => {
    const meta = {
      type: 'feed_post',
      id: 'post-1',
      previewUrls: ['https://leaked.example.com/secret.jpg'],
    }
    const out = await sanitizeFeedActivityMetadataForViewer(
      'viewer-1',
      meta,
      { verb: 'reacted', objectType: 'feed_post', objectId: 'post-1' },
      [],
    )
    assert.equal(out.previewUrls, undefined)
    assert.equal(out.thumbnailUrl, undefined)
  })

  it('strips unknown external preview URLs for sensitive upload activities', async () => {
    const meta = { previewUrls: ['https://cdn.example.com/private-upload.jpg'] }
    const out = await sanitizeFeedActivityMetadataForViewer(null, meta, {
      verb: 'uploaded_picture',
      objectType: 'feed_post',
      objectId: 'post-1',
    })
    assert.equal(out.previewUrls, undefined)
  })
})
