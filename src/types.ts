export type Priority = 1 | 2 | 3 | 4 // 1 = highest

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: string
  /** The day this task belongs to (YYYY-MM-DD). Moving a task changes this. */
  date: string
  title: string
  estimateMin: number
  /** Minutes added via "+N" during the day; kept separate so the estimate stays honest. */
  extraMin?: number
  priority: Priority
  dueDate?: string // YYYY-MM-DD
  status: TaskStatus
  notes?: string
  createdAt: string // ISO datetime
  completedAt?: string
  /** Set by "Partially completed": minutes still needed as of `remainingAsOf`. */
  remainingMin?: number
  /** ISO datetime. Task blocks that started before this are already folded into remainingMin. */
  remainingAsOf?: string
}

/** Meetings, lunch, etc. The planner schedules around these. */
export interface FixedEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  start: string // HH:mm
  end: string // HH:mm
  source: 'manual' | 'ics' // 'ics' reserved for a future importer
  externalId?: string
}

export type BlockKind = 'task' | 'fixed' | 'break'

/** One scheduled slot on the day's timeline. */
export interface Block {
  id: string
  date: string
  kind: BlockKind
  taskId?: string
  fixedEventId?: string
  start: string // HH:mm
  end: string // HH:mm
  /** Set when the user drags/resizes a block; the planner won't move it. */
  locked: boolean
}

export interface Settings {
  id: 'settings'
  workStart: string // "09:00"
  workEnd: string // "17:30"
  breakEveryMin: number
  breakLengthMin: number
  minBlockMin: number
  allowSplitting: boolean
}

export type SessionOutcome = 'completed' | 'overran' | 'skipped' | 'partial' | 'moved' // 'skipped' only in old logs

/** Planned vs. actual for one task block — feeds the Review view. */
export interface SessionLog {
  id: string
  taskId: string
  date: string
  plannedStart: string
  plannedEnd: string
  actualStart?: string // ISO datetime
  actualEnd?: string
  outcome: SessionOutcome
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  workStart: '09:00',
  workEnd: '17:30',
  breakEveryMin: 90,
  breakLengthMin: 10,
  minBlockMin: 15,
  allowSplitting: true,
}
