import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  invalidatePlatformStaffCache,
  isSiteOwner,
  isSiteAdmin,
  isTrustSafetyAdmin,
  isLegalAdmin,
  isPlatformModeratorUser,
  getPlatformStaffRole,
} from './platform-staff.js'
import {
  isEnvBootstrapPlatformModerator,
  isPlatformModerator,
} from './platform-moderator.js'

describe('platform site owner', () => {
  const savedOwner = process.env.C2K_SITE_OWNER_USER_IDS
  const savedAdmin = process.env.C2K_SITE_ADMIN_USER_IDS
  const savedMods = process.env.C2K_PLATFORM_MODERATOR_USER_IDS

  beforeEach(() => {
    invalidatePlatformStaffCache()
  })

  afterEach(() => {
    if (savedOwner === undefined) delete process.env.C2K_SITE_OWNER_USER_IDS
    else process.env.C2K_SITE_OWNER_USER_IDS = savedOwner
    if (savedAdmin === undefined) delete process.env.C2K_SITE_ADMIN_USER_IDS
    else process.env.C2K_SITE_ADMIN_USER_IDS = savedAdmin
    if (savedMods === undefined) delete process.env.C2K_PLATFORM_MODERATOR_USER_IDS
    else process.env.C2K_PLATFORM_MODERATOR_USER_IDS = savedMods
    invalidatePlatformStaffCache()
  })

  it('isSiteOwner true only for C2K_SITE_OWNER_USER_IDS', async () => {
    const ownerId = randomUUID()
    const adminId = randomUUID()
    process.env.C2K_SITE_OWNER_USER_IDS = ownerId
    process.env.C2K_SITE_ADMIN_USER_IDS = adminId
    invalidatePlatformStaffCache()

    assert.equal(await isSiteOwner(ownerId), true)
    assert.equal(await isSiteOwner(adminId), false)
  })

  it('SITE_ADMIN does not imply site owner', async () => {
    const adminId = randomUUID()
    process.env.C2K_SITE_ADMIN_USER_IDS = adminId
    delete process.env.C2K_SITE_OWNER_USER_IDS
    invalidatePlatformStaffCache()

    assert.equal(await isSiteAdmin(adminId), true)
    assert.equal(await isSiteOwner(adminId), false)
  })

  it('owner supersedes site admin, T&S, legal, and platform mod capability checks', async () => {
    const ownerId = randomUUID()
    process.env.C2K_SITE_OWNER_USER_IDS = ownerId
    delete process.env.C2K_SITE_ADMIN_USER_IDS
    delete process.env.C2K_PLATFORM_MODERATOR_USER_IDS
    invalidatePlatformStaffCache()

    assert.equal(await isSiteOwner(ownerId), true)
    assert.equal(await isSiteAdmin(ownerId), true)
    assert.equal(await isTrustSafetyAdmin(ownerId), true)
    assert.equal(await isLegalAdmin(ownerId), true)
    assert.equal(await isPlatformModeratorUser(ownerId), true)
    assert.equal(await getPlatformStaffRole(ownerId), 'OWNER_ADMIN')
  })

  it('plain env moderator is not site admin or owner', async () => {
    const modId = randomUUID()
    delete process.env.C2K_SITE_OWNER_USER_IDS
    delete process.env.C2K_SITE_ADMIN_USER_IDS
    process.env.C2K_PLATFORM_MODERATOR_USER_IDS = modId
    invalidatePlatformStaffCache()

    assert.equal(await isPlatformModeratorUser(modId), true)
    assert.equal(await isSiteAdmin(modId), false)
    assert.equal(await isSiteOwner(modId), false)
    assert.equal(await isTrustSafetyAdmin(modId), false)
    assert.equal(await getPlatformStaffRole(modId), 'MODERATOR')
  })

  it('env bootstrap helper is env-only; deprecated alias matches it', () => {
    const modId = randomUUID()
    const strangerId = randomUUID()
    process.env.C2K_PLATFORM_MODERATOR_USER_IDS = modId
    assert.equal(isEnvBootstrapPlatformModerator(modId), true)
    assert.equal(isEnvBootstrapPlatformModerator(strangerId), false)
    assert.equal(isPlatformModerator(modId), true)
    assert.equal(isPlatformModerator(strangerId), false)
  })
})
