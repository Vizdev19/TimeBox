import { useState } from 'react'
import { budgetOf } from '../../planner/budget'
import { useStore } from '../../store/useStore'
import type { Task } from '../../types'
import { formatMinutes } from '../../utils/time'
import { Button, PriorityDot } from '../ui'
import { StatusDialog } from './StatusDialog'

/** Unfinished tasks from earlier days: decide per task what happens to it. */
export function Leftovers() {
  const { leftovers, today, moveTask, deleteTask } = useStore()
  const [moving, setMoving] = useState<Task | null>(null)
  if (leftovers.length === 0) return null

  return (
    <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Unfinished from earlier days</h3>
        <span className="text-xs text-amber-800">{leftovers.length}</span>
      </div>
      <ul className="divide-y divide-amber-200">
        {leftovers.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <PriorityDot p={t.priority} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{t.title}</div>
              <div className="text-xs text-zinc-600">
                {formatMinutes(budgetOf(t))}
                {t.remainingMin !== undefined && ` left of ${formatMinutes(t.estimateMin)}`} · from {t.date}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => moveTask(t.id, today)}>
                Today
              </Button>
              <Button className="px-2 py-1 text-xs" onClick={() => setMoving(t)}>
                Move…
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => deleteTask(t.id)} aria-label={`Delete ${t.title}`}>
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {moving && <StatusDialog task={moving} mode="move" onClose={() => setMoving(null)} />}
    </section>
  )
}
