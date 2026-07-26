import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canViewerReadIsoVisibility,
  conversationIncludedInFolder,
  isConventionIsoBoardEnabled,
  isIsoInboxThreadForViewer,
  isoEligibleForConventionBoard,
} from './iso-access.js'
import { putMeIsoBodySchema } from './iso-validation.js'

describe('isConventionIsoBoardEnabled', () => {
  it('defaults to enabled', () => {
    assert.equal(isConventionIsoBoardEnabled(undefined), true)
    assert.equal(isConventionIsoBoardEnabled({}), true)
  })
  it('respects explicit false', () => {
    assert.equal(isConventionIsoBoardEnabled({ isoBoardEnabled: false }), false)
  })
})

describe('canViewerReadIsoVisibility', () => {
  it('owner always sees', () => {
    assert.equal(canViewerReadIsoVisibility('PRIVATE', { viewerId: null, isOwner: true }), true)
  })
  it('private hides from others', () => {
    assert.equal(canViewerReadIsoVisibility('PRIVATE', { viewerId: 'u1', isOwner: false }), false)
  })
  it('public shows to anonymous', () => {
    assert.equal(canViewerReadIsoVisibility('PUBLIC', { viewerId: null, isOwner: false }), true)
  })
  it('members requires login', () => {
    assert.equal(canViewerReadIsoVisibility('MEMBERS', { viewerId: null, isOwner: false }), false)
    assert.equal(canViewerReadIsoVisibility('MEMBERS', { viewerId: 'u1', isOwner: false }), true)
  })
})

describe('isoEligibleForConventionBoard', () => {
  it('hides private from board except owner preview', () => {
    assert.equal(isoEligibleForConventionBoard('PRIVATE', { viewerId: 'x', isOwner: false }), false)
    assert.equal(isoEligibleForConventionBoard('PRIVATE', { viewerId: 'x', isOwner: true }), true)
  })
})

describe('isIsoInboxThreadForViewer', () => {
  it('matches ISO entry point and subject equals viewer', () => {
    assert.equal(isIsoInboxThreadForViewer('iso', 'u-recipient', 'u-recipient'), true)
    assert.equal(isIsoInboxThreadForViewer('iso', 'u-other', 'u-recipient'), false)
    assert.equal(isIsoInboxThreadForViewer(null, 'u-recipient', 'u-recipient'), false)
  })
})

describe('conversationIncludedInFolder', () => {
  it('keeps ISO threads out of main and requests', () => {
    assert.equal(
      conversationIncludedInFolder('main', { isPendingIncomingDmRequest: false, isIsoInboxForViewer: true }),
      false,
    )
    assert.equal(
      conversationIncludedInFolder('requests', { isPendingIncomingDmRequest: true, isIsoInboxForViewer: true }),
      false,
    )
    assert.equal(
      conversationIncludedInFolder('iso', { isPendingIncomingDmRequest: false, isIsoInboxForViewer: true }),
      true,
    )
  })
  it('routes pending incoming DMs to requests not main', () => {
    assert.equal(
      conversationIncludedInFolder('main', { isPendingIncomingDmRequest: true, isIsoInboxForViewer: false }),
      false,
    )
    assert.equal(
      conversationIncludedInFolder('requests', { isPendingIncomingDmRequest: true, isIsoInboxForViewer: false }),
      true,
    )
  })
})

describe('putMeIsoBodySchema', () => {
  it('accepts three image URLs', () => {
    const r = putMeIsoBodySchema.safeParse({
      body: 'hello',
      visibility: 'PUBLIC',
      acceptDmsViaIso: true,
      images: ['https://a.example/x.jpg', 'https://b.example/y.jpg', 'https://c.example/z.jpg'],
    })
    assert.equal(r.success, true)
  })
  it('rejects fourth image', () => {
    const r = putMeIsoBodySchema.safeParse({
      body: 'x',
      visibility: 'MEMBERS',
      acceptDmsViaIso: false,
      images: [
        'https://a.example/1.jpg',
        'https://a.example/2.jpg',
        'https://a.example/3.jpg',
        'https://a.example/4.jpg',
      ],
    })
    assert.equal(r.success, false)
  })
  it('rejects body over cap', () => {
    const r = putMeIsoBodySchema.safeParse({
      body: 'x'.repeat(12_001),
      visibility: 'PUBLIC',
      acceptDmsViaIso: false,
      images: [],
    })
    assert.equal(r.success, false)
  })
})
