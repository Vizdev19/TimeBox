import { describe, expect, it } from 'vitest'
import { taskDateForV2 } from '../migrate'

const TODAY = '2026-09-16'
const base = { id: 'x', createdAt: '2026-09-01T10:00:00.000Z' }

describe('taskDateForV2', () => {
  it('puts open tasks on today', () => {
    expect(taskDateForV2({ ...base, status: 'todo' }, TODAY)).toEqual({ date: TODAY, status: 'todo' })
    expect(taskDateForV2({ ...base, status: 'in_progress' }, TODAY)).toEqual({ date: TODAY, status: 'in_progress' })
  })
  it('dates done tasks by completion, falling back to creation', () => {
    expect(taskDateForV2({ ...base, status: 'done', completedAt: '2026-09-15T16:00:00.000Z' }, TODAY)).toEqual({ date: '2026-09-15', status: 'done' })
    expect(taskDateForV2({ ...base, status: 'done' }, TODAY)).toEqual({ date: '2026-09-01', status: 'done' })
  })
  it('turns deferred into a todo on its scheduled day', () => {
    expect(taskDateForV2({ ...base, status: 'deferred', scheduledFor: '2026-09-18' }, TODAY)).toEqual({ date: '2026-09-18', status: 'todo' })
  })
  it('turns legacy skipped into a todo the day after it was skipped', () => {
    expect(taskDateForV2({ ...base, status: 'skipped', skippedOn: '2026-09-14' }, TODAY)).toEqual({ date: '2026-09-15', status: 'todo' })
  })
})
