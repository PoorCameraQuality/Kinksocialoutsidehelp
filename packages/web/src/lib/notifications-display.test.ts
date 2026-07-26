import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapApiToDisplay, notificationActionLabel } from './notifications-display.ts'

describe('notifications display', () => {
  it('maps dm_request without message body', () => {
    const row = mapApiToDisplay({
      id: 'n1',
      type: 'dm_request',
      payload: { conversationId: 'c1', senderUsername: 'alex' },
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    assert.match(row.body, /@alex sent you a message request/)
    assert.equal(row.body.includes('secret'), false)
    assert.equal(notificationActionLabel(row), 'Review request')
  })

  it('maps connection accepted to profile CTA', () => {
    const row = mapApiToDisplay({
      id: 'n2',
      type: 'connection_accepted',
      payload: { accepterUsername: 'jamie' },
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    assert.equal(row.href, '/profile/jamie')
    assert.equal(notificationActionLabel(row), 'View profile')
  })

  it('falls back safely when actor username is missing', () => {
    const row = mapApiToDisplay({
      id: 'n3',
      type: 'connection_request',
      payload: {},
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    assert.match(row.body, /@Someone sent you a connection request/)
  })
})
