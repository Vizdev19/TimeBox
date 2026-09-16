import { DEFAULT_SETTINGS, type Block, type FixedEvent, type Settings, type Task } from '../../types'

export const DAY = '2026-09-15'

let n = 0
export const seqId = () => `id${++n}`
export const resetIds = () => {
  n = 0
}

export function task(over: Partial<Task> & { id: string; estimateMin: number }): Task {
  return {
    date: DAY,
    title: over.id,
    priority: 3,
    status: 'todo',
    createdAt: `2026-09-01T00:00:00.000Z`,
    ...over,
  }
}

export function fixed(id: string, start: string, end: string, date = DAY): FixedEvent {
  return { id, title: id, date, start, end, source: 'manual' }
}

export function block(over: Partial<Block> & { start: string; end: string }): Block {
  return { id: over.id ?? seqId(), date: DAY, kind: 'task', locked: false, ...over }
}

export const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  breakEveryMin: 0, // most tests opt into breaks explicitly
  ...over,
})

/** Compact [kind:ref start-end] view for readable assertions. */
export function fmt(blocks: Block[]): string[] {
  return blocks.map((b) => {
    const ref = b.kind === 'task' ? b.taskId : b.kind === 'fixed' ? b.fixedEventId : 'break'
    return `${ref} ${b.start}-${b.end}${b.locked ? ' L' : ''}`
  })
}
