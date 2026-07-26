import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  canSeePresenterOrganizerFields,
  offeringForViewer,
  presenterProfileForViewer,
  serializePresenterProfileForApiResponse,
} from './presenter-profile-public.js'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const routesSrc = readFileSync(join(apiRoot, 'routes/presenter-profiles.ts'), 'utf8')
const runnerAccessSrc = readFileSync(join(apiRoot, 'lib/presenter-runner-access.ts'), 'utf8')

describe('presenterProfileForViewer', () => {
  it('strips backgroundStory from public responses', () => {
    const out = presenterProfileForViewer(
      { userId: 'u1', backgroundStory: 'AV needs: projector', headline: 'Teach' },
      false
    )
    assert.equal(out.backgroundStory, undefined)
    assert.equal(out.headline, 'Teach')
  })

  it('keeps backgroundStory for owner or eligible organizer', () => {
    const out = presenterProfileForViewer(
      { userId: 'u1', backgroundStory: 'Room setup notes' },
      true
    )
    assert.equal(out.backgroundStory, 'Room setup notes')
  })
})

describe('serializePresenterProfileForApiResponse — backgroundStory access', () => {
  const sample = { headline: 'Speaker', backgroundStory: 'AV needs: HDMI adapter' }

  it('public viewer does not receive backgroundStory', () => {
    const out = serializePresenterProfileForApiResponse(sample, {
      isOwner: false,
      canSeeRunnerMaterials: false,
    })
    assert.equal(out.backgroundStory, undefined)
    assert.equal(out.headline, 'Speaker')
  })

  it('owner receives backgroundStory', () => {
    const out = serializePresenterProfileForApiResponse(sample, {
      isOwner: true,
      canSeeRunnerMaterials: false,
    })
    assert.equal(out.backgroundStory, 'AV needs: HDMI adapter')
  })

  it('eligible organizer receives backgroundStory', () => {
    const out = serializePresenterProfileForApiResponse(sample, {
      isOwner: false,
      canSeeRunnerMaterials: true,
    })
    assert.equal(out.backgroundStory, 'AV needs: HDMI adapter')
  })

  it('unrelated organizer does not receive backgroundStory', () => {
    const out = serializePresenterProfileForApiResponse(sample, {
      isOwner: false,
      canSeeRunnerMaterials: false,
    })
    assert.equal(out.backgroundStory, undefined)
  })
})

describe('presenter profile route wiring', () => {
  it('uses presenterProfileForViewer with organizer field gate', () => {
    assert.match(routesSrc, /presenterProfileForViewer\(prof, canSeeOrganizerFields\)/)
    assert.match(routesSrc, /canSeeOrganizerFields = canSeePresenterOrganizerFields\(isOwner, showRunner\)/)
  })
})

describe('offeringForViewer', () => {
  it('removes runnerMaterials from public offering payloads', () => {
    const out = offeringForViewer(
      {
        id: '1',
        title: 'Class',
        runnerMaterials: [{ label: 'Slides', url: 'https://example.com/s.pdf' }],
      },
      false
    )
    assert.equal(out.runnerMaterials, undefined)
    assert.equal(out.title, 'Class')
  })

  it('includes runnerMaterials only when viewer is authorized', () => {
    const materials = [{ label: 'Handout', url: 'https://example.com/h.pdf' }]
    const out = offeringForViewer({ id: '1', title: 'Class', runnerMaterials: materials }, true)
    assert.deepEqual(out.runnerMaterials, materials)
  })
})

describe('canSeePresenterOrganizerFields', () => {
  it('allows owner and eligible organizer staff', () => {
    assert.equal(canSeePresenterOrganizerFields(true, false), true)
    assert.equal(canSeePresenterOrganizerFields(false, true), true)
    assert.equal(canSeePresenterOrganizerFields(false, false), false)
  })
})

describe('presenter directory visibility', () => {
  it('GET /presenters filters to PUBLIC directory visibility', () => {
    assert.match(routesSrc, /eq\(schema\.presenterProfiles\.directoryVisibility, 'PUBLIC'\)/)
  })

  it('focus filter is combined with PUBLIC visibility', () => {
    assert.match(routesSrc, /focusClause/)
    assert.match(routesSrc, /directoryVisibility, 'PUBLIC'/)
  })
})

describe('presenter runner materials access rules', () => {
  it('grants presenter self-access', () => {
    assert.match(runnerAccessSrc, /viewerId === presenterUserId/)
  })

  it('requires org OWNER, ADMIN, or MODERATOR', () => {
    assert.match(runnerAccessSrc, /OWNER/)
    assert.match(runnerAccessSrc, /ADMIN/)
    assert.match(runnerAccessSrc, /MODERATOR/)
  })

  it('checks scheduled program relationship scoped to org', () => {
    assert.match(runnerAccessSrc, /scheduleSlotPresenters/)
    assert.match(runnerAccessSrc, /conventions\.organizationId/)
  })

  it('checks APPROVED presenter requests scoped to org', () => {
    assert.match(runnerAccessSrc, /conventionPresenterRequests/)
    assert.match(runnerAccessSrc, /APPROVED/)
  })
})

describe('gallery URL validation in routes', () => {
  it('validates gallery image URLs on POST', () => {
    assert.match(routesSrc, /validatePresenterExternalUrl/)
  })
})
