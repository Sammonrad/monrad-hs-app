/**
 * Segment overlap validation tests — run with: node --test src/utils/driverDaySegments.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateSegments,
  segmentsOverlap,
  getActiveSegment,
  ACTIVITY_TYPES,
} from './driverDaySegments.js'

describe('segmentsOverlap', () => {
  it('detects overlapping intervals', () => {
    const a = { startedAt: '2026-08-28T08:00:00.000Z', endedAt: '2026-08-28T10:00:00.000Z' }
    const b = { startedAt: '2026-08-28T09:00:00.000Z', endedAt: '2026-08-28T11:00:00.000Z' }
    assert.equal(segmentsOverlap(a, b), true)
  })

  it('allows adjacent non-overlapping intervals', () => {
    const a = { startedAt: '2026-08-28T08:00:00.000Z', endedAt: '2026-08-28T09:00:00.000Z' }
    const b = { startedAt: '2026-08-28T09:00:00.000Z', endedAt: '2026-08-28T10:00:00.000Z' }
    assert.equal(segmentsOverlap(a, b), false)
  })
})

describe('validateSegments', () => {
  it('allows one active segment', () => {
    const segments = [
      {
        id: '1',
        activityType: ACTIVITY_TYPES.JOB,
        jobName: 'Site A',
        startedAt: '2026-08-28T08:00:00.000Z',
        endedAt: '2026-08-28T09:00:00.000Z',
      },
      {
        id: '2',
        activityType: ACTIVITY_TYPES.JOB,
        jobName: 'Site B',
        startedAt: '2026-08-28T09:00:00.000Z',
        endedAt: '',
      },
    ]
    const result = validateSegments(segments, { allowActive: true })
    assert.equal(result.valid, true)
    assert.equal(getActiveSegment(segments)?.id, '2')
  })

  it('rejects submitted day with active segment', () => {
    const segments = [
      {
        id: '1',
        activityType: ACTIVITY_TYPES.YARD,
        jobName: 'Yard',
        startedAt: '2026-08-28T08:00:00.000Z',
        endedAt: '',
      },
    ]
    const result = validateSegments(segments, { allowActive: false })
    assert.equal(result.valid, false)
    assert.match(result.errors[0], /active segment/)
  })

  it('rejects overlapping segments', () => {
    const segments = [
      {
        id: '1',
        activityType: ACTIVITY_TYPES.JOB,
        jobName: 'A',
        startedAt: '2026-08-28T08:00:00.000Z',
        endedAt: '2026-08-28T10:00:00.000Z',
      },
      {
        id: '2',
        activityType: ACTIVITY_TYPES.TRAVEL,
        jobName: '',
        startedAt: '2026-08-28T09:30:00.000Z',
        endedAt: '2026-08-28T10:30:00.000Z',
      },
    ]
    const result = validateSegments(segments)
    assert.equal(result.valid, false)
    assert.match(result.errors[0], /overlap/)
  })
})
