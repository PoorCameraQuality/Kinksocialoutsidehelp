import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  displayNameFromProfile,
  pickAccessRoleOnRegistration,
} from './convention-participation.js'

describe('displayNameFromProfile', () => {
  it('prefers profile display name', () => {
    assert.equal(displayNameFromProfile('Alex Scene', 'alex42'), 'Alex Scene')
  })

  it('falls back to username', () => {
    assert.equal(displayNameFromProfile(null, 'alex42'), 'alex42')
    assert.equal(displayNameFromProfile('  ', 'alex42'), 'alex42')
  })
})

describe('pickAccessRoleOnRegistration', () => {
  it('keeps higher existing role', () => {
    assert.equal(pickAccessRoleOnRegistration('STAFF', 'ATTENDEE'), 'STAFF')
    assert.equal(pickAccessRoleOnRegistration('MODERATOR', 'STAFF'), 'MODERATOR')
  })

  it('promotes when requested role is higher', () => {
    assert.equal(pickAccessRoleOnRegistration('ATTENDEE', 'STAFF'), 'STAFF')
    assert.equal(pickAccessRoleOnRegistration('STAFF', 'MODERATOR'), 'MODERATOR')
  })

  it('keeps existing role when no request', () => {
    assert.equal(pickAccessRoleOnRegistration('STAFF'), 'STAFF')
  })
})
