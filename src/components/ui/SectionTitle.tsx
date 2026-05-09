import type { ReactNode } from 'react'

type SectionTitleProps = {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}

export const SectionTitle = ({
  eyebrow,
  title,
  description,
  actions,
}: SectionTitleProps) => {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
