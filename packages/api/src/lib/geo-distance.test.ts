import assert from 'node:assert/strict'
import test from 'node:test'
import { haversineDistanceMi, parseProfileGeoPoint } from './geo-distance.js'

test('haversineDistanceMi. Same point is zero', () => {
  assert.equal(haversineDistanceMi(40.7, -74.0, 40.7, -74.0), 0)
})

test('haversineDistanceMi · NYC to Philly ~80–95 mi', () => {
  const mi = haversineDistanceMi(40.7128, -74.006, 39.9526, -75.1652)
  assert.ok(mi > 70 && mi < 100, `expected ~80mi, got ${mi}`)
})

test('parseProfileGeoPoint', () => {
  assert.deepEqual(parseProfileGeoPoint({ type: 'Point', coordinates: [-74, 40.7] }), {
    lat: 40.7,
    lng: -74,
  })
  assert.equal(parseProfileGeoPoint(null), null)
})
