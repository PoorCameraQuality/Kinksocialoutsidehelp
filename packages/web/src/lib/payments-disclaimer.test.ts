import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PAYMENTS_BUYER_NOTE,
  PAYMENTS_BUYER_SHORT,
  PAYMENTS_POLICY_HREF,
  PAYMENTS_SELLER_NOTE,
} from './payments-disclaimer.ts'

describe('payments disclaimer copy', () => {
  it('points buyers to seller and card issuer, not platform refunds', () => {
    for (const copy of [PAYMENTS_BUYER_SHORT, PAYMENTS_BUYER_NOTE]) {
      assert.match(copy, /kink\.social/i)
      assert.match(copy, /cannot/i)
      assert.match(copy, /card/i)
    }
    assert.match(PAYMENTS_BUYER_NOTE, /suspend|ban|remove/i)
  })

  it('tells sellers they are merchant of record', () => {
    assert.match(PAYMENTS_SELLER_NOTE, /merchant of record/i)
    assert.match(PAYMENTS_SELLER_NOTE, /cannot reverse/i)
  })

  it('policy href is under /policies/payments', () => {
    assert.equal(PAYMENTS_POLICY_HREF, '/policies/payments')
  })
})
