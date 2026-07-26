import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  commandPermissionIncludes,
  emptyCommandPermissions,
  fullCommandPermissions,
  hasAnyCommandPermission,
} from '@c2k/shared'

test('full admin passes all requirements', () => {
  const p = fullCommandPermissions()
  assert.equal(commandPermissionIncludes('admin', p), true)
  assert.equal(commandPermissionIncludes('scheduler', p), true)
  assert.equal(commandPermissionIncludes(['staff_ops', 'scheduler'], p), true)
})

test('scoped grants are combinable', () => {
  const p = {
    ...emptyCommandPermissions(),
    registration: true,
  }
  assert.equal(hasAnyCommandPermission(p), true)
  assert.equal(commandPermissionIncludes('registration', p), true)
  assert.equal(commandPermissionIncludes('scheduler', p), false)
  assert.equal(commandPermissionIncludes(['staff_ops', 'scheduler'], p), false)
})

test('messaging requires staff_ops or scheduler', () => {
  const staffOnly = { ...emptyCommandPermissions(), staffOps: true }
  const schedOnly = { ...emptyCommandPermissions(), scheduler: true }
  assert.equal(commandPermissionIncludes(['staff_ops', 'scheduler'], staffOnly), true)
  assert.equal(commandPermissionIncludes(['staff_ops', 'scheduler'], schedOnly), true)
})

test('org moderator without command grant cannot pass scheduler requirement', () => {
  const modOnly = emptyCommandPermissions()
  assert.equal(commandPermissionIncludes('scheduler', modOnly), false)
})

test('scheduler grant passes scheduler requirement', () => {
  const sched = { ...emptyCommandPermissions(), scheduler: true }
  assert.equal(commandPermissionIncludes('scheduler', sched), true)
})

test('registration grant does not pass scheduler requirement', () => {
  const reg = { ...emptyCommandPermissions(), registration: true }
  assert.equal(commandPermissionIncludes('scheduler', reg), false)
})

test('staff_ops grant passes staff_ops requirement', () => {
  const staff = { ...emptyCommandPermissions(), staffOps: true }
  assert.equal(commandPermissionIncludes('staff_ops', staff), true)
})

test('hub read domains match grant matrix', () => {
  const reg = { ...emptyCommandPermissions(), registration: true }
  const sched = { ...emptyCommandPermissions(), scheduler: true }
  assert.equal(commandPermissionIncludes('registration', reg), true)
  assert.equal(commandPermissionIncludes('scheduler', reg), false)
  assert.equal(commandPermissionIncludes('scheduler', sched), true)
  assert.equal(commandPermissionIncludes('registration', sched), false)
})
