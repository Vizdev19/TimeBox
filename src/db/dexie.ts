import Dexie, { type EntityTable } from 'dexie'
import type { Block, FixedEvent, SessionLog, Settings, Task } from '../types'
import { todayISO } from '../utils/time'
import { taskDateForV2, type TaskV1 } from './migrate'

export class TimeBoxDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  fixedEvents!: EntityTable<FixedEvent, 'id'>
  blocks!: EntityTable<Block, 'id'>
  sessionLogs!: EntityTable<SessionLog, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('timebox')
    this.version(1).stores({
      tasks: 'id, status, priority, dueDate, createdAt',
      fixedEvents: 'id, date, [date+start]',
      blocks: 'id, date, taskId, fixedEventId, [date+start]',
      sessionLogs: 'id, taskId, date',
      settings: 'id',
    })
    // v2: tasks belong to a day.
    this.version(2)
      .stores({
        tasks: 'id, date, status, [date+status], priority, dueDate, createdAt',
      })
      .upgrade(async (tx) => {
        const today = todayISO()
        await tx
          .table('tasks')
          .toCollection()
          .modify((t: TaskV1 & Partial<Task>) => {
            if (t.date) return
            Object.assign(t, taskDateForV2(t, today))
            delete t.scheduledFor
            delete t.skippedOn
          })
      })
  }
}

export const db = new TimeBoxDB()
