import { format } from 'date-fns'

/** "HH:mm" -> minutes since midnight */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** minutes since midnight -> "HH:mm" */
export function toHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function todayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

export function nowHHMM(now: Date = new Date()): string {
  return format(now, 'HH:mm')
}

/** Minutes since midnight for a Date (seconds dropped). */
export function dateToMin(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function durationMin(start: string, end: string): number {
  return toMin(end) - toMin(start)
}

export interface Range {
  start: number
  end: number
}

export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end
}

/** Subtract `busy` ranges from `free`, returning sorted, non-overlapping gaps. */
export function subtractRanges(free: Range[], busy: Range[]): Range[] {
  let gaps = free.map((r) => ({ ...r }))
  const sortedBusy = [...busy].sort((a, b) => a.start - b.start)
  for (const b of sortedBusy) {
    const next: Range[] = []
    for (const g of gaps) {
      if (!overlaps(g, b)) {
        next.push(g)
        continue
      }
      if (g.start < b.start) next.push({ start: g.start, end: b.start })
      if (b.end < g.end) next.push({ start: b.end, end: g.end })
    }
    gaps = next
  }
  return gaps.filter((g) => g.end > g.start).sort((a, b) => a.start - b.start)
}

export function formatMinutes(min: number): string {
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = min < 0 ? '-' : ''
  if (h === 0) return `${sign}${m}m`
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h ${m}m`
}

export function formatCountdown(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : ''
  const abs = Math.abs(Math.floor(totalSec))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`
}

/** Combine a YYYY-MM-DD date and HH:mm into a local Date. */
export function atTime(date: string, hhmm: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi, 0, 0)
}
