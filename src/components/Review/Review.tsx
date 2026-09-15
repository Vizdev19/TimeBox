import { useMemo, useState } from 'react'
import { taskById, useStore } from '../../store/useStore'
import type { SessionLog } from '../../types'
import { formatMinutes, toMin } from '../../utils/time'
import { PriorityDot } from '../ui'

function actualMin(l: SessionLog): number | undefined {
  if (!l.actualStart || !l.actualEnd) return undefined
  return Math.max(0, Math.round((new Date(l.actualEnd).getTime() - new Date(l.actualStart).getTime()) / 60000))
}

function plannedMin(l: SessionLog): number {
  return toMin(l.plannedEnd) - toMin(l.plannedStart)
}

const outcomeStyle: Record<SessionLog['outcome'], string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  overran: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  skipped: 'bg-zinc-200 text-zinc-600',
  moved: 'bg-zinc-200 text-zinc-600',
}

export function Review() {
  const { logs, tasks, today } = useStore()
  const days = useMemo(() => [...new Set(logs.map((l) => l.date))].sort().reverse(), [logs])
  const [selected, setSelected] = useState<string | null>(null)
  const day = selected ?? days[0] ?? today

  const dayLogs = logs
    .filter((l) => l.date === day)
    .sort((a, b) => toMin(a.plannedStart) - toMin(b.plannedStart))

  const totals = dayLogs.reduce(
    (acc, l) => {
      const a = actualMin(l)
      acc.planned += plannedMin(l)
      if (a !== undefined) acc.actual += a
      if (l.outcome === 'completed' || l.outcome === 'overran') acc.done++
      if (l.outcome === 'skipped' || l.outcome === 'moved') acc.moved++
      return acc
    },
    { planned: 0, actual: 0, done: 0, moved: 0 },
  )

  // Estimate accuracy over the last 14 days of finished work.
  const accuracy = useMemo(() => {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - 14)
    const c = cutoff.toISOString().slice(0, 10)
    let p = 0
    let a = 0
    let n = 0
    for (const l of logs) {
      if (l.date < c) continue
      if (l.outcome !== 'completed' && l.outcome !== 'overran') continue
      const am = actualMin(l)
      if (am === undefined) continue
      p += plannedMin(l)
      a += am
      n++
    }
    return n >= 3 && p > 0 ? { factor: a / p, n } : null
  }, [logs, today])

  if (logs.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center text-zinc-500">
        <p className="text-2xl font-semibold text-zinc-900">No history yet</p>
        <p className="mt-2">Start and finish tasks from the Focus view and they'll show up here.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {accuracy && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimate accuracy · last 14 days</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums">{accuracy.factor.toFixed(2)}×</span>
            <span className="text-sm text-zinc-500">
              actual ÷ planned over {accuracy.n} sessions.{' '}
              {accuracy.factor > 1.15
                ? `You tend to run long — try padding estimates by ~${Math.round((accuracy.factor - 1) * 100)}%.`
                : accuracy.factor < 0.85
                  ? 'You finish early — estimates could be tighter.'
                  : 'Your estimates are well calibrated.'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelected(d)}
            className={`rounded-full px-3 py-1 text-sm ${d === day ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-300 hover:bg-zinc-100'}`}
          >
            {d === today ? 'Today' : d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Planned" value={formatMinutes(totals.planned)} />
        <Stat label="Actual" value={formatMinutes(totals.actual)} />
        <Stat label="Finished" value={String(totals.done)} />
        <Stat label="Moved" value={String(totals.moved)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Planned</th>
              <th className="px-3 py-2">Actual</th>
              <th className="px-3 py-2">Δ</th>
              <th className="px-3 py-2">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {dayLogs.map((l) => {
              const t = taskById(tasks, l.taskId)
              const p = plannedMin(l)
              const a = actualMin(l)
              const delta = a !== undefined ? a - p : undefined
              const max = Math.max(p, a ?? 0, 1)
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {t && <PriorityDot p={t.priority} />}
                      <span className="truncate">{t?.title ?? '(deleted)'}</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <div className="h-1 rounded bg-zinc-300" style={{ width: `${(p / max) * 100}%` }} />
                      {a !== undefined && (
                        <div
                          className={`h-1 rounded ${delta! > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                          style={{ width: `${(a / max) * 100}%` }}
                        />
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">
                    {l.plannedStart}–{l.plannedEnd}
                    <div className="text-zinc-400">{formatMinutes(p)}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">
                    {a !== undefined ? formatMinutes(a) : '—'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${delta === undefined ? 'text-zinc-400' : delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {delta === undefined ? '—' : delta > 0 ? `+${formatMinutes(delta)}` : delta < 0 ? formatMinutes(delta) : '0m'}
                  </td>
                  <td className="px-3 py-2">
                    {l.actualStart && !l.actualEnd ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">in progress</span>
                    ) : (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${outcomeStyle[l.outcome]}`}>{l.outcome}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
