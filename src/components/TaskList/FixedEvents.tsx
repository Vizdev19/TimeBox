import { useState, type FormEvent } from 'react'
import { useStore } from '../../store/useStore'
import { toMin } from '../../utils/time'
import { Button, Input } from '../ui'

export function FixedEvents() {
  const { fixedEvents, addFixedEvent, deleteFixedEvent, date, today } = useStore()
  const readOnly = date < today
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('13:00')
  const sorted = [...fixedEvents].sort((a, b) => toMin(a.start) - toMin(b.start))

  const [error, setError] = useState<string | null>(null)

  const validate = (): string | null => {
    if (!title.trim()) return 'Give the event a name.'
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 'Pick both a start and an end time.'
    if (toMin(end) <= toMin(start)) return 'End time must be after the start time.'
    return null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validate()
    setError(problem)
    if (problem) return
    await addFixedEvent({ title: title.trim(), start, end })
    setTitle('')
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fixed events {date === today ? 'today' : 'this day'}</h3>
      {sorted.length > 0 && (
        <ul className="space-y-1">
          {sorted.map((ev) => (
            <li key={ev.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100">
              <span className="w-24 shrink-0 font-mono text-xs text-zinc-500">
                {ev.start}–{ev.end}
              </span>
              <span className="flex-1 truncate">{ev.title}</span>
              {!readOnly && (
              <button
                className="text-xs text-red-600 opacity-0 group-hover:opacity-100 max-sm:opacity-100"
                onClick={() => deleteFixedEvent(ev.id)}
                aria-label={`Delete ${ev.title}`}
              >
                ✕
              </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[8rem] flex-1"
          placeholder="Meeting, lunch…"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError(null)
          }}
        />
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" />
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time" />
        <Button type="submit">Add</Button>
      </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  )
}
