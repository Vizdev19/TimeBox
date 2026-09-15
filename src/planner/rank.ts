import type { Task } from '../types'

/**
 * Order tasks for packing into the day.
 * in_progress first (it's already underway), then overdue / due today,
 * then priority (1 = highest), then earliest due date, then shortest
 * estimate (so small things still get done), then creation order.
 */
export function rankTasks(tasks: Task[], today: string): Task[] {
  const eligible = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  return [...eligible].sort((a, b) => {
    const ip = Number(b.status === 'in_progress') - Number(a.status === 'in_progress')
    if (ip !== 0) return ip
    const ua = isUrgent(a, today)
    const ub = isUrgent(b, today)
    if (ua !== ub) return ua ? -1 : 1
    if (a.priority !== b.priority) return a.priority - b.priority
    const da = a.dueDate ?? '9999-12-31'
    const db = b.dueDate ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    if (a.estimateMin !== b.estimateMin) return a.estimateMin - b.estimateMin
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  })
}

export function isUrgent(t: Task, today: string): boolean {
  return t.dueDate !== undefined && t.dueDate <= today
}
