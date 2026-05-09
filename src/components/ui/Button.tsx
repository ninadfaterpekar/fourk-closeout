import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-200 hover:from-amber-400 hover:to-orange-500',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20',
  ghost: 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900',
}

export const Button = ({ className = '', variant = 'primary', ...props }: ButtonProps) => {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantStyles[variant]} ${className}`}
    />
  )
}
