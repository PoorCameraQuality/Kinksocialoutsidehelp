import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  globalPublicEventDiscoveryFilter,
  isGlobalPublicEventDiscoveryQuery,
} from './event-discovery.js'

describe('isGlobalPublicEventDiscoveryQuery', () => {
  it('is true for unscoped list', () => {
    assert.equal(isGlobalPublicEventDiscoveryQuery({}), true)
  })

  it('is false when groupId is set', () => {
    assert.equal(
      isGlobalPublicEventDiscoveryQuery({ groupId: '00000000-0000-4000-8000-000000000001' }),
      false,
    )
  })

  it('is false when organizationId is set', () => {
    assert.equal(
      isGlobalPublicEventDiscoveryQuery({ organizationId: '00000000-0000-4000-8000-000000000002' }),
      false,
    )
  })

  it('is false when hostId is set', () => {
    assert.equal(isGlobalPublicEventDiscoveryQuery({ hostId: 'me' }), false)
  })
})

describe('globalPublicEventDiscoveryFilter', () => {
  it('returns a drizzle SQL fragment', () => {
    const filter = globalPublicEventDiscoveryFilter()
    assert.ok(filter)
  })
})
