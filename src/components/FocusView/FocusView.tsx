import { useEffect, useState } from 'react'
import { currentBlock, nextBlocks, taskById, useStore } from '../../store/useStore'
import { atTime, formatCountdown, formatMinutes, toMin } from '../../utils/time'
import { Button, PriorityDot } from '../ui'

export function FocusView() {
  const { blocks, tasks, fixedEvents, now, today, startBlock, doneBlock, pauseBlock, skipBlock, extendBlock, setView } =
    useStore()
  const [busy, setBusy] = useState(false)
  const block = currentBlock(blocks, tasks, now)
  const task = taskById(tasks, block?.taskId)
  const upcoming = nextBlocks(blocks, block, now)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  // Keyboard: space = start, enter = done
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!block || !task || busy) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === ' ' && task.status !== 'in_progress') {
        e.preventDefault()
        void run(() => startBlock(block.id))
      } else if (e.key === 'Enter' && task.status === 'in_progress') {
        e.preventDefault()
        void run(() => doneBlock(block.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [block, task, busy, startBlock, doneBlock])

  if (!block) {
    const hasOpen = tasks.some((t) => t.status === 'todo' || t.status === 'in_progress')
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <p className="text-2xl font-semibold">Nothing on deck</p>
        <p className="text-zinc-500">
          {hasOpen ? 'Your remaining tasks are not scheduled yet.' : 'The day is clear. Add tasks to plan it.'}
        </p>
        <Button variant="primary" onClick={() => setView('plan')}>
          Go to Plan
        </Button>
      </div>
    )
  }

  const startAt = atTime(today, block.start)
  const endAt = atTime(today, block.end)
  const secondsLeft = Math.round((endAt.getTime() - now.getTime()) / 1000)
  const notYet = now < startAt
  const overrun = secondsLeft < 0
  const inProgress = task?.status === 'in_progress'
  const label = block.kind === 'fixed' ? fixedEvents.find((f) => f.id === block.fixedEventId)?.title ?? 'Event' : task?.title
  const planned = toMin(block.end) - toMin(block.start)
  const pct = Math.max(0, Math.min(100, ((planned * 60 - secondsLeft) / (planned * 60)) * 100))

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div
        className={`rounded-2xl border p-8 text-center shadow-sm ${
          overrun && inProgress ? 'border-red-300 bg-red-50' : inProgress ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 bg-white'
        }`}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {inProgress ? 'In progress' : notYet ? `Up next · starts ${block.start}` : block.kind === 'fixed' ? 'Now' : 'Ready to start'}
        </div>
        <div className="flex items-center justify-center gap-2 text-3xl font-semibold">
          {task && <PriorityDot p={task.priority} />}
          <span>{label}</span>
        </div>
        <div className="mt-1 font-mono text-sm text-zinc-500">
          {block.start} – {block.end} · {formatMinutes(planned)}
          {block.locked && ' · 🔒'}
        </div>

        <div className={`mt-6 font-mono text-7xl tabular-nums tracking-tight ${overrun ? 'text-red-600' : ''}`}>
          {notYet ? formatCountdown(Math.round((startAt.getTime() - now.getTime()) / 1000)) : formatCountdown(secondsLeft)}
        </div>
        {notYet && <div className="mt-1 text-xs text-zinc-500">until start</div>}
        {overrun && inProgress && (
          <div className="mt-1 text-sm text-red-600">Over time — the rest of the day shifts when you decide below.</div>
        )}

        {!notYet && (
          <div className="mx-auto mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-zinc-200">
            <div className={`h-full ${overrun ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}

        {task && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {!inProgress && (
              <Button variant="primary" className="px-5 py-2 text-base" disabled={busy} onClick={() => run(() => startBlock(block.id))}>
                Start <kbd className="ml-2 rounded bg-white/20 px-1 text-xs">space</kbd>
              </Button>
            )}
            {inProgress && (
              <Button variant="primary" className="px-5 py-2 text-base" disabled={busy} onClick={() => run(() => doneBlock(block.id))}>
                Done <kbd className="ml-2 rounded bg-white/20 px-1 text-xs">↵</kbd>
              </Button>
            )}
            <Button disabled={busy} onClick={() => run(() => extendBlock(block.id, 15))}>
              +15 min
            </Button>
            {inProgress && (
              <Button disabled={busy} onClick={() => run(() => pauseBlock(block.id))} title="Stop for now; the rest gets rescheduled">
                Pause
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => run(() => skipBlock(block.id))} title="Drop this task for today">
              Skip today
            </Button>
          </div>
        )}
        {task?.notes && <p className="mt-6 whitespace-pre-wrap text-left text-sm text-zinc-600">{task.notes}</p>}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Next up</h3>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {upcoming.map((b) => {
              const t = taskById(tasks, b.taskId)
              const name = b.kind === 'fixed' ? fixedEvents.find((f) => f.id === b.fixedEventId)?.title ?? 'Event' : t?.title
              return (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-24 font-mono text-xs text-zinc-500">
                    {b.start}–{b.end}
                  </span>
                  {t && <PriorityDot p={t.priority} />}
                  <span className={`truncate ${b.kind === 'fixed' ? 'text-zinc-500' : ''}`}>{name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
