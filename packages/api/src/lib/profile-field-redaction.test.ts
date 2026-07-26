import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { redactProfileForViewer, redactListProfileIdentityFields } from './profile-field-redaction.js'

const baseProfile = {
  gender: 'Non-binary',
  genders: ['Non-binary'],
  age: 32,
  sexuality: 'Pansexual',
  sexualOrientations: ['Pansexual'],
  romanticOrientations: ['Demiromantic'],
  pronouns: 'they/them',
  pronounTags: ['they/them'],
  location: 'Portland, Oregon',
  bio: 'Hello',
  roles: ['Switch'],
  lifestyleActivity: 'Experienced',
  birthDate: '1993-05-01',
  homeZip: '97201',
  placeId: 'place-1',
  stateId: 'state-or',
  customLocation: null,
  lookingFor: ['Friends', 'Play partners'],
  notLookingFor: ['One-night stands'],
  geoJson: { type: 'Point', coordinates: [-122.67, 45.52] },
  fieldVisibility: {
    gender: 'hidden',
    age: 'hidden',
    sexuality: 'friends',
    pronouns: 'public',
    location: 'hidden',
  },
  discoverableInPeopleSearch: true,
} as const

describe('redactProfileForViewer', () => {
  it('returns full profile for owner without public view', () => {
    const out = redactProfileForViewer({ ...baseProfile }, {
      viewerId: 'u1',
      targetUserId: 'u1',
      friendIds: new Set(),
    })
    assert.equal(out.gender, 'Non-binary')
    assert.equal(out.birthDate, '1993-05-01')
    assert.deepEqual(out.notLookingFor, ['One-night stands'])
    assert.ok('fieldVisibility' in out)
  })

  it('redacts hidden fields for owner public profile view', () => {
    const out = redactProfileForViewer({ ...baseProfile }, {
      viewerId: 'u1',
      targetUserId: 'u1',
      friendIds: new Set(),
    }, { asPublicProfileView: true })
    assert.equal(out.gender, null)
    assert.deepEqual(out.sexualOrientations, [])
    assert.deepEqual(out.romanticOrientations, [])
    assert.equal(out.pronouns, 'they/them')
    assert.ok('fieldVisibility' in out)
    assert.ok('discoverableInPeopleSearch' in out)
    assert.equal(out.birthDate, null)
  })

  it('redacts hidden identity fields for strangers', () => {
    const out = redactProfileForViewer({ ...baseProfile }, {
      viewerId: 'u2',
      targetUserId: 'u1',
      friendIds: new Set(),
    })
    assert.equal(out.gender, null)
    assert.deepEqual(out.genders, [])
    assert.equal(out.age, null)
    assert.equal(out.location, null)
    assert.equal(out.pronouns, 'they/them')
    assert.deepEqual(out.pronounTags, ['they/them'])
    assert.deepEqual(out.sexualOrientations, [])
    assert.deepEqual(out.romanticOrientations, [])
    assert.equal(out.birthDate, null)
    assert.equal(out.homeZip, null)
    assert.equal(out.placeId, null)
    assert.equal(out.stateId, null)
    assert.equal(out.customLocation, null)
    assert.deepEqual(out.notLookingFor, [])
    assert.deepEqual(out.lookingFor, [])
    assert.equal(out.geoJson, null)
    assert.equal('fieldVisibility' in out, false)
    assert.equal('discoverableInPeopleSearch' in out, false)
  })

  it('shows friends-only sexuality to accepted friends', () => {
    const out = redactProfileForViewer({ ...baseProfile }, {
      viewerId: 'u2',
      targetUserId: 'u1',
      friendIds: new Set(['u1']),
    })
    assert.deepEqual(out.sexualOrientations, ['Pansexual'])
    assert.deepEqual(out.romanticOrientations, ['Demiromantic'])
    assert.equal(out.sexuality, 'Pansexual')
  })
})

describe('redactListProfileIdentityFields', () => {
  it('redacts hidden list fields for strangers', () => {
    const out = redactListProfileIdentityFields(
      {
        userId: 'u1',
        age: 32,
        location: 'Portland, Oregon',
        gender: 'Non-binary',
        genders: ['Non-binary'],
        fieldVisibility: { age: 'hidden', location: 'hidden', gender: 'hidden' },
      },
      'u2',
      new Set(),
    )
    assert.equal(out.age, null)
    assert.equal(out.location, null)
    assert.equal(out.gender, null)
    assert.deepEqual(out.genders, [])
  })
})
