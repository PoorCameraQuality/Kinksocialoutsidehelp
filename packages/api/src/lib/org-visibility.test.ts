import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { memberContentAllowedForOrgVisibility } from './org-visibility.js'

describe('memberContentAllowedForOrgVisibility', () => {
  it('PUBLIC orgs allow non-members', () => {
    assert.equal(memberContentAllowedForOrgVisibility('PUBLIC', false), true)
  })

  it('MEMBERS orgs require membership', () => {
    assert.equal(memberContentAllowedForOrgVisibility('MEMBERS', false), false)
    assert.equal(memberContentAllowedForOrgVisibility('MEMBERS', true), true)
  })

  it('PRIVATE orgs require membership', () => {
    assert.equal(memberContentAllowedForOrgVisibility('PRIVATE', false), false)
    assert.equal(memberContentAllowedForOrgVisibility('PRIVATE', true), true)
  })
})
