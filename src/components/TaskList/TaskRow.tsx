import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Priority, Task } from '../../types'
import { formatMinutes } from '../../utils/time'
import { Button, Input, PriorityDot, Select } from '../ui'
import { StatusDialog, type StatusDialogMode } from './StatusDialog'

type StatusChoice = 'todo' | 'done' | 'partial' | 'move'

const statusLabel: Record<Task['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Completed',
  deferred: 'Moved',
}

export function TaskRow({ task, unscheduledMin }: { task: Task; unscheduledMin?: number }) {
  const { updateTask, deleteTask, completeTask, bringBack, today } = useStore()
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState<StatusDialogMode | null>(null)
  const [title, setTitle] = useState(task.title)
  const [estimate, setEstimate] = useState(String(task.estimateMin))
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [due, setDue] = useState(task.dueDate ?? '')

  const overdue = task.dueDate && task.dueDate < today && task.status !== 'done'
  const dueToday = task.dueDate === today && task.status !== 'done'
  const inactive = task.status === 'done' || task.status === 'deferred'
  const partial = task.remainingMin !== undefined && task.status !== 'done'

  const save = async () => {
    const est = Number(estimate)
    if (!title.trim() || !Number.isFinite(est) || est <= 0) return
    await updateTask(task.id, { title: title.trim(), estimateMin: Math.round(est), priority, dueDate: due || undefined })
    setEditing(false)
  }

  const onStatus = async (choice: StatusChoice) => {
    if (choice === 'done') await completeTask(task.id)
    else if (choice === 'todo') await bringBack(task.id)
    else setDialog(choice)
  }

  // The select shows the current status; the "…" choices open a dialog.
  const selectValue: StatusChoice | 'in_progress' | 'deferred' =
    task.status === 'done' ? 'done' : task.status === 'deferred' ? 'deferred' : task.status === 'in_progress' ? 'in_progress' : 'todo'

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-white p-2">
        <Input className="min-w-[10rem] flex-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input className="w-20" type="number" min={5} step="any" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
        <Select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)}>
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
          <option value={4}>P4</option>
        </Select>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </li>
    )
  }

  return (
    <li className={`group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-100 ${inactive ? 'opacity-70' : ''}`}>
      <PriorityDot p={task.priority} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className={`truncate ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</span>
          {task.status === 'in_progress' && (
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">now</span>
          )}
          {partial && (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">partial</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-zinc-500">
          <span>
            {partial ? (
              <>
                <b className="font-medium text-zinc-700">{formatMinutes(task.remainingMin!)} left</b> of {formatMinutes(task.estimateMin)}
              </>
            ) : (
              formatMinutes(task.estimateMin)
            )}
            {!partial && task.extraMin ? <span className="text-amber-700"> +{formatMinutes(task.extraMin)}</span> : null}
          </span>
          {task.dueDate && (
            <span className={overdue ? 'font-medium text-red-600' : dueToday ? 'font-medium text-orange-600' : ''}>
              due {task.dueDate}
            </span>
          )}
          {task.status === 'deferred' && task.scheduledFor && <span className="font-medium text-zinc-700">→ {task.scheduledFor}</span>}
          {unscheduledMin !== undefined && (
            <span className="font-medium text-amber-700" title="Won't fit in today's remaining time">
              {unscheduledMin >= (task.remainingMin ?? task.estimateMin) ? "won't fit today" : `${formatMinutes(unscheduledMin)} won't fit`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Select
          className="py-1 text-xs"
          value={selectValue}
          aria-label={`Status of ${task.title}`}
          onChange={(e) => {
            const v = e.target.value as StatusChoice
            void onStatus(v)
            e.target.value = selectValue // dialog choices don't change status until saved
          }}
        >
          {task.status === 'in_progress' && (
            <option value="in_progress" disabled>
              {statusLabel.in_progress}
            </option>
          )}
          {task.status === 'deferred' && (
            <option value="deferred" disabled>
              {statusLabel.deferred} → {task.scheduledFor}
            </option>
          )}
          <option value="todo">{task.status === 'done' || task.status === 'deferred' ? 'Back to To do' : 'To do'}</option>
          <option value="done">Completed</option>
          <option value="partial">Partially completed…</option>
          <option value="move">{task.status === 'deferred' ? 'Change date…' : 'Moved to another date…'}</option>
        </Select>
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
          {!inactive && (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>
            ✕
          </Button>
        </div>
      </div>
      {dialog && <StatusDialog task={task} mode={dialog} onClose={() => setDialog(null)} />}
    </li>
  )
}
