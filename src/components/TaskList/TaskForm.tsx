import { useState, type FormEvent } from 'react'
import { useStore } from '../../store/useStore'
import type { Priority } from '../../types'
import { Button, Input, Select } from '../ui'

export function TaskForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const addTask = useStore((s) => s.addTask)
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('30')
  const [priority, setPriority] = useState<Priority>(3)
  const [due, setDue] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    const est = Number(estimate)
    if (!t || !Number.isFinite(est) || est <= 0) return
    await addTask({ title: t, estimateMin: Math.round(est), priority, dueDate: due || undefined })
    setTitle('')
    setEstimate('30')
    setPriority(3)
    setDue('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
        <span className="text-xs text-zinc-500">Task</span>
        <Input
          autoFocus={autoFocus}
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          id="new-task-title"
        />
      </label>
      <label className="flex w-20 flex-col gap-1">
        <span className="text-xs text-zinc-500">Min</span>
        <Input type="number" min={5} step={5} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Priority</span>
        <Select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)}>
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
          <option value={4}>P4</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Due</span>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <Button type="submit" variant="primary">
        Add
      </Button>
    </form>
  )
}
