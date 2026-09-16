import { useStore } from '../../store/useStore'
import { rankTasks } from '../../planner/rank'
import { budgetOf } from '../../planner/budget'
import { TaskForm } from './TaskForm'
import { TaskRow } from './TaskRow'
import { FixedEvents } from './FixedEvents'
import { Leftovers } from './Leftovers'
import { formatMinutes } from '../../utils/time'

export function TaskList() {
  const { tasks, unscheduled, date, today } = useStore()
  const isPast = date < today
  const own = tasks.filter((t) => t.date === date)
  const open = rankTasks(own, date)
  const done = own.filter((t) => t.status === 'done')
  const unsched = new Map(unscheduled.map((u) => [u.taskId, u.remainingMin]))
  const totalOpen = open.reduce((n, t) => n + budgetOf(t), 0)

  return (
    <div className="space-y-5">
      {date === today && <Leftovers />}

      {isPast ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">This day is history — view only.</p>
      ) : (
        <TaskForm autoFocus={tasks.length === 0} />
      )}

      <section className="space-y-1">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{isPast ? 'Not finished' : 'To do'}</h3>
          {open.length > 0 && (
            <span className="text-xs text-zinc-500">
              {open.length} · {formatMinutes(totalOpen)}
            </span>
          )}
        </div>
        {open.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            {isPast ? 'Nothing left open on this day.' : (
              <>
                Add a few tasks with an estimate, then hit <b>Plan {date === today ? 'my day' : 'this day'}</b>.
              </>
            )}
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

      {done.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Done</h3>
          <ul className="space-y-0.5">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
