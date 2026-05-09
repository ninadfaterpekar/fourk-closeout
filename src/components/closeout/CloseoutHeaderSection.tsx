import type { CloseoutHeaderData, ShiftType } from '../../types/closeout'
import { formatDisplayDate, getDayOfWeek } from '../../utils/date'
import { Card } from '../ui/Card'

const MANAGER_OPTIONS = ['Sarah', 'Jocelyn', 'Ninad', 'Sandeep'] as const

type CloseoutHeaderSectionProps = {
  value: CloseoutHeaderData
  onChange: (value: CloseoutHeaderData) => void
}

export const CloseoutHeaderSection = ({ value, onChange }: CloseoutHeaderSectionProps) => {
  const updateHeader = <K extends keyof CloseoutHeaderData>(key: K, nextValue: CloseoutHeaderData[K]) => {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <Card title="Header" subtitle="Shift metadata for this closeout.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Date</span>
          <input
            type="date"
            value={value.businessDate}
            onChange={(event) => updateHeader('businessDate', event.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <p className="text-[10px] text-slate-500">{formatDisplayDate(value.businessDate)}</p>
        </label>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Day of Week</span>
          <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm leading-9 text-slate-800">
            {getDayOfWeek(value.businessDate) || '-'}
          </div>
        </div>

        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Shift</span>
          <select
            value={value.shift}
            onChange={(event) => updateHeader('shift', event.target.value as ShiftType)}
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Manager on Duty</span>
          <select
            value={value.managerName}
            onChange={(event) => updateHeader('managerName', event.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">Select manager</option>
            {MANAGER_OPTIONS.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
            {value.managerName && !MANAGER_OPTIONS.includes(value.managerName as (typeof MANAGER_OPTIONS)[number]) && (
              <option value={value.managerName}>{value.managerName}</option>
            )}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Backroom Party</span>
          <select
            value={value.backroomParty}
            onChange={(event) => updateHeader('backroomParty', event.target.value as 'Yes' | 'No')}
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </label>
      </div>
    </Card>
  )
}
