import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filterStaffRowsForAttendeeAllowlist, getProgramStaffAttendeeRoleAllowlist } from './convention-staff-public.js'

describe('getProgramStaffAttendeeRoleAllowlist', () => {
  it('returns trimmed non-empty strings', () => {
    assert.deepEqual(
      getProgramStaffAttendeeRoleAllowlist({ programStaffAttendeeRoles: [' photo ', 'door'] }),
      ['photo', 'door'],
    )
  })
  it('returns empty when missing or invalid', () => {
    assert.deepEqual(getProgramStaffAttendeeRoleAllowlist(undefined), [])
    assert.deepEqual(getProgramStaffAttendeeRoleAllowlist({ programStaffAttendeeRoles: ['', '  '] as string[] }), [])
  })
})

describe('filterStaffRowsForAttendeeAllowlist', () => {
  it('matches substrings case-insensitively', () => {
    const staff = [{ roleLabel: 'Room Monitor' }, { roleLabel: 'Photographer' }, { roleLabel: 'Door' }]
    const out = filterStaffRowsForAttendeeAllowlist(staff, ['photo', 'door'])
    assert.deepEqual(
      out.map((x) => x.roleLabel),
      ['Photographer', 'Door'],
    )
  })
  it('returns empty when allowlist empty', () => {
    assert.deepEqual(filterStaffRowsForAttendeeAllowlist([{ roleLabel: 'X' }], []), [])
  })
})
