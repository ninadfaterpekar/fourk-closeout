import { useState } from 'react'

type CurrencyInputProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  className?: string
  inputId?: string
  error?: string
}

export const CurrencyInput = ({
  value,
  onChange,
  min = 0,
  className = '',
  inputId,
  error,
}: CurrencyInputProps) => {
  const [isFocused, setIsFocused] = useState(false)

  const displayValue = Number.isFinite(value) ? value : ''

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
      <input
        id={inputId}
        type="number"
        min={min}
        step="0.01"
        value={displayValue}
        onFocus={() => {
          setIsFocused(true)
          if (Number.isFinite(value) && value === 0) {
            onChange(Number.NaN)
          }
        }}
        onBlur={(event) => {
          setIsFocused(false)
          if (event.target.value === '' || !Number.isFinite(value)) {
            onChange(0)
          }
        }}
        onChange={(event) => {
          const rawValue = event.target.value
          onChange(rawValue === '' ? Number.NaN : Number(rawValue))
        }}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-md border bg-white py-1.5 pl-7 pr-2 text-sm text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
        } ${isFocused ? 'selection:bg-amber-200' : ''}`}
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
