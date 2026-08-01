import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isDancecardLoginLandingSearch,
  isDancecardMePath,
  isDancecardPublicIsoPath,
  isDancecardStayPath,
} from './dancecard-host'

describe('isDancecardStayPath', () => {
  it('keeps product and auth routes on dancecard host', () => {
    for (const path of [
      '/',
      '/play',
      '/play/summer',
      '/play/schedule',
      '/messaging',
      '/messaging/abc',
      '/profile',
      '/profile/edit',
      '/profile/edit/about',
      '/login',
      '/onboarding',
      '/verify-email',
      '/email/confirm',
    ]) {
      assert.equal(isDancecardStayPath(path), true, path)
    }
  })

  it('keeps public ISO profile cards on dancecard host', () => {
    assert.equal(isDancecardStayPath('/profile/Brax', '?tab=ISO'), true)
    assert.equal(isDancecardStayPath('/profile/Brax', 'tab=iso'), true)
    assert.equal(isDancecardPublicIsoPath('/profile/Brax', '?tab=ISO'), true)
  })

  it('sends community routes to apex', () => {
    for (const path of [
      '/home',
      '/explore',
      '/events',
      '/groups',
      '/people',
      '/settings',
      '/notifications',
      '/profile/someoneelse',
      '/conventions',
    ]) {
      assert.equal(isDancecardStayPath(path), false, path)
    }
    assert.equal(isDancecardStayPath('/profile/Brax', '?tab=Media'), false)
    assert.equal(isDancecardStayPath('/profile/Brax'), false)
  })
})

describe('isDancecardMePath', () => {
  it('covers me shell only', () => {
    assert.equal(isDancecardMePath('/profile'), true)
    assert.equal(isDancecardMePath('/profile/edit'), true)
    assert.equal(isDancecardMePath('/profile/alice'), false)
  })
})

describe('isDancecardLoginLandingSearch', () => {
  it('detects legacy landing login bookmarks migrated to /login', () => {
    assert.equal(isDancecardLoginLandingSearch('?login=1'), true)
    assert.equal(isDancecardLoginLandingSearch('login=1&redirect=%2Fplay'), true)
    assert.equal(isDancecardLoginLandingSearch('?login=true'), true)
    assert.equal(isDancecardLoginLandingSearch(''), false)
    assert.equal(isDancecardLoginLandingSearch('?redirect=/play'), false)
  })
})
