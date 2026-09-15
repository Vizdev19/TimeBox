# TimeBox

A personal, local-first day planner. Give it your tasks (estimate, priority, optional due date) and the meetings you can't move; it packs the day into time blocks, keeps you on the current one with a live countdown, and reshuffles the rest of the day when things run long, get skipped, or finish early. Everything stays in your browser (IndexedDB) — no accounts, no server.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # planner unit tests
npm run build      # static site in dist/
```

## How it works

**Plan** — add tasks and today's fixed events, hit *Plan my day*. The planner (`src/planner/plan.ts`, pure and unit-tested) ranks tasks (in progress → overdue/due today → priority → due date → shortest), then first-fits them into the free gaps between fixed events. A task that fits nowhere whole is split across gaps (never into pieces shorter than *Smallest block*), and a break is inserted after every *Break every* minutes of continuous work. Drag a block on the timeline to move it, drag its bottom edge to resize; that locks it (🔒) so later replans schedule around it. *Unlock all* releases them.

**Focus** — the current block, a countdown, and the next three things. `Space` starts, `Enter` marks done. *+15 min* extends the block (clipped at the next fixed event; the overflow is scheduled as a continuation after it). *Pause* stops for now and reschedules the remainder. *Skip today* drops the task until tomorrow, when it's re-queued automatically. Every action re-plans the rest of the day from the current minute.

**Review** — per day, planned vs. actual for each session, and a rolling estimate-accuracy factor (actual ÷ planned over the last 14 days) once there are three or more finished sessions.

Shortcuts: `1` / `2` / `3` switch views, `n` jumps to the new-task field.

## Layout

```
src/
  types.ts          Task, FixedEvent, Block, SessionLog, Settings
  planner/          rank.ts, plan.ts (planDay), replan.ts (replanFromNow) + tests
  store/useStore.ts Zustand store: state, all actions, persistence via Dexie
  db/               Dexie schema + repo helpers
  components/       TaskList, Timeline, FocusView, Review, SettingsPanel, Layout
  utils/time.ts     HH:mm ↔ minutes, range subtraction, formatting
```

## Not yet (v2 ideas)

Calendar import (the `FixedEvent.source: 'ics'` field is reserved for it), deep-work vs. shallow tagging, auto-applying the accuracy factor to new estimates, recurring tasks, notifications, PWA install, JSON export/backup.
