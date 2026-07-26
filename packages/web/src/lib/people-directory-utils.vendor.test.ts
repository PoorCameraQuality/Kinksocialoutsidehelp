import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MockPerson } from '../data/types.ts'
import {
  getPersonCommunityBadges,
  personMatchesCommunityRoleFilter,
} from './people-directory-utils.ts'

function person(partial: Partial<MockPerson>): MockPerson {
  return {
    id: 'u1',
    username: 'maker',
    roles: [],
    trustScore: 0,
    trustTier: 'bronze',
    verified: false,
    mutualCount: 0,
    distance: '',
    ...partial,
  }
}

describe('People Vendor community role filter', () => {
  it('matches published vendor shop slug even without Vendor role string', () => {
    const p = person({ vendorShopSlug: 'rope-dreamer-supply' })
    assert.equal(personMatchesCommunityRoleFilter(p, 'vendor'), true)
  })

  it('matches vendor_verified badge', () => {
    const p = person({ badges: ['vendor_verified'] })
    assert.equal(personMatchesCommunityRoleFilter(p, 'vendor'), true)
  })

  it('does not match when neither shop nor role/badge present', () => {
    const p = person({ roles: ['Organizer'] })
    assert.equal(personMatchesCommunityRoleFilter(p, 'vendor'), false)
  })

  it('surfaces Vendor community badge from shop slug', () => {
    const badges = getPersonCommunityBadges(person({ vendorShopSlug: 'my-shop' }))
    assert.ok(badges.some((b) => b.id === 'vendor'))
  })
})
