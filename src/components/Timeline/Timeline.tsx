import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { currentBlock, taskById, useStore } from '../../store/useStore'
import type { Block } from '../../types'
import { dateToMin, toHHMM, toMin } from '../../utils/time'
import { priorityColor } from '../priority'

const PX_PER_MIN = 1.6
const SNAP = 5

interface Drag {
  id: string
  mode: 'move' | 'resize'
  originY: number
  origStart: number
  origEnd: number
  start: number
  end: number
  moved: boolean
}

export function Timeline() {
  const { blocks, tasks, fixedEvents, settings, now, moveBlock, unlockAll } = useStore()
  const [drag, setDrag] = useState<Drag | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const nowMin = dateToMin(now)
  const active = currentBlock(blocks, tasks, now)

  const { rangeStart, rangeEnd } = useMemo(() => {
    let s = toMin(settings.workStart)
    let e = toMin(settings.workEnd)
    for (const b of blocks) {
      s = Math.min(s, toMin(b.start))
      e = Math.max(e, toMin(b.end))
    }
    if (nowMin >= s - 60 && nowMin <= e + 60) {
      s = Math.min(s, nowMin)
      e = Math.max(e, nowMin)
    }
    return { rangeStart: Math.floor(s / 60) * 60, rangeEnd: Math.ceil(e / 60) * 60 }
  }, [blocks, settings, nowMin])

  const height = (rangeEnd - rangeStart) * PX_PER_MIN
  const y = (min: number) => (min - rangeStart) * PX_PER_MIN
  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = rangeStart; h <= rangeEnd; h += 60) out.push(h)
    return out
  }, [rangeStart, rangeEnd])

  const onPointerDown = (e: PointerEvent, b: Block, mode: Drag['mode']) => {
    if (b.kind !== 'task') return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({
      id: b.id,
      mode,
      originY: e.clientY,
      origStart: toMin(b.start),
      origEnd: toMin(b.end),
      start: toMin(b.start),
      end: toMin(b.end),
      moved: false,
    })
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return
    const dyMin = Math.round((e.clientY - drag.originY) / PX_PER_MIN / SNAP) * SNAP
    if (dyMin === 0 && !drag.moved) return
    const dur = drag.origEnd - drag.origStart
    if (drag.mode === 'move') {
      const start = Math.max(rangeStart, Math.min(rangeEnd - dur, drag.origStart + dyMin))
      setDrag({ ...drag, start, end: start + dur, moved: true })
    } else {
      const end = Math.max(drag.origStart + SNAP, Math.min(rangeEnd, drag.origEnd + dyMin))
      setDrag({ ...drag, end, moved: true })
    }
  }

  const onPointerUp = () => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.moved && (d.start !== d.origStart || d.end !== d.origEnd)) void moveBlock(d.id, d.start, d.end)
  }

  const anyLocked = blocks.some((b) => b.locked)
  const showNow = nowMin >= rangeStart && nowMin <= rangeEnd

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Timeline</h3>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="hidden sm:inline">Drag to move · drag bottom edge to resize</span>
          {anyLocked && (
            <button className="underline hover:text-zinc-800" onClick={() => unlockAll()}>
              Unlock all
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-lg border border-zinc-200 bg-white"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-zinc-100" style={{ top: y(h) }}>
            <span className="absolute -top-2 left-1 bg-white px-0.5 font-mono text-[10px] text-zinc-400">{toHHMM(h)}</span>
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Nothing planned yet
          </div>
        )}

        {blocks.map((b) => {
          const isDragging = drag?.id === b.id
          const start = isDragging ? drag.start : toMin(b.start)
          const end = isDragging ? drag.end : toMin(b.end)
          const task = taskById(tasks, b.taskId)
          const fixed = b.fixedEventId ? fixedEvents.find((f) => f.id === b.fixedEventId) : undefined
          const past = end <= nowMin
          const isActive = active?.id === b.id
          const inProgress = task?.status === 'in_progress'
          const label =
            b.kind === 'task' ? task?.title ?? '(deleted task)' : b.kind === 'fixed' ? fixed?.title ?? 'Event' : 'Break'
          const short = end - start < 25

          let cls = 'absolute left-12 right-2 rounded-md border text-xs overflow-hidden '
          if (b.kind === 'task') {
            cls += `cursor-grab bg-white ${isActive ? 'border-zinc-800 shadow-md' : 'border-zinc-300 shadow-sm'} ${inProgress ? 'ring-2 ring-emerald-400' : ''}`
          } else if (b.kind === 'fixed') {
            cls += 'border-zinc-300 bg-zinc-100 text-zinc-600 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgba(0,0,0,0.04)_6px_12px)]'
          } else {
            cls += 'border-dashed border-emerald-300 bg-emerald-50 text-emerald-700'
          }
          if (past && !inProgress) cls += ' opacity-50'
          if (isDragging) cls += ' z-20 cursor-grabbing shadow-lg'

          return (
            <div
              key={b.id}
              className={cls}
              style={{ top: y(start), height: Math.max(4, (end - start) * PX_PER_MIN) - 2 }}
              onPointerDown={(e) => onPointerDown(e, b, 'move')}
              title={`${label} ${toHHMM(start)}–${toHHMM(end)}`}
            >
              {b.kind === 'task' && task && <span className={`absolute left-0 top-0 h-full w-1 ${priorityColor[task.priority]}`} />}
              <div className={`flex ${short ? 'items-center' : 'flex-col'} gap-x-2 px-2 ${short ? 'py-0' : 'py-1'} pl-3`}>
                <span className="truncate font-medium">
                  {label}
                  {b.locked && <span className="ml-1 text-zinc-400" title="Locked — planner won't move it">🔒</span>}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {toHHMM(start)}–{toHHMM(end)}
                </span>
              </div>
              {b.kind === 'task' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
                  onPointerDown={(e) => onPointerDown(e, b, 'resize')}
                />
              )}
            </div>
          )
        })}

        {showNow && (
          <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: y(nowMin) }}>
            <span className="absolute -top-2 right-1 rounded bg-red-500 px-1 font-mono text-[10px] text-white">{toHHMM(nowMin)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
