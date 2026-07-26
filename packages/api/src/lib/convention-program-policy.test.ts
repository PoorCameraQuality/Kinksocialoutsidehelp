import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPublicProgramListing, filterSlotsForPublicProgram, slotVisibleOnPublicProgram } from './convention-program-policy.js'

describe('isPublicProgramListing', () => {
  it('defaults to public when settings missing', () => {
    assert.equal(isPublicProgramListing(undefined), true)
    assert.equal(isPublicProgramListing(null), true)
    assert.equal(isPublicProgramListing({}), true)
  })

  it('is public when publicProgramListing is true or other flags without explicit false', () => {
    assert.equal(isPublicProgramListing({ publicProgramListing: true }), true)
    assert.equal(isPublicProgramListing({ isoBoardEnabled: true }), true)
  })

  it('is non-public only when explicitly false', () => {
    assert.equal(isPublicProgramListing({ publicProgramListing: false }), false)
  })
})

describe('slotVisibleOnPublicProgram', () => {
  it('excludes unpublished slots for all viewers', () => {
    assert.equal(slotVisibleOnPublicProgram({ isPublished: false, visibility: 'ATTENDEE' }, 'anonymous'), false)
    assert.equal(slotVisibleOnPublicProgram({ isPublished: false, visibility: 'ATTENDEE' }, 'staff'), false)
  })

  it('includes published attendee slots for anonymous and attendee', () => {
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'ATTENDEE' }, 'anonymous'), true)
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'PUBLIC' }, 'attendee'), true)
  })

  it('excludes staff-only and secret slots for anonymous/attendee', () => {
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'STAFF' }, 'anonymous'), false)
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'SECRET' }, 'attendee'), false)
  })

  it('allows staff viewer to see staff slots but not secret', () => {
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'STAFF' }, 'staff'), true)
    assert.equal(slotVisibleOnPublicProgram({ isPublished: true, visibility: 'SECRET' }, 'staff'), false)
  })
})

describe('filterSlotsForPublicProgram', () => {
  it('returns only published public-facing slots for anonymous', () => {
    const slots = [
      { id: '1', isPublished: true, visibility: 'ATTENDEE' },
      { id: '2', isPublished: false, visibility: 'ATTENDEE' },
      { id: '3', isPublished: true, visibility: 'STAFF' },
    ]
    const out = filterSlotsForPublicProgram(slots, 'anonymous')
    assert.equal(out.length, 1)
    assert.equal(out[0]?.id, '1')
  })
})
