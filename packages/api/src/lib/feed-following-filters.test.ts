import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bucketForActivity,
  bucketForPost,
  matchesFollowingFilter,
  postHasPhotoContent,
  postHasVideoContent,
  REACTION_VERBS,
  EVENT_VERBS,
  GROUP_VERBS,
} from './feed-following-filters.js'

describe('matchesFollowingFilter', () => {
  const hide = new Set<string>()

  it('includes posts in all and posts filters', () => {
    assert.equal(matchesFollowingFilter('post', 'all', hide, { postKind: 'status' }), true)
    assert.equal(matchesFollowingFilter('post', 'posts', hide, { postKind: 'status' }), true)
    assert.equal(matchesFollowingFilter('post', 'reactions', hide, { postKind: 'status' }), false)
  })

  it('respects hideStoryTypes on posts', () => {
    const hidden = new Set(['repost'])
    assert.equal(matchesFollowingFilter('post', 'all', hidden, { postKind: 'repost' }), false)
  })

  it('respects hideStoryTypes on activities', () => {
    const hidden = new Set(['event_rsvp'])
    assert.equal(matchesFollowingFilter('activity', 'all', hidden, { verb: 'event_rsvp' }), false)
    assert.equal(matchesFollowingFilter('activity', 'events', hidden, { verb: 'event_created' }), true)
  })

  it('maps activity verbs to filter buckets', () => {
    assert.equal(
      matchesFollowingFilter('activity', 'reactions', hide, { verb: 'connection_accepted', objectType: 'connection' }),
      true,
    )
    assert.equal(
      matchesFollowingFilter('activity', 'reactions', hide, { verb: 'loved', objectType: 'feed_post' }),
      true,
    )
    assert.equal(
      matchesFollowingFilter('activity', 'reactions', hide, { verb: 'followed', objectType: 'user' }),
      true,
    )
    assert.equal(
      matchesFollowingFilter('activity', 'events', hide, { verb: 'convention_pin', objectType: 'convention' }),
      true,
    )
    assert.equal(
      matchesFollowingFilter('activity', 'groups', hide, { verb: 'org_join', objectType: 'organization' }),
      true,
    )
    assert.equal(
      matchesFollowingFilter('activity', 'posts', hide, { verb: 'connection_accepted', objectType: 'connection' }),
      false,
    )
  })

  it('skips duplicate post activities', () => {
    assert.equal(matchesFollowingFilter('activity', 'all', hide, { verb: 'post', objectType: 'feed_post' }), false)
  })

  it('filters posts by media type', () => {
    const imagePost = {
      postKind: 'status',
      attachments: [{ type: 'image', url: 'https://example.com/a.jpg' }],
    }
    const articlePost = { postKind: 'article', body: 'Long read' }
    const videoPost = {
      postKind: 'status',
      bodyFormat: 'html',
      body: '<iframe src="https://www.youtube.com/embed/x"></iframe>',
    }

    assert.equal(matchesFollowingFilter('post', 'photos', hide, imagePost), true)
    assert.equal(matchesFollowingFilter('post', 'articles', hide, articlePost), true)
    assert.equal(matchesFollowingFilter('post', 'video', hide, videoPost), true)
    assert.equal(matchesFollowingFilter('post', 'photos', hide, videoPost), false)
    assert.equal(matchesFollowingFilter('post', 'photos', hide, articlePost), false)
    assert.equal(matchesFollowingFilter('post', 'posts', hide, imagePost), true)
    assert.equal(matchesFollowingFilter('activity', 'photos', hide, { verb: 'event_rsvp' }), false)
  })
})

describe('postHasPhotoContent', () => {
  it('detects image attachments and inline img tags', () => {
    assert.equal(
      postHasPhotoContent({ postKind: 'status', attachments: [{ type: 'image', url: 'https://x/y.jpg' }] }),
      true,
    )
    assert.equal(postHasPhotoContent({ postKind: 'status', bodyFormat: 'html', body: '<p><img src="/a.jpg" /></p>' }), true)
    assert.equal(postHasPhotoContent({ postKind: 'article' }), false)
    assert.equal(postHasPhotoContent({ postKind: 'repost' }), false)
  })
})

describe('postHasVideoContent', () => {
  it('detects video embeds', () => {
    assert.equal(
      postHasVideoContent({
        postKind: 'status',
        bodyFormat: 'html',
        body: '<a href="https://youtu.be/abc">watch</a>',
      }),
      true,
    )
    assert.equal(postHasVideoContent({ postKind: 'status', body: 'plain text' }), false)
  })
})

describe('bucketForActivity', () => {
  it('classifies known verbs', () => {
    for (const v of REACTION_VERBS) assert.equal(bucketForActivity(v), 'reactions')
    for (const v of EVENT_VERBS) assert.equal(bucketForActivity(v), 'events')
    for (const v of GROUP_VERBS) assert.equal(bucketForActivity(v), 'groups')
  })
})

describe('bucketForPost', () => {
  it('classifies post media buckets', () => {
    assert.equal(bucketForPost({ postKind: 'article' }), 'articles')
    assert.equal(
      bucketForPost({ postKind: 'status', attachments: [{ type: 'image', url: 'https://x/y.jpg' }] }),
      'photos',
    )
    assert.equal(
      bucketForPost({ postKind: 'status', bodyFormat: 'html', body: 'https://vimeo.com/123' }),
      'video',
    )
    assert.equal(bucketForPost({ postKind: 'status', body: 'hello' }), null)
  })
})
