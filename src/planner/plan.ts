import type { Block, FixedEvent, Settings, Task } from '../types'
import { subtractRanges, toHHMM, toMin, type Range } from '../utils/time'
import { rankTasks } from './rank'
import { remainingFor } from './budget'

export interface PlanInput {
  date: string
  tasks: Task[]
  fixedEvents: FixedEvent[]
  settings: Settings
  /**
   * Blocks the planner must leave untouched: finished blocks, the block
   * currently in progress, and anything the user locked by dragging.
   * They are subtracted from the free window and re-emitted as-is.
   */
  keepBlocks?: Block[]
  /** Minutes since midnight to start planning from (defaults to workStart). */
  fromMin?: number
  idGen?: () => string
}

export interface Unscheduled {
  taskId: string
  remainingMin: number
}

export interface PlanResult {
  blocks: Block[]
  unscheduled: Unscheduled[]
}

interface Gap extends Range {
  cursor: number
  sinceBreak: number
}

const defaultIdGen = () => crypto.randomUUID()

/**
 * Deterministic day planner. Pure: same input -> same output (ids aside).
 *
 * 1. Free window = [max(workStart, fromMin), workEnd] minus fixed events
 *    minus keepBlocks.
 * 2. Tasks are ranked (see rankTasks). Each task's remaining time is its
 *    budget (see budget.ts) minus whatever keepBlocks already cover for it.
 * 3. First-fit: a task goes whole into the first gap it fits. If it fits
 *    nowhere and splitting is on, it is spread across gaps in pieces no
 *    smaller than minBlockMin. Otherwise it is reported as unscheduled.
 * 4. A break is inserted before a task whenever `breakEveryMin` of
 *    continuous task time has accumulated in the current gap. The counter
 *    resets at gap boundaries (a meeting is at least a context switch).
 */
export function planDay(input: PlanInput): PlanResult {
  const { date, tasks, fixedEvents, settings } = input
  const keep = input.keepBlocks ?? []
  const idGen = input.idGen ?? defaultIdGen
  const workStart = toMin(settings.workStart)
  const workEnd = toMin(settings.workEnd)
  const from = Math.max(workStart, input.fromMin ?? workStart)

  const out: Block[] = [...keep]

  // Fixed events become blocks unless a kept block already represents them.
  const keptFixedIds = new Set(keep.filter((b) => b.fixedEventId).map((b) => b.fixedEventId))
  const fixedRanges: Range[] = []
  for (const ev of fixedEvents) {
    if (ev.date !== date) continue
    const r = { start: toMin(ev.start), end: toMin(ev.end) }
    fixedRanges.push(r)
    if (r.end > from && !keptFixedIds.has(ev.id)) {
      out.push({
        id: idGen(),
        date,
        kind: 'fixed',
        fixedEventId: ev.id,
        start: ev.start,
        end: ev.end,
        locked: false,
      })
    }
  }

  const keepRanges: Range[] = keep.map((b) => ({ start: toMin(b.start), end: toMin(b.end) }))
  const gaps: Gap[] = subtractRanges([{ start: from, end: workEnd }], [...fixedRanges, ...keepRanges])
    .map((g) => ({ ...g, cursor: g.start, sinceBreak: 0 }))

  const unscheduled: Unscheduled[] = []
  const minPiece = Math.max(1, settings.minBlockMin)

  const emitTask = (g: Gap, task: Task, mins: number) => {
    out.push({
      id: idGen(),
      date,
      kind: 'task',
      taskId: task.id,
      start: toHHMM(g.cursor),
      end: toHHMM(g.cursor + mins),
      locked: false,
    })
    g.cursor += mins
    g.sinceBreak += mins
  }

  const breakDue = (g: Gap) =>
    settings.breakEveryMin > 0 && settings.breakLengthMin > 0 && g.sinceBreak >= settings.breakEveryMin

  /** Insert a break at the gap cursor if one is due and there's room for it plus some work. */
  const maybeBreak = (g: Gap): boolean => {
    if (!breakDue(g)) return true
    const room = g.end - g.cursor
    if (room < settings.breakLengthMin + minPiece) return false
    out.push({
      id: idGen(),
      date,
      kind: 'break',
      start: toHHMM(g.cursor),
      end: toHHMM(g.cursor + settings.breakLengthMin),
      locked: false,
    })
    g.cursor += settings.breakLengthMin
    g.sinceBreak = 0
    return true
  }

  for (const task of rankTasks(tasks, date)) {
    let remaining = remainingFor(task, keep, date)
    if (remaining <= 0) continue

    // First-fit whole.
    const whole = gaps.find((g) => {
      const need = remaining + (breakDue(g) ? settings.breakLengthMin : 0)
      return g.end - g.cursor >= need
    })
    if (whole) {
      maybeBreak(whole)
      emitTask(whole, task, remaining)
      continue
    }

    if (!settings.allowSplitting) {
      unscheduled.push({ taskId: task.id, remainingMin: remaining })
      continue
    }

    // Split across gaps, never leaving a piece (or a tail) shorter than minPiece.
    for (const g of gaps) {
      if (remaining <= 0) break
      if (!maybeBreak(g)) continue
      const room = g.end - g.cursor
      if (room < minPiece) continue
      let piece = Math.min(room, remaining)
      const tail = remaining - piece
      if (tail > 0 && tail < minPiece) piece = remaining - minPiece
      if (piece < minPiece) continue
      emitTask(g, task, piece)
      remaining -= piece
    }
    if (remaining > 0) unscheduled.push({ taskId: task.id, remainingMin: remaining })
  }

  out.sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end))
  return { blocks: out, unscheduled }
}
