import { beforeEach, describe, expect, it } from 'vitest'
import { budgetOf, checkpoint, coveredMin, remainingFor } from '../budget'
import { planDay } from '../plan'
import { DAY, block, fmt, resetIds, seqId, settings, task } from './helpers'

beforeEach(resetIds)

describe('budgetOf', () => {
  it('is estimate plus extensions by default', () => {
    expect(budgetOf(task({ id: 'a', estimateMin: 60 }))).toBe(60)
    expect(budgetOf(task({ id: 'a', estimateMin: 60, extraMin: 15 }))).toBe(75)
  })
  it('is overridden by a partial-completion checkpoint', () => {
    expect(budgetOf(task({ id: 'a', estimateMin: 60, extraMin: 15, remainingMin: 20 }))).toBe(20)
  })
})

describe('coveredMin', () => {
  const blocks = [
    block({ taskId: 'a', start: '09:00', end: '09:20' }),
    block({ taskId: 'a', start: '11:00', end: '11:30' }),
    block({ taskId: 'b', start: '12:00', end: '13:00' }),
    block({ kind: 'break', start: '13:00', end: '13:10' }),
    block({ taskId: 'a', start: '09:00', end: '10:00', date: '2026-09-14' }),
  ]
  it('sums the task blocks on the date only', () => {
    expect(coveredMin(task({ id: 'a', estimateMin: 60 }), blocks, DAY)).toBe(50)
  })
  it('ignores blocks that started before the checkpoint', () => {
    const t = task({ id: 'a', estimateMin: 60, remainingMin: 30, remainingAsOf: `${DAY}T10:00:00` })
    expect(coveredMin(t, blocks, DAY)).toBe(30)
    expect(remainingFor(t, blocks, DAY)).toBe(0)
  })
})

describe('checkpoint', () => {
  it('folds a paused block into a fresh remaining figure', () => {
    const t = task({ id: 'a', estimateMin: 60 })
    const now = new Date(2026, 8, 15, 9, 20)
    const cp = checkpoint(t, [block({ taskId: 'a', start: '09:00', end: '09:20' })], now)
    expect(cp.remainingMin).toBe(40)
    expect(new Date(cp.remainingAsOf!).getTime()).toBe(now.getTime())
  })
  it('folds blocks across days but not ones already folded', () => {
    const t = task({ id: 'a', estimateMin: 90, remainingMin: 50, remainingAsOf: '2026-09-14T12:00:00' })
    const blocks = [
      block({ taskId: 'a', start: '09:00', end: '10:00', date: '2026-09-14' }), // before checkpoint
      block({ taskId: 'a', start: '14:00', end: '14:20', date: '2026-09-14' }),
      block({ taskId: 'a', start: '09:00', end: '09:10', date: DAY }),
    ]
    expect(checkpoint(t, blocks, new Date()).remainingMin).toBe(20)
  })
  it('never goes negative', () => {
    const t = task({ id: 'a', estimateMin: 10 })
    expect(checkpoint(t, [block({ taskId: 'a', start: '09:00', end: '10:00' })], new Date()).remainingMin).toBe(0)
  })
})

describe('planDay with a checkpoint', () => {
  const base = { date: DAY, fixedEvents: [], idGen: seqId, settings: settings() }

  it('schedules the checkpointed remainder, not remainder minus pre-checkpoint work', () => {
    const t = task({ id: 'a', estimateMin: 60, remainingMin: 30, remainingAsOf: `${DAY}T09:30:00` })
    const paused = block({ taskId: 'a', start: '09:00', end: '09:20' })
    const r = planDay({ ...base, fromMin: 9 * 60 + 30, keepBlocks: [paused], tasks: [t] })
    expect(fmt(r.blocks)).toEqual(['a 09:00-09:20', 'a 09:30-10:00'])
  })

  it('credits kept blocks that started after the checkpoint', () => {
    const t = task({ id: 'a', estimateMin: 60, remainingMin: 30, remainingAsOf: `${DAY}T09:30:00` })
    const inProgress = block({ taskId: 'a', start: '09:40', end: '09:50' })
    const r = planDay({ ...base, fromMin: 9 * 60 + 50, keepBlocks: [inProgress], tasks: [t] })
    expect(fmt(r.blocks)).toEqual(['a 09:40-09:50', 'a 09:50-10:10'])
  })
})
