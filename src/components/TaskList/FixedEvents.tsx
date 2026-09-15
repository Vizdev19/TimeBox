import { useState, type FormEvent } from 'react'
import { useStore } from '../../store/useStore'
import { toMin } from '../../utils/time'
import { Button, Input } from '../ui'

export function FixedEvents() {
  const { fixedEvents, addFixedEvent, deleteFixedEvent, today } = useStore()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('13:00')
  const sorted = [...fixedEvents].sort((a, b) => toMin(a.start) - toMin(b.start))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || toMin(end) <= toMin(start)) return
    await addFixedEvent({ title: title.trim(), date: today, start, end })
    setTitle('')
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fixed events today</h3>
      {sorted.length > 0 && (
        <ul className="space-y-1">
          {sorted.map((ev) => (
            <li key={ev.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100">
              <span className="w-24 shrink-0 font-mono text-xs text-zinc-500">
                {ev.start}–{ev.end}
              </span>
              <span className="flex-1 truncate">{ev.title}</span>
              <button
                className="text-xs text-red-600 opacity-0 group-hover:opacity-100 max-sm:opacity-100"
                onClick={() => deleteFixedEvent(ev.id)}
                aria-label={`Delete ${ev.title}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <Input className="min-w-[8rem] flex-1" placeholder="Meeting, lunch…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button type="submit">Add</Button>
      </form>
    </section>
  )
}
