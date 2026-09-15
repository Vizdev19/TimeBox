import { create } from 'zustand'
import { repo } from '../db/repo'
import { replanFromNow } from '../planner/replan'
import type { Unscheduled } from '../planner/plan'
import type { Block, FixedEvent, Priority, SessionLog, Settings, Task } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { dateToMin, toHHMM, toMin, todayISO } from '../utils/time'

export type View = 'plan' | 'focus' | 'review'

export interface NewTask {
  title: string
  estimateMin: number
  priority: Priority
  dueDate?: string
  notes?: string
}

interface State {
  loaded: boolean
  view: View
  now: Date
  today: string
  tasks: Task[]
  fixedEvents: FixedEvent[]
  blocks: Block[]
  logs: SessionLog[]
  settings: Settings
  unscheduled: Unscheduled[]

  load: () => Promise<void>
  tick: () => void
  setView: (v: View) => void

  addTask: (t: NewTask) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  requeueTask: (id: string) => Promise<void>

  addFixedEvent: (e: Omit<FixedEvent, 'id' | 'source'>) => Promise<void>
  deleteFixedEvent: (id: string) => Promise<void>

  updateSettings: (patch: Partial<Settings>) => Promise<void>

  planToday: () => Promise<void>
  unlockAll: () => Promise<void>
  moveBlock: (id: string, startMin: number, endMin: number) => Promise<void>

  startBlock: (id: string) => Promise<void>
  doneBlock: (id: string) => Promise<void>
  pauseBlock: (id: string) => Promise<void>
  skipBlock: (id: string) => Promise<void>
  extendBlock: (id: string, minutes: number) => Promise<void>
}

const uuid = () => crypto.randomUUID()

export const useStore = create<State>((set, get) => {
  /** Re-run the planner from the current minute and persist the result. */
  const replan = async (blocksOverride?: Block[]) => {
    const s = get()
    const nowMin = dateToMin(s.now)
    const result = replanFromNow({
      date: s.today,
      nowMin,
      tasks: s.tasks,
      fixedEvents: s.fixedEvents,
      settings: s.settings,
      existingBlocks: blocksOverride ?? s.blocks,
    })
    await repo.replaceBlocks(s.today, result.blocks)
    set({ blocks: result.blocks, unscheduled: result.unscheduled })
  }

  const saveTask = async (t: Task) => {
    await repo.putTask(t)
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === t.id ? t : x)) }))
  }

  const saveLog = async (l: SessionLog) => {
    await repo.putLog(l)
    set((s) => ({ logs: [...s.logs.filter((x) => x.id !== l.id), l] }))
  }

  const findBlock = (id: string) => {
    const b = get().blocks.find((x) => x.id === id)
    if (!b || !b.taskId) throw new Error(`No task block ${id}`)
    const t = get().tasks.find((x) => x.id === b.taskId)
    if (!t) throw new Error(`No task for block ${id}`)
    return { block: b, task: t }
  }

  /** Close out a block at `now`, writing its session log. */
  const closeBlock = async (
    block: Block,
    outcome: SessionLog['outcome'],
    nowMin: number,
  ): Promise<Block> => {
    const existing = get().logs.find((l) => l.id === block.id)
    const now = get().now.toISOString()
    await saveLog({
      id: block.id,
      taskId: block.taskId!,
      date: block.date,
      plannedStart: existing?.plannedStart ?? block.start,
      plannedEnd: existing?.plannedEnd ?? block.end,
      actualStart: existing?.actualStart ?? now,
      actualEnd: now,
      outcome,
    })
    // Truncate (finished early) or extend (overran) the block to the real end.
    // May be zero-length if closed in the same minute it started; replan drops those.
    const end = toHHMM(Math.max(nowMin, toMin(block.start)))
    return { ...block, end }
  }

  return {
    loaded: false,
    view: 'plan',
    now: new Date(),
    today: todayISO(),
    tasks: [],
    fixedEvents: [],
    blocks: [],
    logs: [],
    settings: DEFAULT_SETTINGS,
    unscheduled: [],

    load: async () => {
      const today = todayISO()
      const [tasks, fixedEvents, blocks, logs, settings] = await Promise.all([
        repo.allTasks(),
        repo.fixedEventsOn(today),
        repo.blocksOn(today),
        repo.allLogs(),
        repo.getSettings(),
      ])
      // Day rollover: tasks skipped on an earlier day go back in the queue.
      for (const t of tasks) {
        if (t.status === 'skipped' && t.skippedOn && t.skippedOn < today) {
          t.status = 'todo'
          delete t.skippedOn
          await repo.putTask(t)
        }
      }
      set({ loaded: true, today, tasks, fixedEvents, blocks, logs, settings, now: new Date() })
    },

    tick: () => {
      const now = new Date()
      const today = todayISO(now)
      if (today !== get().today) {
        void get().load()
        return
      }
      set({ now })
    },

    setView: (view) => set({ view }),

    addTask: async (nt) => {
      const t: Task = { id: uuid(), status: 'todo', createdAt: new Date().toISOString(), ...nt }
      await repo.putTask(t)
      set((s) => ({ tasks: [...s.tasks, t] }))
    },

    updateTask: async (id, patch) => {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      await saveTask({ ...t, ...patch })
    },

    deleteTask: async (id) => {
      await repo.deleteTask(id)
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        blocks: s.blocks.filter((b) => b.taskId !== id),
      }))
    },

    requeueTask: async (id) => {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      const next = { ...t, status: 'todo' as const }
      delete next.skippedOn
      delete next.completedAt
      await saveTask(next)
    },

    addFixedEvent: async (e) => {
      const ev: FixedEvent = { id: uuid(), source: 'manual', ...e }
      await repo.putFixedEvent(ev)
      if (ev.date === get().today) set((s) => ({ fixedEvents: [...s.fixedEvents, ev] }))
    },

    deleteFixedEvent: async (id) => {
      await repo.deleteFixedEvent(id)
      set((s) => ({
        fixedEvents: s.fixedEvents.filter((e) => e.id !== id),
        blocks: s.blocks.filter((b) => b.fixedEventId !== id),
      }))
    },

    updateSettings: async (patch) => {
      const settings = { ...get().settings, ...patch }
      await repo.putSettings(settings)
      set({ settings })
    },

    planToday: async () => {
      await replan()
    },

    unlockAll: async () => {
      await replan(get().blocks.map((b) => ({ ...b, locked: false })))
    },

    moveBlock: async (id, startMin, endMin) => {
      const blocks = get().blocks.map((b) =>
        b.id === id ? { ...b, start: toHHMM(startMin), end: toHHMM(endMin), locked: true } : b,
      )
      await replan(blocks)
    },

    startBlock: async (id) => {
      const { block, task } = findBlock(id)
      const s = get()
      // Only one thing in progress at a time.
      for (const other of s.tasks) {
        if (other.status === 'in_progress' && other.id !== task.id) {
          await saveTask({ ...other, status: 'todo' })
        }
      }
      await saveTask({ ...task, status: 'in_progress' })
      if (!s.logs.some((l) => l.id === id)) {
        await saveLog({
          id,
          taskId: task.id,
          date: block.date,
          plannedStart: block.start,
          plannedEnd: block.end,
          actualStart: s.now.toISOString(),
          outcome: 'partial',
        })
      }
      // If started late/early, snap the block to now so the timeline reflects reality.
      const nowMin = dateToMin(s.now)
      const startMin = toMin(block.start)
      if (nowMin !== startMin) {
        const dur = toMin(block.end) - startMin
        const moved = s.blocks.map((b) =>
          b.id === id ? { ...b, start: toHHMM(nowMin), end: toHHMM(nowMin + dur) } : b,
        )
        await replan(moved)
      }
    },

    doneBlock: async (id) => {
      const { block, task } = findBlock(id)
      const nowMin = dateToMin(get().now)
      const overran = nowMin > toMin(block.end)
      const closed = await closeBlock(block, overran ? 'overran' : 'completed', nowMin)
      await saveTask({ ...task, status: 'done', completedAt: get().now.toISOString() })
      await replan(get().blocks.map((b) => (b.id === id ? closed : b)))
    },

    pauseBlock: async (id) => {
      const { block, task } = findBlock(id)
      const nowMin = dateToMin(get().now)
      const closed = await closeBlock(block, 'partial', nowMin)
      await saveTask({ ...task, status: 'todo' })
      await replan(get().blocks.map((b) => (b.id === id ? closed : b)))
    },

    skipBlock: async (id) => {
      const { block, task } = findBlock(id)
      const s = get()
      const nowMin = dateToMin(s.now)
      const started = task.status === 'in_progress'
      let blocks: Block[]
      if (started) {
        const closed = await closeBlock(block, 'skipped', nowMin)
        blocks = s.blocks.map((b) => (b.id === id ? closed : b))
      } else {
        await saveLog({
          id,
          taskId: task.id,
          date: block.date,
          plannedStart: block.start,
          plannedEnd: block.end,
          outcome: 'skipped',
        })
        blocks = s.blocks.filter((b) => b.id !== id)
      }
      await saveTask({ ...task, status: 'skipped', skippedOn: s.today })
      await replan(blocks)
    },

    extendBlock: async (id, minutes) => {
      const { task: t0 } = findBlock(id)
      if (t0.status !== 'in_progress') await get().startBlock(id)
      const s = get()
      const task = s.tasks.find((x) => x.id === t0.id)!
      const block = s.blocks.find((b) => b.id === id)!
      const nowMin = dateToMin(s.now)
      const curEnd = Math.max(nowMin, toMin(block.end))
      const wantEnd = curEnd + minutes

      // Fixed events are immovable: clip the extension at the next one and let
      // the planner schedule the overflow as a continuation afterwards.
      const nextFixed = s.fixedEvents
        .map((f) => toMin(f.start))
        .filter((st) => st >= curEnd && st < wantEnd)
        .sort((a, b) => a - b)[0]
      const end = nextFixed ?? wantEnd
      const blocks = s.blocks.map((b) => (b.id === id ? { ...b, end: toHHMM(end) } : b))

      let extraMin = (task.extraMin ?? 0) + minutes
      if (nextFixed !== undefined) {
        // Make sure the continuation is at least one schedulable piece.
        const covered = blocks
          .filter((b) => b.taskId === task.id && (toMin(b.start) <= nowMin || b.locked))
          .reduce((n, b) => n + Math.max(0, toMin(b.end) - toMin(b.start)), 0)
        const remaining = task.estimateMin + extraMin - covered
        if (remaining < s.settings.minBlockMin) extraMin += s.settings.minBlockMin - remaining
      }
      await saveTask({ ...task, extraMin })
      await replan(blocks)
    },
  }
})

// ---- derived helpers (plain functions so components can pick what they need)

export function taskById(tasks: Task[], id?: string): Task | undefined {
  return id ? tasks.find((t) => t.id === id) : undefined
}

/** The block the user should be looking at right now. */
export function currentBlock(blocks: Block[], tasks: Task[], now: Date): Block | undefined {
  const nowMin = dateToMin(now)
  const contains = (b: Block) => toMin(b.start) <= nowMin && nowMin < toMin(b.end)
  const latestStart = (bs: Block[]) => bs.reduce<Block | undefined>((best, b) => (!best || toMin(b.start) >= toMin(best.start) ? b : best), undefined)

  // A task in progress may have several blocks (split, or paused and resumed):
  // show the one happening now, else the most recently started one.
  const running = blocks.filter((b) => taskById(tasks, b.taskId)?.status === 'in_progress')
  if (running.length > 0) {
    return latestStart(running.filter(contains)) ?? latestStart(running.filter((b) => toMin(b.start) <= nowMin)) ?? running[0]
  }
  const spanning = blocks.find((b) => contains(b) && b.kind !== 'break')
  if (spanning) return spanning
  return blocks.find((b) => toMin(b.start) >= nowMin && b.kind === 'task')
}

export function nextBlocks(blocks: Block[], after: Block | undefined, now: Date, n = 3): Block[] {
  const fromMin = after ? toMin(after.end) : dateToMin(now)
  return blocks.filter((b) => b.kind !== 'break' && toMin(b.start) >= fromMin && b.id !== after?.id).slice(0, n)
}
