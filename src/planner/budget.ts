import type { Block, Task } from '../types'
import { atTime, durationMin } from '../utils/time'

/**
 * How much time a task needs in total, before crediting any blocks.
 * A "Partially completed" checkpoint (remainingMin) overrides the estimate;
 * otherwise it's the estimate plus any "+N" extensions.
 */
export function budgetOf(task: Task): number {
  return task.remainingMin ?? task.estimateMin + (task.extraMin ?? 0)
}

/**
 * Minutes of `blocks` on `date` that count against the task's budget:
 * its task blocks that started at or after the checkpoint (all of them
 * when there is no checkpoint).
 */
export function coveredMin(task: Task, blocks: Block[], date: string): number {
  const asOf = task.remainingAsOf ? new Date(task.remainingAsOf).getTime() : -Infinity
  let total = 0
  for (const b of blocks) {
    if (b.kind !== 'task' || b.taskId !== task.id || b.date !== date) continue
    if (atTime(b.date, b.start).getTime() < asOf) continue
    total += Math.max(0, durationMin(b.start, b.end))
  }
  return total
}

/** Time still to schedule on `date`, given the blocks that will be kept. */
export function remainingFor(task: Task, keepBlocks: Block[], date: string): number {
  return budgetOf(task) - coveredMin(task, keepBlocks, date)
}

/**
 * Fold work already done (blocks on any date after the current checkpoint)
 * into a fresh checkpoint taken at `now`.
 */
export function checkpoint(task: Task, blocks: Block[], now: Date): Pick<Task, 'remainingMin' | 'remainingAsOf'> {
  const dates = new Set(blocks.filter((b) => b.taskId === task.id).map((b) => b.date))
  let covered = 0
  for (const d of dates) covered += coveredMin(task, blocks, d)
  return {
    remainingMin: Math.max(0, budgetOf(task) - covered),
    remainingAsOf: now.toISOString(),
  }
}

/** Blocks for this task that started after its checkpoint (i.e. not yet folded in). */
export function unfoldedBlocks(task: Task, blocks: Block[]): Block[] {
  const asOf = task.remainingAsOf ? new Date(task.remainingAsOf).getTime() : -Infinity
  return blocks.filter((b) => b.kind === 'task' && b.taskId === task.id && atTime(b.date, b.start).getTime() >= asOf)
}
