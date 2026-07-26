import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { dirname, join } from 'node:path'

import { fileURLToPath } from 'node:url'

import test from 'node:test'

import { COMMUNITY_TRUST_LEVELS } from '@c2k/shared'

import { deriveCommunityTrustLevel } from './community-trust.js'



const root = join(dirname(fileURLToPath(import.meta.url)), '..')



function baseCounts(overrides: Partial<Parameters<typeof deriveCommunityTrustLevel>[0]> = {}) {

  return {

    acceptedReferences: 0,

    countedReferences: 0,

    staffConfirmedCheckIns: 0,

    conventionRegistrations: 0,

    verifiedPresenterCredits: 0,

    verifiedVendorCredits: 0,

    organizerRoles: 0,

    qualifiesVerifiedContributor: false,

    accountAgeDays: 3,

    ageAffirmed: false,

    profileComplete: false,

    hasProfilePhoto: false,

    memberSinceYear: 2026,

    ...overrides,

  }

}



test('deriveCommunityTrustLevel. New member with no history', () => {

  const level = deriveCommunityTrustLevel(baseCounts())

  assert.equal(level, COMMUNITY_TRUST_LEVELS.newMember)

})



test('deriveCommunityTrustLevel. Organizer role alone does not reach verified contributor', () => {

  const level = deriveCommunityTrustLevel(

    baseCounts({

      organizerRoles: 1,

      accountAgeDays: 200,

      ageAffirmed: true,

      profileComplete: true,

      hasProfilePhoto: true,

      qualifiesVerifiedContributor: false,

    })

  )

  assert.equal(level, COMMUNITY_TRUST_LEVELS.establishedMember)

})



test('deriveCommunityTrustLevel. Verified contributor requires credential gate', () => {

  const level = deriveCommunityTrustLevel(

    baseCounts({

      qualifiesVerifiedContributor: true,

      verifiedPresenterCredits: 1,

      accountAgeDays: 200,

    })

  )

  assert.equal(level, COMMUNITY_TRUST_LEVELS.verifiedContributor)

})



test('deriveCommunityTrustLevel. Caps references and check-ins for community known', () => {

  const level = deriveCommunityTrustLevel(

    baseCounts({

      countedReferences: 3,

      staffConfirmedCheckIns: 3,

      conventionRegistrations: 0,

      accountAgeDays: 120,

    })

  )

  assert.equal(level, COMMUNITY_TRUST_LEVELS.communityKnown)

})



test('community-trust routes do not expose trust_score', () => {

  const src = readFileSync(join(root, 'routes/community-trust-routes.ts'), 'utf8')

  assert.ok(!src.includes('trust_score'))

  assert.ok(!src.includes('trustScore'))

})



test('peer reputation still frozen', () => {

  const src = readFileSync(join(root, 'routes/peer-reputation-routes.ts'), 'utf8')

  assert.ok(src.includes('410'))

})


