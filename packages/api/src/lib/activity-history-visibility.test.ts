import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { invalidatePlatformStaffCache } from './platform-staff.js'

describe('viewerCanSeeActivityHistory moderator bypass', () => {
  const savedMods = process.env.C2K_PLATFORM_MODERATOR_USER_IDS
  const savedUseDb = process.env.USE_DATABASE

  beforeEach(() => {
    invalidatePlatformStaffCache()
  })

  afterEach(() => {
    if (savedMods === undefined) delete process.env.C2K_PLATFORM_MODERATOR_USER_IDS
    else process.env.C2K_PLATFORM_MODERATOR_USER_IDS = savedMods
    if (savedUseDb === undefined) delete process.env.USE_DATABASE
    else process.env.USE_DATABASE = savedUseDb
    invalidatePlatformStaffCache()
  })

  it('allows env bootstrap platform moderators and owners without querying privacy settings', async () => {
    process.env.USE_DATABASE = 'false'
    const modId = randomUUID()
    const targetId = randomUUID()
    process.env.C2K_PLATFORM_MODERATOR_USER_IDS = modId
    invalidatePlatformStaffCache()

    const { viewerCanSeeActivityHistory } = await import('./activity-history-visibility.js')
    // These branches short-circuit before the user_settings query.
    assert.equal(await viewerCanSeeActivityHistory(targetId, modId), true)
    assert.equal(await viewerCanSeeActivityHistory(targetId, targetId), true)
  })
})
