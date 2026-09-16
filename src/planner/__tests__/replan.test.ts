import { beforeEach, describe, expect, it } from 'vitest'
import { replanFromNow } from '../replan'
import { DAY, block, fixed, fmt, resetIds, seqId, settings, task } from './helpers'

beforeEach(resetIds)

const base = { date: DAY, fixedEvents: [], settings: settings(), idGen: seqId }

describe('replanFromNow', () => {
  it('acts as the initial plan when there are no existing blocks', () => {
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60,
      existingBlocks: [],
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:30'])
  })

  it('keeps finished blocks and drops future unlocked ones', () => {
    const existing = [
      block({ taskId: 'a', start: '09:00', end: '10:00' }),
      block({ taskId: 'b', start: '10:00', end: '11:00' }),
      block({ kind: 'break', start: '11:00', end: '11:10' }),
      block({ taskId: 'c', start: '11:10', end: '12:00' }),
    ]
    const r = replanFromNow({
      ...base,
      nowMin: 10 * 60 + 30,
      existingBlocks: existing,
      tasks: [
        task({ id: 'a', estimateMin: 60, status: 'done' }),
        task({ id: 'b', estimateMin: 60, status: 'done' }),
        task({ id: 'c', estimateMin: 50 }),
      ],
    })
    // b was skipped mid-block at 10:30: its unlocked block is not in progress -> dropped,
    // c gets pulled forward to now.
    expect(fmt(r.blocks)).toEqual(['a 09:00-10:00', 'c 10:30-11:20'])
  })

  it('pins the in-progress block and pushes the rest after an extension', () => {
    const existing = [
      block({ taskId: 'a', start: '09:00', end: '10:15' }), // already extended by +15 by the store
      block({ taskId: 'b', start: '10:00', end: '10:30' }),
    ]
    const r = replanFromNow({
      ...base,
      nowMin: 10 * 60,
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60, status: 'in_progress' }), task({ id: 'b', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-10:15', 'b 10:15-10:45'])
  })

  it('reclaims time when a task finishes early', () => {
    const existing = [
      block({ taskId: 'a', start: '09:00', end: '09:40' }), // store truncated to now on Done
      block({ taskId: 'b', start: '10:00', end: '10:30' }),
    ]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60 + 40,
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60, status: 'done' }), task({ id: 'b', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:40', 'b 09:40-10:10'])
  })

  it('respects locked future blocks and schedules around them', () => {
    const existing = [
      block({ taskId: 'a', start: '14:00', end: '15:00', locked: true }),
      block({ taskId: 'b', start: '09:00', end: '10:00' }),
    ]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60,
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60, priority: 1 }), task({ id: 'b', estimateMin: 360, priority: 2 })],
    })
    // a is fully covered by its locked block; b (6h) doesn't fit whole anywhere so it splits.
    expect(fmt(r.blocks)).toEqual(['b 09:00-14:00', 'a 14:00-15:00 L', 'b 15:00-16:00'])
  })

  it('re-emits a fixed event that spans now without duplicating it', () => {
    const existing = [block({ kind: 'fixed', fixedEventId: 'm', start: '09:30', end: '10:30' })]
    const r = replanFromNow({
      ...base,
      nowMin: 10 * 60,
      fixedEvents: [fixed('m', '09:30', '10:30')],
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['m 09:30-10:30', 'a 10:30-11:00'])
  })

  it('drops an unstarted block that is already past its start (user is late) and re-packs from now', () => {
    const existing = [block({ taskId: 'a', start: '09:00', end: '10:00' })]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60 + 30,
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:30-10:30'])
  })
})

describe('replanFromNow edge cases', () => {
  it('drops a zero-length block closed in the same minute it started', () => {
    const existing = [block({ taskId: 'a', start: '09:00', end: '09:00' }), block({ taskId: 'b', start: '09:20', end: '09:50' })]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60,
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 20, status: 'done' }), task({ id: 'b', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['b 09:00-09:30'])
  })
})

describe('replanFromNow with conflicting fixed events', () => {
  it('releases a locked block that a fixed event now overlaps', () => {
    const existing = [block({ taskId: 'a', start: '14:00', end: '15:00', locked: true })]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60,
      fixedEvents: [fixed('m', '14:30', '15:00')],
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-10:00', 'm 14:30-15:00'])
  })

  it('keeps a locked block that does not collide', () => {
    const existing = [block({ taskId: 'a', start: '14:00', end: '15:00', locked: true })]
    const r = replanFromNow({
      ...base,
      nowMin: 9 * 60,
      fixedEvents: [fixed('m', '15:00', '15:30')],
      existingBlocks: existing,
      tasks: [task({ id: 'a', estimateMin: 60 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 14:00-15:00 L', 'm 15:00-15:30'])
  })
})
