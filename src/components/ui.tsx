import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import type { Priority } from '../types'
import { priorityColor, priorityLabel } from './priority'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300',
  secondary: 'bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-100',
  ghost: 'text-zinc-600 hover:bg-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 ${className}`}
      {...rest}
    />
  )
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 ${className}`}
      {...rest}
    />
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{children}</span>
}

export function PriorityDot({ p }: { p: Priority }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${priorityColor[p]}`} title={priorityLabel[p]} />
}
