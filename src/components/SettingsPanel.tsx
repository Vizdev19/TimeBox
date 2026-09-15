import { useStore } from '../store/useStore'
import { Button, Input } from './ui'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useStore()
  const num = (v: string) => Math.max(0, Number(v) || 0)

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Work starts
            <Input type="time" value={settings.workStart} onChange={(e) => updateSettings({ workStart: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Work ends
            <Input type="time" value={settings.workEnd} onChange={(e) => updateSettings({ workEnd: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Break every (min)
            <Input type="number" min={0} step={5} value={settings.breakEveryMin} onChange={(e) => updateSettings({ breakEveryMin: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Break length (min)
            <Input type="number" min={0} step={5} value={settings.breakLengthMin} onChange={(e) => updateSettings({ breakLengthMin: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Smallest block (min)
            <Input type="number" min={5} step={5} value={settings.minBlockMin} onChange={(e) => updateSettings({ minBlockMin: Math.max(5, num(e.target.value)) })} />
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={settings.allowSplitting} onChange={(e) => updateSettings({ allowSplitting: e.target.checked })} />
            Split tasks across gaps
          </label>
        </div>
        <p className="text-xs text-zinc-500">Changes apply the next time you plan or the schedule shifts.</p>
      </div>
    </div>
  )
}
