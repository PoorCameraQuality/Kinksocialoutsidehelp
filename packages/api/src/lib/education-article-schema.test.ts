import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { slugifyEducationTitle, validateListInEducationRequirements } from './education-article-schema.js'

describe('education article schema helpers', () => {
  it('slugifyEducationTitle produces URL-safe slug', () => {
    assert.equal(slugifyEducationTitle('Negotiation 101: Basics'), 'negotiation-101-basics')
  })

  it('validateListInEducationRequirements requires categories and warnings', () => {
    assert.equal(validateListInEducationRequirements({ listInEducation: false }), null)
    assert.match(
      validateListInEducationRequirements({ listInEducation: true, categories: [], contentWarnings: ['Consent'] }) ?? '',
      /category/i,
    )
    assert.match(
      validateListInEducationRequirements({ listInEducation: true, categories: ['Safety'], contentWarnings: [] }) ?? '',
      /content warning/i,
    )
  })
})
