import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ECKE_OWNER_FACING_SURFACES,
  ECKE_PUBLISH_REGISTRY,
  getRegistryEntry,
  isRegistryEntryOwnerVisible,
  isValidEckeSourceKind,
  listDeprecatedRegistryEntries,
  listOwnerFacingRegistryEntries,
  listRegistryForConventionDashboard,
  listRegistryForGroupDashboard,
  listRegistryForOrgDashboard,
  PASS2_DISABLED_ACTIONS,
} from './ecke-publish-registry.js'

const EXPECTED_SOURCE_KINDS = [
  'education_article',
  'vendor_profile',
  'organization_listing',
  'group_listing',
  'event_listing',
  'convention_listing',
  'dancecard_event',
  'dancecard_location',
  'dancecard_program_slot',
  'dancecard_staff_shift',
  'presenter_profile',
  'dungeon_profile',
  'venue_profile',
  'convention_event_anchor',
] as const

describe('ecke-publish-registry', () => {
  it('contains expected source kinds', () => {
    const kinds = ECKE_PUBLISH_REGISTRY.map((e) => e.sourceKind)
    for (const kind of EXPECTED_SOURCE_KINDS) {
      assert.ok(kinds.includes(kind), `missing ${kind}`)
    }
    assert.equal(kinds.length, EXPECTED_SOURCE_KINDS.length)
  })

  it('owner-facing surfaces are Events, Places, Vendors, Education only', () => {
    assert.deepEqual([...ECKE_OWNER_FACING_SURFACES], ['events', 'places', 'vendors', 'education'])
    const surfaces = new Set(listOwnerFacingRegistryEntries().map((e) => e.ownerFacingSurface))
    assert.deepEqual([...surfaces].sort(), ['education', 'events', 'places', 'vendors'])
  })

  it('organization_listing is deprecated and hidden from org dashboard', () => {
    const entry = getRegistryEntry('organization_listing')!
    assert.equal(entry.deprecated, true)
    assert.equal(entry.ownerDashboardVisible, false)
    assert.equal(entry.visibleInOrgDashboard, false)
    assert.ok(!listRegistryForOrgDashboard().some((e) => e.sourceKind === 'organization_listing'))
  })

  it('dungeon_profile is deprecated and hidden from org dashboard', () => {
    const entry = getRegistryEntry('dungeon_profile')!
    assert.equal(entry.deprecated, true)
    assert.ok(!listRegistryForOrgDashboard().some((e) => e.sourceKind === 'dungeon_profile'))
  })

  it('dancecard targets are deprecated and hidden from convention dashboard', () => {
    for (const kind of [
      'dancecard_event',
      'dancecard_location',
      'dancecard_program_slot',
      'dancecard_staff_shift',
    ] as const) {
      const entry = getRegistryEntry(kind)!
      assert.equal(entry.deprecated, true)
      assert.equal(entry.ownerDashboardVisible, false)
    }
    assert.ok(!listRegistryForConventionDashboard().some((e) => e.sourceKind.startsWith('dancecard_')))
  })

  it('convention_event_anchor is the convention dashboard Events target', () => {
    const conventionEntries = listRegistryForConventionDashboard()
    assert.ok(conventionEntries.some((e) => e.sourceKind === 'convention_event_anchor'))
    assert.equal(getRegistryEntry('convention_event_anchor')!.ownerFacingSurface, 'events')
    assert.ok(!conventionEntries.some((e) => e.sourceKind === 'convention_listing'))
  })

  it('marks group_listing as active on group dashboard (legacy thin listing)', () => {
    const entry = getRegistryEntry('group_listing')!
    assert.equal(entry.supportState, 'active_existing')
    assert.equal(isRegistryEntryOwnerVisible(entry, 'group'), true)
    assert.ok(listRegistryForGroupDashboard().some((e) => e.sourceKind === 'group_listing'))
  })

  it('marks vendor_profile visible on org dashboard', () => {
    const entry = getRegistryEntry('vendor_profile')!
    assert.equal(entry.visibleInOrgDashboard, true)
    assert.equal(entry.ownerFacingSurface, 'vendors')
    assert.ok(listRegistryForOrgDashboard().some((e) => e.sourceKind === 'vendor_profile'))
  })

  it('education_article remains on org dashboard', () => {
    assert.ok(listRegistryForOrgDashboard().some((e) => e.sourceKind === 'education_article'))
  })

  it('venue_profile maps to Places surface', () => {
    const entry = getRegistryEntry('venue_profile')!
    assert.equal(entry.ownerFacingSurface, 'places')
    assert.equal(entry.label, 'Place listing')
  })

  it('validates source kind strings', () => {
    assert.equal(isValidEckeSourceKind('group_listing'), true)
    assert.equal(isValidEckeSourceKind('not_real'), false)
  })

  it('lists deprecated entries including org listing and dancecard', () => {
    const deprecated = listDeprecatedRegistryEntries().map((e) => e.sourceKind)
    assert.ok(deprecated.includes('organization_listing'))
    assert.ok(deprecated.includes('dancecard_event'))
    assert.ok(deprecated.includes('dungeon_profile'))
  })

  it('Pass 2 disables write actions in registry constants', () => {
    assert.equal(PASS2_DISABLED_ACTIONS.preview, true)
    assert.equal(PASS2_DISABLED_ACTIONS.publish, false)
    assert.equal(PASS2_DISABLED_ACTIONS.sync, false)
    assert.equal(PASS2_DISABLED_ACTIONS.unpublish, false)
  })

  it('org overview builder does not surface organization_listing or dungeon_profile cards', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8')
    const fnStart = src.indexOf('export async function getOrgEckePublishOverview')
    assert.ok(fnStart >= 0)
    const fnEnd = src.indexOf('export async function getConventionEckePublishOverview', fnStart)
    const body = src.slice(fnStart, fnEnd)
    assert.ok(!body.includes("section: 'organization_listing'"))
    assert.ok(!body.includes("sourceKind: 'organization_listing'"))
    assert.ok(!body.includes("sourceKind: 'dungeon_profile'"))
  })

  it('convention overview builder frames Events surface not Dancecard sync', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8')
    const fnStart = src.indexOf('export async function getConventionEckePublishOverview')
    assert.ok(fnStart >= 0)
    const fnEnd = src.indexOf('export type EckePublishActionResult', fnStart)
    const body = src.slice(fnStart, fnEnd)
    assert.ok(body.includes("section: 'events'"))
    assert.ok(body.includes('Publish event to ECKE'))
    assert.ok(!body.includes("sourceKind: 'dancecard_event'"))
    assert.ok(!body.includes("section: 'convention_listing'"))
  })
})
