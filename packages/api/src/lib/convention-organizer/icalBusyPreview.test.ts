import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseIcsBusyBlocks } from './icalBusyPreview.js'

describe('parseIcsBusyBlocks', () => {
  it('parses a single VEVENT with UTC timestamps', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20260522T140000Z',
      'DTEND:20260522T150000Z',
      'SUMMARY:Panel',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const blocks = parseIcsBusyBlocks(ics)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0]?.summary, 'Panel')
    assert.ok(blocks[0]?.start.includes('2026-05-22'))
    assert.ok(blocks[0]?.end.includes('2026-05-22'))
  })

  it('returns empty array for text without events', () => {
    assert.deepEqual(parseIcsBusyBlocks('BEGIN:VCALENDAR\nEND:VCALENDAR'), [])
  })
})
