import type { ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: string
  icon: ReactNode
}

export const StatCard = ({ label, value, icon }: StatCardProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="mb-0.5 flex items-center justify-between text-slate-500">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
        {icon}
      </div>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  )
}
