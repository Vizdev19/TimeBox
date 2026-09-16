import { useState } from 'react'
import { dayLabel, useStore, type View } from '../store/useStore'
import { SettingsPanel } from './SettingsPanel'
import { Button, Input } from './ui'

const tabs: { id: View; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'focus', label: 'Focus' },
  { id: 'review', label: 'Review' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { view, setView, today, date, setDate, shiftDate, planDay, tasks } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const isPast = date < today
  const canPlan = !isPast && tasks.some((t) => t.date === date && (t.status === 'todo' || t.status === 'in_progress'))

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <span className="text-lg font-bold tracking-tight">TimeBox</span>
          <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${view === t.id ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {view === 'plan' && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="px-2" onClick={() => shiftDate(-1)} aria-label="Previous day" title="Previous day ([)">
                ‹
              </Button>
              <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="py-1" aria-label="Day" />
              <Button variant="ghost" className="px-2" onClick={() => shiftDate(1)} aria-label="Next day" title="Next day (])">
                ›
              </Button>
              {date !== today && (
                <Button variant="ghost" className="px-2" onClick={() => setDate(today)} title="Today (t)">
                  Today
                </Button>
              )}
              <span className="hidden text-sm text-zinc-500 md:inline">{dayLabel(date, today)}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {view === 'plan' && (
              <Button variant="primary" className="whitespace-nowrap" disabled={!canPlan} onClick={() => planDay()}>
                Plan<span className="hidden sm:inline"> {date === today ? 'my day' : 'this day'}</span>
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowSettings(true)} aria-label="Settings">
              ⚙
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">{children}</main>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
