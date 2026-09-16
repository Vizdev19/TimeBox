import { create } from 'zustand'
import { addDays, format, parseISO } from 'date-fns'
import { repo } from '../db/repo'
import { replanFromNow } from '../planner/replan'
import { checkpoint, remainingFor, unfoldedBlocks } from '../planner/budget'
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
  /** The clock's day. */
  today: string
  /** The day being viewed/planned. Focus always uses today. */
  date: string
  tasks: Task[]
  fixedEvents: FixedEvent[]
  blocks: Block[]
  logs: SessionLog[]
  settings: Settings
  unscheduled: Unscheduled[]
  /** Unfinished tasks from earlier days awaiting a decision. */
  leftovers: Task[]

  load: () => Promise<void>
  loadDay: (date: string) => Promise<void>
  setDate: (date: string) => Promise<void>
  shiftDate: (days: number) => Promise<void>
  tick: () => void
  setView: (v: View) => void

  addTask: (t: NewTask) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  /** Mark done, from the list or Focus. Closes a running block if there is one. */
  completeTask: (id: string) => Promise<void>
  /** Record a partial-completion checkpoint and continue on `continueOn`. */
  markPartial: (id: string, remainingMin: number, continueOn: string) => Promise<void>
  /** Put the task on another day. Works for leftovers too. */
  moveTask: (id: string, date: string) => Promise<void>
  /** done -> todo on the same day. */
  reopenTask: (id: string) => Promise<void>

  addFixedEvent: (e: Omit<FixedEvent, 'id' | 'source' | 'date'>) => Promise<void>
  deleteFixedEvent: (id: string) => Promise<void>

  updateSettings: (patch: Partial<Settings>) => Promise<void>

  planDay: () => Promise<void>
  unlockAll: () => Promise<void>
  moveBlock: (id: string, startMin: number, endMin: number) => Promise<void>

  startBlock: (id: string) => Promise<void>
  doneBlock: (id: string) => Promise<void>
  pauseBlock: (id: string) => Promise<void>
  extendBlock: (id: string, minutes: number) => Promise<void>
}

const uuid = () => crypto.randomUUID()

export const useStore = create<State>((set, get) => {
  /**
   * Re-run the planner for the viewed day and persist the result.
   * Today plans from the current minute; future days from workStart;
   * past days are history and never re-planned.
   */
  const replan = async (blocksOverride?: Block[]) => {
    const s = get()
    if (s.date < s.today) return
    const nowMin = s.date === s.today ? dateToMin(s.now) : 0
    const result = replanFromNow({
      date: s.date,
      nowMin,
      tasks: s.tasks,
      fixedEvents: s.fixedEvents,
      settings: s.settings,
      existingBlocks: blocksOverride ?? s.blocks,
    })
    await repo.replaceBlocks(s.date, result.blocks)
    set({ blocks: result.blocks, unscheduled: result.unscheduled })
  }

  /** Persist a task and reflect it in whichever list holds it (day list or leftovers). */
  const saveTask = async (t: Task) => {
    await repo.putTask(t)
    set((s) => ({
      tasks: s.tasks.some((x) => x.id === t.id)
        ? s.tasks.map((x) => (x.id === t.id ? t : x))
        : t.date === s.date
          ? [...s.tasks, t]
          : s.tasks,
      leftovers: s.leftovers.map((x) => (x.id === t.id ? t : x)),
    }))
  }

  const saveLog = async (l: SessionLog) => {
    await repo.putLog(l)
    set((s) => ({ logs: [...s.logs.filter((x) => x.id !== l.id), l] }))
  }

  const anyTask = (id: string) => get().tasks.find((x) => x.id === id) ?? get().leftovers.find((x) => x.id === id)

  const findBlock = (id: string) => {
    const b = get().blocks.find((x) => x.id === id)
    if (!b || !b.taskId) throw new Error(`No task block ${id}`)
    const t = get().tasks.find((x) => x.id === b.taskId)
    if (!t) throw new Error(`No task for block ${id}`)
    return { block: b, task: t }
  }

  /** Close out a block at `now`, writing its session log. */
  const closeBlock = async (block: Block, outcome: SessionLog['outcome'], nowMin: number): Promise<Block> => {
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

  /**
   * Close the task's running block (if any) with `outcome`, or log its planned
   * slot when it was never started. Returns the day's blocks with the change applied.
   */
  const settleBlocks = async (task: Task, outcome: SessionLog['outcome'], dropFuture: boolean): Promise<Block[]> => {
    const s = get()
    const nowMin = dateToMin(s.now)
    let blocks = s.blocks
    const running = task.status === 'in_progress' ? currentBlock(s.blocks, s.tasks, s.now) : undefined
    if (running && running.taskId === task.id) {
      const closed = await closeBlock(running, outcome, nowMin)
      blocks = blocks.map((b) => (b.id === running.id ? closed : b))
    } else if (s.date === s.today) {
      const planned = s.blocks.find((b) => b.taskId === task.id && (outcome === 'completed' || toMin(b.end) > nowMin))
      if (planned && !s.logs.some((l) => l.id === planned.id)) {
        await saveLog({ id: planned.id, taskId: task.id, date: planned.date, plannedStart: planned.start, plannedEnd: planned.end, outcome })
      }
    }
    if (dropFuture) blocks = blocks.filter((b) => !(b.taskId === task.id && (s.date > s.today || toMin(b.start) >= nowMin)))
    return blocks
  }

  const refreshLeftovers = async () => {
    const leftovers = await repo.leftoversBefore(get().today)
    set({ leftovers })
  }

  return {
    loaded: false,
    view: 'plan',
    now: new Date(),
    today: todayISO(),
    date: todayISO(),
    tasks: [],
    fixedEvents: [],
    blocks: [],
    logs: [],
    settings: DEFAULT_SETTINGS,
    unscheduled: [],
    leftovers: [],

    load: async () => {
      const now = new Date()
      const today = todayISO(now)
      const [logs, settings] = await Promise.all([repo.allLogs(), repo.getSettings()])
      set({ today, logs, settings, now })

      // Day rollover housekeeping for unfinished tasks from earlier days:
      // a timer can't span days, and work done back then folds into the checkpoint.
      for (const t of await repo.leftoversBefore(today)) {
        let changed = false
        if (t.status === 'in_progress') {
          t.status = 'todo'
          changed = true
        }
        const past = unfoldedBlocks(t, await repo.blocksForTask(t.id)).filter((b) => b.date < today)
        if (past.length > 0) {
          Object.assign(t, checkpoint(t, past, now))
          changed = true
        }
        if (changed) await repo.putTask(t)
      }

      await get().loadDay(today)
      await refreshLeftovers()
      set({ loaded: true })
    },

    loadDay: async (date) => {
      const [tasks, fixedEvents, blocks] = await Promise.all([repo.tasksOn(date), repo.fixedEventsOn(date), repo.blocksOn(date)])
      set({ date, tasks, fixedEvents, blocks, unscheduled: [] })
    },

    setDate: async (date) => {
      if (date !== get().date) await get().loadDay(date)
    },

    shiftDate: async (days) => {
      await get().setDate(format(addDays(parseISO(get().date), days), 'yyyy-MM-dd'))
    },

    tick: () => {
      const now = new Date()
      if (todayISO(now) !== get().today) {
        void get().load()
        return
      }
      set({ now })
    },

    setView: (view) => {
      set({ view })
      if (view === 'focus') void get().setDate(get().today)
    },

    addTask: async (nt) => {
      const t: Task = { id: uuid(), date: get().date, status: 'todo', createdAt: new Date().toISOString(), ...nt }
      await repo.putTask(t)
      set((s) => ({ tasks: [...s.tasks, t] }))
    },

    updateTask: async (id, patch) => {
      const t = anyTask(id)
      if (!t) return
      await saveTask({ ...t, ...patch })
    },

    deleteTask: async (id) => {
      await repo.deleteTask(id)
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        leftovers: s.leftovers.filter((t) => t.id !== id),
        blocks: s.blocks.filter((b) => b.taskId !== id),
      }))
    },

    completeTask: async (id) => {
      const task = anyTask(id)
      if (!task) return
      const s = get()
      const nowMin = dateToMin(s.now)
      const running = task.status === 'in_progress' ? currentBlock(s.blocks, s.tasks, s.now) : undefined
      const overran = running ? nowMin > toMin(running.end) : false
      const blocks = await settleBlocks(task, overran ? 'overran' : 'completed', false)
      await saveTask({ ...task, status: 'done', completedAt: s.now.toISOString() })
      await replan(blocks)
      await refreshLeftovers()
    },

    markPartial: async (id, remainingMin, continueOn) => {
      const task = anyTask(id)
      if (!task) return
      const s = get()
      let blocks = await settleBlocks(task, 'partial', continueOn !== s.date)
      // The user is re-deciding this task: release any pinned future blocks.
      const nowMin = dateToMin(s.now)
      blocks = blocks.map((b) => (b.taskId === id && b.locked && toMin(b.end) > nowMin ? { ...b, locked: false } : b))
      const next: Task = {
        ...task,
        date: continueOn,
        status: 'todo',
        remainingMin: Math.max(0, Math.round(remainingMin)),
        remainingAsOf: s.now.toISOString(),
      }
      await saveTask(next)
      if (next.date !== s.date) set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) }))
      await replan(blocks)
      await refreshLeftovers()
    },

    moveTask: async (id, date) => {
      const task = anyTask(id)
      if (!task) return
      const s = get()
      const blocks = await settleBlocks(task, 'moved', date !== s.date)
      await saveTask({ ...task, date, status: 'todo' })
      if (date !== s.date) set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) }))
      await replan(blocks)
      await refreshLeftovers()
    },

    reopenTask: async (id) => {
      const t = anyTask(id)
      if (!t) return
      const next: Task = { ...t, status: 'todo' }
      delete next.completedAt
      await saveTask(next)
      await replan()
    },

    addFixedEvent: async (e) => {
      const ev: FixedEvent = { id: uuid(), source: 'manual', date: get().date, ...e }
      await repo.putFixedEvent(ev)
      set((s) => ({ fixedEvents: [...s.fixedEvents, ev] }))
      await replan()
    },

    deleteFixedEvent: async (id) => {
      await repo.deleteFixedEvent(id)
      set((s) => ({
        fixedEvents: s.fixedEvents.filter((e) => e.id !== id),
        blocks: s.blocks.filter((b) => b.fixedEventId !== id),
      }))
      await replan()
    },

    updateSettings: async (patch) => {
      const settings = { ...get().settings, ...patch }
      await repo.putSettings(settings)
      set({ settings })
    },

    planDay: async () => {
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
        const moved = s.blocks.map((b) => (b.id === id ? { ...b, start: toHHMM(nowMin), end: toHHMM(nowMin + dur) } : b))
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

      // A checkpointed task grows its remaining figure; otherwise the extension is logged as extra.
      const bump = (t: Task, n: number): Task =>
        t.remainingMin !== undefined ? { ...t, remainingMin: t.remainingMin + n } : { ...t, extraMin: (t.extraMin ?? 0) + n }
      let added = minutes
      if (nextFixed !== undefined) {
        // Make sure the continuation is at least one schedulable piece.
        const kept = blocks.filter((b) => toMin(b.start) <= nowMin || b.locked)
        const remaining = remainingFor(bump(task, added), kept, s.date)
        if (remaining < s.settings.minBlockMin) added += s.settings.minBlockMin - remaining
      }
      await saveTask(bump(task, added))
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
  const latestStart = (bs: Block[]) =>
    bs.reduce<Block | undefined>((best, b) => (!best || toMin(b.start) >= toMin(best.start) ? b : best), undefined)

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

/** Human label for a day relative to today. */
export function dayLabel(date: string, today: string): string {
  const d = parseISO(date)
  const nice = format(d, 'EEE d MMM')
  if (date === today) return `${nice} · Today`
  const diff = Math.round((d.getTime() - parseISO(today).getTime()) / 86400000)
  if (diff === 1) return `${nice} · Tomorrow`
  if (diff === -1) return `${nice} · Yesterday`
  return nice
}
