import { useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { remainingFor } from '../../planner/budget'
import { useStore } from '../../store/useStore'
import type { Task } from '../../types'
import { dateToMin, formatMinutes, toHHMM, toMin } from '../../utils/time'
import { Button, Input } from '../ui'

export type StatusDialogMode = 'partial' | 'move'

/**
 * Collects the details for "Partially completed" (minutes left + when to
 * continue) or "Moved to another date" (the date). Shared by the task list
 * and the Focus view.
 */
export function StatusDialog({ task, mode, onClose }: { task: Task; mode: StatusDialogMode; onClose: () => void }) {
  const { today, date, blocks, now, markPartial, moveTask } = useStore()
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd')
  // Moving to today makes sense unless the task already lives on today.
  const canPickToday = mode === 'partial' || task.date !== today
  // Only work done so far counts toward the prefill: blocks that have started,
  // with a running one credited only up to now.
  const nowMin = dateToMin(now)
  const started = blocks
    .filter((b) => toMin(b.start) <= nowMin)
    .map((b) => (toMin(b.end) > nowMin ? { ...b, end: toHHMM(nowMin) } : b))
  const prefill = Math.max(0, remainingFor(task, started, date))
  const [minutes, setMinutes] = useState(String(prefill))
  const [when, setWhen] = useState<string>(canPickToday && date === today ? today : date > today ? date : tomorrow)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const mins = Number(minutes)
    if (mode === 'partial' && (!Number.isFinite(mins) || mins <= 0)) return setError('Enter how many minutes are left.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) return setError('Pick a date.')
    if (when < today) return setError('That date is in the past.')
    if (mode === 'move' && when === task.date) return setError('The task is already on that day.')
    setBusy(true)
    try {
      if (mode === 'partial') await markPartial(task.id, Math.round(mins), when)
      else await moveTask(task.id, when)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={onClose}>
      <form
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">{mode === 'partial' ? 'Partially completed' : 'Move to another date'}</h2>
          <p className="truncate text-sm text-zinc-500">{task.title}</p>
        </div>

        {mode === 'partial' && (
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Minutes left <span className="text-zinc-400">(of {formatMinutes(task.estimateMin)} estimated)</span>
            </span>
            <Input
              type="number"
              min={1}
              step="any"
              autoFocus
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value)
                setError(null)
              }}
            />
          </label>
        )}

        <div className="space-y-2 text-sm">
          <span>{mode === 'partial' ? 'Continue on' : 'Move to'}</span>
          <div className="flex flex-wrap items-center gap-2">
            {canPickToday && <Chip value={today} label="Today" selected={when} onPick={setWhen} />}
            <Chip value={tomorrow} label="Tomorrow" selected={when} onPick={setWhen} />
            <Input
              type="date"
              min={today}
              value={when}
              onChange={(e) => {
                setWhen(e.target.value)
                setError(null)
              }}
              aria-label="Date"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}

function Chip({ value, label, selected, onPick }: { value: string; label: string; selected: string; onPick: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`rounded-full px-3 py-1 text-sm ${selected === value ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white hover:bg-zinc-100'}`}
    >
      {label}
    </button>
  )
}
