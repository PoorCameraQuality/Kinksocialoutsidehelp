import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EmitActivityParams } from './feed-activities.js'

describe('EmitActivityParams shape', () => {
  it('accepts v1 verbs and object types', () => {
    const params: EmitActivityParams = {
      actorId: '00000000-0000-4000-8000-000000000001',
      verb: 'post',
      objectType: 'feed_post',
      objectId: '00000000-0000-4000-8000-000000000002',
      metadata: { title: 'Hello' },
    }
    assert.equal(params.verb, 'post')
    assert.equal(params.objectType, 'feed_post')
  })

  it('accepts F5 verbs', () => {
    const pin: EmitActivityParams = {
      actorId: '00000000-0000-4000-8000-000000000001',
      verb: 'convention_pin',
      objectType: 'convention',
      objectId: '00000000-0000-4000-8000-000000000003',
      metadata: { title: 'Preview Weekend', conventionSlug: 'preview-c2k-weekend' },
    }
    assert.equal(pin.verb, 'convention_pin')
  })
})
