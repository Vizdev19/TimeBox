import type { Priority } from '../types'

export const priorityColor: Record<Priority, string> = {
  1: 'bg-p1',
  2: 'bg-p2',
  3: 'bg-p3',
  4: 'bg-p4',
}

export const priorityLabel: Record<Priority, string> = {
  1: 'P1 · Urgent',
  2: 'P2 · High',
  3: 'P3 · Normal',
  4: 'P4 · Low',
}
