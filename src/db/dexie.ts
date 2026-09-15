import Dexie, { type EntityTable } from 'dexie'
import type { Block, FixedEvent, SessionLog, Settings, Task } from '../types'

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
  }
}

export const db = new TimeBoxDB()
