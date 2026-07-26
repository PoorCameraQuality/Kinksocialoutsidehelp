import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveCheckInUpdate } from './convention-organizer/registration.js'

test('resolveCheckInUpdate blocks early without override', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000)
  const result = resolveCheckInUpdate(
    { checkInValidFrom: future, checkInValidThrough: null },
    { now: new Date() },
  )
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.body.code, 'EARLY_CHECK_IN')
})

test('resolveCheckInUpdate allows early with override', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000)
  const result = resolveCheckInUpdate(
    { checkInValidFrom: future, checkInValidThrough: null },
    { earlyCheckInOverride: true },
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.patch.checkedInTiming, 'early_override')
})

test('resolveCheckInUpdate sets late timing when past window', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000)
  const result = resolveCheckInUpdate(
    { checkInValidFrom: null, checkInValidThrough: past },
    { now: new Date() },
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.patch.checkedInTiming, 'late')
})

test('resolveCheckInUpdate blocks waitlisted registrants', () => {
  const result = resolveCheckInUpdate(null, { registrationStatus: 'waitlisted' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.body.code, 'NOT_ELIGIBLE')
})

test('resolveCheckInUpdate blocks cancelled registrants', () => {
  const result = resolveCheckInUpdate(null, { registrationStatus: 'cancelled' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.body.code, 'NOT_ELIGIBLE')
})
