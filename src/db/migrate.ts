import { addDays, format, parseISO } from 'date-fns'
import type { Task } from '../types'

/** Shape of a task row written by schema v1 (before tasks had a date). */
export interface TaskV1 {
  id: string
  status: 'todo' | 'in_progress' | 'done' | 'deferred' | 'skipped'
  createdAt: string
  completedAt?: string
  scheduledFor?: string
  skippedOn?: string
  [key: string]: unknown
}

/** Assign a v2 `date` (and a v2 status) to a v1 task row. Pure so it can be tested. */
export function taskDateForV2(t: TaskV1, today: string): Pick<Task, 'date' | 'status'> {
  switch (t.status) {
    case 'done':
      return { date: (t.completedAt ?? t.createdAt).slice(0, 10), status: 'done' }
    case 'deferred':
      return { date: t.scheduledFor ?? today, status: 'todo' }
    case 'skipped':
      return { date: t.skippedOn ? format(addDays(parseISO(t.skippedOn), 1), 'yyyy-MM-dd') : today, status: 'todo' }
    default:
      return { date: today, status: t.status }
  }
}
