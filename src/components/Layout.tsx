import { useState } from 'react'
import { useStore, type View } from '../store/useStore'
import { SettingsPanel } from './SettingsPanel'
import { Button } from './ui'

const tabs: { id: View; label: string; key: string }[] = [
  { id: 'plan', label: 'Plan', key: '1' },
  { id: 'focus', label: 'Focus', key: '2' },
  { id: 'review', label: 'Review', key: '3' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { view, setView, today, planToday, tasks } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const canPlan = tasks.some((t) => t.status === 'todo' || t.status === 'in_progress')

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">TimeBox</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">{today}</span>
          </div>
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
          <div className="ml-auto flex items-center gap-2">
            {view === 'plan' && (
              <Button variant="primary" className="whitespace-nowrap" disabled={!canPlan} onClick={() => planToday()}>
                Plan<span className="hidden sm:inline"> my day</span>
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
