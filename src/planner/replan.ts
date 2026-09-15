import type { Block, FixedEvent, Settings, Task } from '../types'
import { toMin } from '../utils/time'
import { planDay, type PlanResult } from './plan'

export interface ReplanInput {
  date: string
  nowMin: number
  tasks: Task[]
  fixedEvents: FixedEvent[]
  settings: Settings
  existingBlocks: Block[]
  idGen?: () => string
}

/**
 * Re-plan the rest of the day from `nowMin`, used both for the initial
 * "Plan my day" (no existing blocks) and for every mid-day adjustment
 * (overrun, skip, finished early, drag).
 *
 * What survives from the existing schedule:
 *  - blocks that have already ended
 *  - the block in progress right now (its task is in_progress)
 *  - user-locked blocks that haven't ended yet
 * Everything else after `now` is thrown away and re-packed.
 */
export function replanFromNow(input: ReplanInput): PlanResult {
  const { nowMin, tasks, existingBlocks } = input
  const inProgress = new Set(tasks.filter((t) => t.status === 'in_progress').map((t) => t.id))

  const keepBlocks = existingBlocks.filter((b) => {
    const start = toMin(b.start)
    const end = toMin(b.end)
    if (end <= start) return false // closed in the same minute it started
    if (end <= nowMin) return true
    if (b.kind === 'fixed') return false // planDay re-emits it
    if (b.locked) return true
    return b.kind === 'task' && b.taskId !== undefined && start <= nowMin && inProgress.has(b.taskId)
  })

  return planDay({
    date: input.date,
    tasks,
    fixedEvents: input.fixedEvents,
    settings: input.settings,
    keepBlocks,
    fromMin: nowMin,
    idGen: input.idGen,
  })
}
