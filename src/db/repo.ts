import { db } from './dexie'
import {
  DEFAULT_SETTINGS,
  type Block,
  type FixedEvent,
  type SessionLog,
  type Settings,
  type Task,
} from '../types'

export const repo = {
  // ---- tasks
  allTasks: () => db.tasks.orderBy('createdAt').toArray(),
  /** Tasks on a day, plus any task referenced by that day's blocks (so old timelines stay labelled). */
  tasksOn: async (date: string): Promise<Task[]> => {
    const own = await db.tasks.where('date').equals(date).sortBy('createdAt')
    const ids = new Set(own.map((t) => t.id))
    const refs = (await db.blocks.where('date').equals(date).toArray())
      .map((b) => b.taskId)
      .filter((id): id is string => !!id && !ids.has(id))
    const extra = (await db.tasks.bulkGet([...new Set(refs)])).filter((t): t is Task => !!t)
    return [...own, ...extra]
  },
  /** Unfinished tasks from days before `today`. */
  leftoversBefore: (today: string) =>
    db.tasks
      .where('status')
      .anyOf('todo', 'in_progress')
      .filter((t) => t.date < today)
      .sortBy('date'),
  blocksForTask: (taskId: string) => db.blocks.where('taskId').equals(taskId).toArray(),
  putTask: (t: Task) => db.tasks.put(t),
  deleteTask: async (id: string) => {
    await db.transaction('rw', db.tasks, db.blocks, async () => {
      await db.tasks.delete(id)
      await db.blocks.where('taskId').equals(id).delete()
    })
  },

  // ---- fixed events
  fixedEventsOn: (date: string) => db.fixedEvents.where('date').equals(date).toArray(),
  putFixedEvent: (e: FixedEvent) => db.fixedEvents.put(e),
  deleteFixedEvent: async (id: string) => {
    await db.transaction('rw', db.fixedEvents, db.blocks, async () => {
      await db.fixedEvents.delete(id)
      await db.blocks.where('fixedEventId').equals(id).delete()
    })
  },

  // ---- blocks
  blocksOn: (date: string) => db.blocks.where('date').equals(date).sortBy('start'),
  /** Replace the day's blocks atomically. */
  replaceBlocks: async (date: string, blocks: Block[]) => {
    await db.transaction('rw', db.blocks, async () => {
      await db.blocks.where('date').equals(date).delete()
      await db.blocks.bulkPut(blocks)
    })
  },
  putBlock: (b: Block) => db.blocks.put(b),

  // ---- session logs
  putLog: (l: SessionLog) => db.sessionLogs.put(l),
  allLogs: () => db.sessionLogs.orderBy('date').toArray(),
  logsOn: (date: string) => db.sessionLogs.where('date').equals(date).toArray(),

  // ---- settings
  getSettings: async (): Promise<Settings> =>
    (await db.settings.get('settings')) ?? DEFAULT_SETTINGS,
  putSettings: (s: Settings) => db.settings.put(s),
}
