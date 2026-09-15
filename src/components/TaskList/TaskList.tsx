import { useStore } from '../../store/useStore'
import { rankTasks } from '../../planner/rank'
import { budgetOf } from '../../planner/budget'
import { TaskForm } from './TaskForm'
import { TaskRow } from './TaskRow'
import { FixedEvents } from './FixedEvents'
import { formatMinutes } from '../../utils/time'

export function TaskList() {
  const { tasks, unscheduled, today } = useStore()
  const open = rankTasks(tasks, today)
  const done = tasks.filter((t) => t.status === 'done')
  const later = tasks.filter((t) => t.status === 'deferred').sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
  const unsched = new Map(unscheduled.map((u) => [u.taskId, u.remainingMin]))
  const totalOpen = open.reduce((n, t) => n + budgetOf(t), 0)

  return (
    <div className="space-y-5">
      <TaskForm autoFocus={tasks.length === 0} />

      <section className="space-y-1">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">To do</h3>
          {open.length > 0 && (
            <span className="text-xs text-zinc-500">
              {open.length} · {formatMinutes(totalOpen)}
            </span>
          )}
        </div>
        {open.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            Add a few tasks with an estimate, then hit <b>Plan my day</b>.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} unscheduledMin={unsched.get(t.id)} />
            ))}
          </ul>
        )}
      </section>

      <FixedEvents />

      {later.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Later</h3>
          <ul className="space-y-0.5">
            {later.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Done</h3>
          <ul className="space-y-0.5">
            {done.slice(-10).map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
