import { beforeEach, describe, expect, it } from 'vitest'
import { planDay } from '../plan'
import { DAY, block, fixed, fmt, resetIds, seqId, settings, task } from './helpers'

beforeEach(resetIds)

const base = { date: DAY, fixedEvents: [], idGen: seqId }

describe('planDay', () => {
  it('returns nothing for an empty task list', () => {
    const r = planDay({ ...base, tasks: [], settings: settings() })
    expect(r.blocks).toEqual([])
    expect(r.unscheduled).toEqual([])
  })

  it('packs tasks back to back from workStart in rank order', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      tasks: [
        task({ id: 'low', estimateMin: 60, priority: 4 }),
        task({ id: 'high', estimateMin: 30, priority: 1 }),
      ],
    })
    expect(fmt(r.blocks)).toEqual(['high 09:00-09:30', 'low 09:30-10:30'])
  })

  it('schedules around fixed events and emits them as blocks', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      fixedEvents: [fixed('standup', '09:30', '10:00'), fixed('lunch', '12:00', '13:00')],
      tasks: [
        task({ id: 'a', estimateMin: 30, priority: 1 }),
        task({ id: 'b', estimateMin: 120, priority: 2 }),
        task({ id: 'c', estimateMin: 60, priority: 3 }),
      ],
    })
    expect(fmt(r.blocks)).toEqual([
      'a 09:00-09:30',
      'standup 09:30-10:00',
      'b 10:00-12:00',
      'lunch 12:00-13:00',
      'c 13:00-14:00',
    ])
  })

  it('ignores fixed events on other days', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      fixedEvents: [fixed('x', '09:00', '17:00', '2026-09-16')],
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:30'])
  })

  it('reports tasks that fit nowhere when the day is consumed by fixed events', () => {
    const r = planDay({
      ...base,
      settings: settings({ allowSplitting: false }),
      fixedEvents: [fixed('allday', '09:00', '17:30')],
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['allday 09:00-17:30'])
    expect(r.unscheduled).toEqual([{ taskId: 'a', remainingMin: 30 }])
  })

  it('prefers a whole placement in a later gap over splitting', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      fixedEvents: [fixed('m', '09:30', '10:00')],
      tasks: [task({ id: 'big', estimateMin: 60, priority: 1 }), task({ id: 'small', estimateMin: 30, priority: 2 })],
    })
    expect(fmt(r.blocks)).toEqual(['small 09:00-09:30', 'm 09:30-10:00', 'big 10:00-11:00'])
  })

  it('splits a task across gaps when it fits nowhere whole', () => {
    const r = planDay({
      ...base,
      settings: settings({ workEnd: '11:30' }),
      fixedEvents: [fixed('m', '10:00', '10:30')],
      tasks: [task({ id: 'big', estimateMin: 120 })],
    })
    expect(fmt(r.blocks)).toEqual(['big 09:00-10:00', 'm 10:00-10:30', 'big 10:30-11:30'])
    expect(r.unscheduled).toEqual([])
  })

  it('does not split when splitting is off', () => {
    const r = planDay({
      ...base,
      settings: settings({ workEnd: '11:30', allowSplitting: false }),
      fixedEvents: [fixed('m', '10:00', '10:30')],
      tasks: [task({ id: 'big', estimateMin: 120 })],
    })
    expect(fmt(r.blocks)).toEqual(['m 10:00-10:30'])
    expect(r.unscheduled).toEqual([{ taskId: 'big', remainingMin: 120 }])
  })

  it('never creates pieces or tails shorter than minBlockMin', () => {
    // Gaps: 09:00-09:10 (10m, too small), 09:20-09:50 (30m), 10:00-17:30
    const r = planDay({
      ...base,
      settings: settings({ minBlockMin: 15, workEnd: '10:40' }),
      fixedEvents: [fixed('a', '09:10', '09:20'), fixed('b', '09:50', '10:00')],
      tasks: [task({ id: 'big', estimateMin: 65 })],
    })
    // 65 doesn't fit whole (largest gap is 40). Split: skip the 10m gap;
    // 30 in 09:20-09:50 leaves a 35 tail; 35 in 10:00-10:35.
    expect(fmt(r.blocks)).toEqual([
      'a 09:10-09:20',
      'big 09:20-09:50',
      'b 09:50-10:00',
      'big 10:00-10:35',
    ])
  })

  it('shrinks a piece so the tail is at least minBlockMin', () => {
    // 09:00-09:55 gap (55m), then a meeting, then a big gap. Task = 60m.
    const r = planDay({
      ...base,
      settings: settings({ minBlockMin: 15, workEnd: '11:00' }),
      fixedEvents: [fixed('m', '09:55', '10:05')],
      tasks: [task({ id: 't', estimateMin: 60 })],
    })
    // naive would be 55 + 5; must be 45 + 15
    expect(fmt(r.blocks)).toEqual(['t 09:00-09:45', 'm 09:55-10:05', 't 10:05-10:20'])
  })

  it('reports a partial remainder when even splitting cannot fit everything', () => {
    const r = planDay({
      ...base,
      settings: settings({ workEnd: '10:00' }),
      tasks: [task({ id: 'big', estimateMin: 90 })],
    })
    expect(fmt(r.blocks)).toEqual(['big 09:00-10:00'])
    expect(r.unscheduled).toEqual([{ taskId: 'big', remainingMin: 30 }])
  })

  it('inserts a break after breakEveryMin of continuous task time', () => {
    const r = planDay({
      ...base,
      settings: settings({ breakEveryMin: 90, breakLengthMin: 10 }),
      tasks: [
        task({ id: 'a', estimateMin: 60, priority: 1 }),
        task({ id: 'b', estimateMin: 30, priority: 2 }),
        task({ id: 'c', estimateMin: 30, priority: 3 }),
        task({ id: 'd', estimateMin: 60, priority: 4 }),
      ],
    })
    expect(fmt(r.blocks)).toEqual([
      'a 09:00-10:00',
      'b 10:00-10:30', // 90 accumulated -> break due before next
      'break 10:30-10:40',
      'c 10:40-11:10',
      'd 11:10-12:10',
    ])
  })

  it('resets the break counter at a fixed-event boundary', () => {
    const r = planDay({
      ...base,
      settings: settings({ breakEveryMin: 60, breakLengthMin: 10 }),
      fixedEvents: [fixed('m', '10:00', '10:30')],
      tasks: [task({ id: 'a', estimateMin: 60, priority: 1 }), task({ id: 'b', estimateMin: 60, priority: 2 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-10:00', 'm 10:00-10:30', 'b 10:30-11:30'])
  })

  it('starts from fromMin rather than workStart', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      fromMin: 14 * 60,
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 14:00-14:30'])
  })

  it('omits fixed events that already ended before fromMin', () => {
    const r = planDay({
      ...base,
      settings: settings(),
      fromMin: 14 * 60,
      fixedEvents: [fixed('morning', '09:00', '10:00'), fixed('afternoon', '15:00', '16:00')],
      tasks: [],
    })
    expect(fmt(r.blocks)).toEqual(['afternoon 15:00-16:00'])
  })

  it('keeps keepBlocks verbatim, schedules around them, and credits their time to the task', () => {
    const kept = block({ id: 'k', taskId: 'a', start: '11:00', end: '11:30', locked: true })
    const r = planDay({
      ...base,
      settings: settings(),
      keepBlocks: [kept],
      tasks: [task({ id: 'a', estimateMin: 45, priority: 1 }), task({ id: 'b', estimateMin: 150, priority: 2 })],
    })
    // 'a' has 15 remaining. 'b' (150) fits whole in 09:00-11:00? No (120). Fits in 11:30-17:30 → yes.
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:15', 'a 11:00-11:30 L', 'b 11:30-14:00'])
  })

  it('skips a task fully covered by keepBlocks', () => {
    const kept = block({ taskId: 'a', start: '09:00', end: '09:30', locked: true })
    const r = planDay({
      ...base,
      settings: settings(),
      keepBlocks: [kept],
      tasks: [task({ id: 'a', estimateMin: 30 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:30 L'])
  })

  it('does not duplicate a fixed event already present in keepBlocks', () => {
    const kept = block({ kind: 'fixed', fixedEventId: 'm', start: '10:00', end: '10:30' })
    const r = planDay({
      ...base,
      settings: settings(),
      keepBlocks: [kept],
      fixedEvents: [fixed('m', '10:00', '10:30')],
      tasks: [],
    })
    expect(fmt(r.blocks)).toEqual(['m 10:00-10:30'])
  })

  it('is deterministic', () => {
    const input = {
      ...base,
      settings: settings({ breakEveryMin: 60, breakLengthMin: 5 }),
      fixedEvents: [fixed('m', '11:00', '12:00')],
      tasks: [task({ id: 'a', estimateMin: 90 }), task({ id: 'b', estimateMin: 45 }), task({ id: 'c', estimateMin: 200 })],
    }
    resetIds()
    const one = planDay(input)
    resetIds()
    const two = planDay(input)
    expect(one).toEqual(two)
  })
})

describe('planDay extraMin', () => {
  it('adds extraMin to the task remaining time', () => {
    resetIds()
    const r = planDay({
      ...base,
      settings: settings(),
      keepBlocks: [block({ taskId: 'a', start: '09:00', end: '09:45', locked: true })],
      tasks: [task({ id: 'a', estimateMin: 45, extraMin: 20 })],
    })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:45 L', 'a 09:45-10:05'])
  })
})
