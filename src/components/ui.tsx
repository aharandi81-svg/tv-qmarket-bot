import { useEffect, useState, type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <h3 className="mb-3 text-base font-semibold text-gray-800">{title}</h3>}
      {children}
    </div>
  )
}

export function WarningBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <span aria-hidden>⚠️</span>
      {children}
    </span>
  )
}

export function ErrorBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
      <span aria-hidden>⛔</span>
      {children}
    </span>
  )
}

export function SuccessBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      {children}
    </span>
  )
}

type StatusColor = 'green' | 'amber' | 'red' | 'gray'

export function statusColorFor(percent: number, lowIsBad = true): StatusColor {
  if (!Number.isFinite(percent)) return 'gray'
  if (lowIsBad) {
    if (percent >= 0.9 && percent <= 1.15) return 'green'
    if (percent >= 0.7 && percent < 1.4) return 'amber'
    return 'red'
  }
  if (percent <= 1) return 'green'
  if (percent <= 1.15) return 'amber'
  return 'red'
}

const barColorClasses: Record<StatusColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-gray-300',
}

const textColorClasses: Record<StatusColor, string> = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  gray: 'text-gray-500',
}

export function ProgressBar({ percent, color }: { percent: number; color: StatusColor }) {
  const width = Math.min(100, Math.max(0, percent * 100))
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${barColorClasses[color]} transition-all`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function statusTextClass(color: StatusColor): string {
  return textColorClasses[color]
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  invalid = false,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  invalid?: boolean
  className?: string
}) {
  const borderClasses = invalid
    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
    : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${borderClasses} ${className}`}
    />
  )
}

const digitGrouper = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** ورودی عددی با جداکننده سه‌رقمی برای مبالغ بزرگ (مثل ریال) — چون <input type="number">
 * بومی مرورگر امکان نمایش جداکننده هزارگان را ندارد، این یک ورودی متنی است که رقم خام را
 * نگه می‌دارد و فقط نمایش را فرمت می‌کند. */
export function FormattedNumberInput({
  value,
  onChange,
  invalid = false,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  invalid?: boolean
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(() => (Number.isFinite(value) ? digitGrouper.format(value) : ''))

  useEffect(() => {
    if (!focused) setText(Number.isFinite(value) ? digitGrouper.format(value) : '')
  }, [value, focused])

  const borderClasses = invalid
    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
    : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const digitsOnly = text.replace(/[^\d.-]/g, '')
        const n = digitsOnly === '' ? 0 : Number(digitsOnly)
        onChange(Number.isFinite(n) ? n : 0)
      }}
      className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${borderClasses} ${className}`}
    />
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T
  onChange: (value: T) => void
  options: readonly T[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}
