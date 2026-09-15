import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { TaskList } from './components/TaskList/TaskList'
import { Timeline } from './components/Timeline/Timeline'
import { FocusView } from './components/FocusView/FocusView'
import { Review } from './components/Review/Review'
import { useStore } from './store/useStore'

export default function App() {
  const { loaded, load, tick, view, setView } = useStore()

  useEffect(() => {
    void load()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [load, tick])

  // Global shortcuts: 1/2/3 switch views, n focuses the new-task field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey) return
      if (e.key === '1') setView('plan')
      else if (e.key === '2') setView('focus')
      else if (e.key === '3') setView('review')
      else if (e.key === 'n') {
        setView('plan')
        requestAnimationFrame(() => document.getElementById('new-task-title')?.focus())
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView])

  if (!loaded) return <div className="p-8 text-sm text-zinc-500">Loading…</div>

  return (
    <Layout>
      {view === 'plan' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TaskList />
          <Timeline />
        </div>
      )}
      {view === 'focus' && <FocusView />}
      {view === 'review' && <Review />}
    </Layout>
  )
}
