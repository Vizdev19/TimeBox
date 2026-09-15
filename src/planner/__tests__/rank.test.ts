import { describe, expect, it } from 'vitest'
import { rankTasks } from '../rank'
import { DAY, task } from './helpers'

describe('rankTasks', () => {
  it('excludes done and skipped tasks', () => {
    const r = rankTasks(
      [
        task({ id: 'a', estimateMin: 30, status: 'done' }),
        task({ id: 'b', estimateMin: 30, status: 'skipped' }),
        task({ id: 'c', estimateMin: 30 }),
      ],
      DAY,
    )
    expect(r.map((t) => t.id)).toEqual(['c'])
  })

  it('orders: in_progress > urgent > priority > due date > estimate > created', () => {
    const r = rankTasks(
      [
        task({ id: 'p4', estimateMin: 30, priority: 4 }),
        task({ id: 'p1-long', estimateMin: 90, priority: 1 }),
        task({ id: 'p1-short', estimateMin: 20, priority: 1 }),
        task({ id: 'due-later', estimateMin: 30, priority: 2, dueDate: '2026-09-20' }),
        task({ id: 'due-sooner', estimateMin: 30, priority: 2, dueDate: '2026-09-18' }),
        task({ id: 'overdue-p4', estimateMin: 30, priority: 4, dueDate: '2026-09-10' }),
        task({ id: 'due-today-p3', estimateMin: 30, priority: 3, dueDate: DAY }),
        task({ id: 'running', estimateMin: 30, priority: 4, status: 'in_progress' }),
      ],
      DAY,
    )
    expect(r.map((t) => t.id)).toEqual([
      'running',
      'due-today-p3', // urgent, priority 3 beats overdue p4
      'overdue-p4',
      'p1-short',
      'p1-long',
      'due-sooner',
      'due-later',
      'p4',
    ])
  })
})
