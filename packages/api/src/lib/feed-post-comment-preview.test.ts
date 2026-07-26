import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  countVisibleComments,
  filterCommentsForViewer,
  pickLatestVisibleCommentPreviews,
  shapeCommentPreview,
  truncateCommentBodyPreview,
} from './feed-post-comment-preview.js'

type TestCommentRow = {
  id: string
  postId: string
  authorId: string
  authorUsername: string
  authorAvatarUrl: string | null
  body: string
  createdAt: string
}

function commentRow(
  id: string,
  authorId: string,
  body: string,
  createdAt: string,
  postId = 'p1',
): TestCommentRow {
  return {
    id,
    postId,
    authorId,
    authorUsername: authorId,
    authorAvatarUrl: null,
    body,
    createdAt,
  }
}

describe('feed post comment preview helpers', () => {
  it('truncates long comment bodies for card preview', () => {
    const body = 'a'.repeat(200)
    const out = truncateCommentBodyPreview(body, 120)
    assert.equal(out.length, 120)
    assert.ok(out.endsWith('…'))
  })

  it('skips comments from blocked authors when picking preview', () => {
    const rows = [
      {
        id: 'c1',
        postId: 'p1',
        authorId: 'blocked-user',
        authorUsername: 'blocked',
        authorAvatarUrl: null,
        body: 'hidden reply',
        createdAt: '2026-06-17T12:00:00.000Z',
      },
      {
        id: 'c2',
        postId: 'p1',
        authorId: 'visible-user',
        authorUsername: 'visible',
        authorAvatarUrl: null,
        body: 'visible reply',
        createdAt: '2026-06-17T11:00:00.000Z',
      },
    ]
    const previews = pickLatestVisibleCommentPreviews(rows, new Set(['blocked-user']))
    assert.equal(previews.size, 1)
    const preview = previews.get('p1')
    assert.ok(preview)
    assert.equal(preview!.id, 'c2')
    assert.equal(preview!.authorUsername, 'visible')
    assert.equal(preview!.bodyPreview, 'visible reply')
  })

  it('returns no preview when only blocked authors commented', () => {
    const rows = [
      {
        id: 'c1',
        postId: 'p1',
        authorId: 'blocked-user',
        authorUsername: 'blocked',
        authorAvatarUrl: null,
        body: 'hidden reply',
        createdAt: '2026-06-17T12:00:00.000Z',
      },
    ]
    const previews = pickLatestVisibleCommentPreviews(rows, new Set(['blocked-user']))
    assert.equal(previews.size, 0)
  })

  it('shapes preview DTO with display name and trimmed body', () => {
    const preview = shapeCommentPreview({
      id: 'c1',
      postId: 'p1',
      authorId: 'u1',
      authorUsername: 'brax',
      authorAvatarUrl: null,
      body: '  hello   world  ',
      createdAt: '2026-06-17T12:00:00.000Z',
    })
    assert.equal(preview.authorDisplayName, 'brax')
    assert.equal(preview.bodyPreview, 'hello world')
  })
})

describe('feed post comment visibility consistency', () => {
  const blockedAuthor = 'blocked-user'
  const hidden = new Set([blockedAuthor])

  it('three comments with one blocked author yields viewer count 2', () => {
    const rows = [
      commentRow('c1', 'visible-1', 'first', '2026-06-17T10:00:00.000Z'),
      commentRow('c2', blockedAuthor, 'hidden', '2026-06-17T11:00:00.000Z'),
      commentRow('c3', 'visible-2', 'third', '2026-06-17T12:00:00.000Z'),
    ]
    assert.equal(countVisibleComments(rows, hidden), 2)
    assert.equal(filterCommentsForViewer(rows, hidden).length, 2)
  })

  it('latest comment from blocked author falls back to next visible preview', () => {
    const rows = [
      commentRow('c2', blockedAuthor, 'hidden latest', '2026-06-17T13:00:00.000Z'),
      commentRow('c3', 'visible-2', 'visible latest', '2026-06-17T12:00:00.000Z'),
      commentRow('c1', 'visible-1', 'older', '2026-06-17T11:00:00.000Z'),
    ]
    const previews = pickLatestVisibleCommentPreviews(rows, hidden)
    assert.equal(previews.size, 1)
    assert.equal(previews.get('p1')?.id, 'c3')
  })

  it('full thread excludes blocked actor comments', () => {
    const rows = [
      commentRow('c1', 'visible-1', 'keep', '2026-06-17T10:00:00.000Z'),
      commentRow('c2', blockedAuthor, 'drop', '2026-06-17T11:00:00.000Z'),
      commentRow('c3', 'visible-2', 'keep too', '2026-06-17T12:00:00.000Z'),
    ]
    const thread = filterCommentsForViewer(rows, hidden)
    assert.deepEqual(
      thread.map((row) => row.id),
      ['c1', 'c3'],
    )
  })

  it('preview id matches latest visible thread comment', () => {
    const rows = [
      commentRow('c1', 'visible-1', 'first', '2026-06-17T10:00:00.000Z'),
      commentRow('c2', blockedAuthor, 'hidden', '2026-06-17T11:00:00.000Z'),
      commentRow('c3', 'visible-2', 'latest visible', '2026-06-17T12:00:00.000Z'),
    ]
    const thread = filterCommentsForViewer(rows, hidden)
    const previews = pickLatestVisibleCommentPreviews([...rows].reverse(), hidden)
    const preview = previews.get('p1')
    assert.ok(preview)
    assert.equal(preview!.id, thread.at(-1)?.id)
  })

  it('blocked in either direction hides comment via hiddenAuthorIds union', () => {
    const viewerBlockedAuthor = new Set(['author-viewer-blocked'])
    const authorBlockedViewer = new Set(['author-who-blocked-viewer'])
    const rows = [
      commentRow('c1', 'author-viewer-blocked', 'viewer blocked them', '2026-06-17T10:00:00.000Z'),
      commentRow('c2', 'author-who-blocked-viewer', 'they blocked viewer', '2026-06-17T11:00:00.000Z'),
      commentRow('c3', 'visible', 'ok', '2026-06-17T12:00:00.000Z'),
    ]
    assert.equal(filterCommentsForViewer(rows, viewerBlockedAuthor).length, 2)
    assert.equal(filterCommentsForViewer(rows, authorBlockedViewer).length, 2)
    const both = new Set([...viewerBlockedAuthor, ...authorBlockedViewer])
    assert.equal(countVisibleComments(rows, both), 1)
  })

  it('no visible comments yields no preview and count 0', () => {
    const rows = [commentRow('c1', blockedAuthor, 'only blocked', '2026-06-17T10:00:00.000Z')]
    assert.equal(countVisibleComments(rows, hidden), 0)
    assert.equal(pickLatestVisibleCommentPreviews(rows, hidden).size, 0)
    assert.equal(filterCommentsForViewer(rows, hidden).length, 0)
  })

  it('comment count does not leak blocked comments', () => {
    const rows = [
      commentRow('c1', blockedAuthor, 'hidden 1', '2026-06-17T10:00:00.000Z'),
      commentRow('c2', blockedAuthor, 'hidden 2', '2026-06-17T11:00:00.000Z'),
      commentRow('c3', 'visible', 'visible only', '2026-06-17T12:00:00.000Z'),
    ]
    assert.equal(countVisibleComments(rows, hidden), 1)
    assert.notEqual(rows.length, countVisibleComments(rows, hidden))
  })
})
