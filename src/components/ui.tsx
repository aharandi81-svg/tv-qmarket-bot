import { useEffect, useState, type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.05)] dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.25)] ${className}`}
    >
      {title && (
        <h3 className="mb-4 flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
          <span aria-hidden className="h-5 w-1.5 rounded-full bg-amber-500" />
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'danger'

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-amber-400 text-slate-900 hover:bg-amber-300 shadow-sm',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
}

/** دکمه‌ی استاندارد اپ با چهار حالت: primary (زرد پررنگ — مهم‌ترین اقدام هر بخش)، dark (مشکی —
 * اقدامات تأیید/ثانویه‌ی قوی)، outline (حاشیه‌دار — اقدامات کم‌اهمیت‌تر)، danger (قرمز — حذف). */
export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'dark',
  size = 'md',
  disabled = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}) {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * تأیید درون‌صفحه‌ای برای اقدامات حساس (به‌جای window.confirm) — چون دیالوگ‌های بومی
 * مرورگر ممکن است در محیط‌های sandboxed (مثل پیش‌نمایش Artifact) اصلاً نمایش داده نشوند
 * و کلیک روی دکمه را بی‌اثر جلوه دهند.
 */
export function ConfirmButton({
  label,
  confirmMessage,
  confirmLabel = 'بله، انجام بده',
  onConfirm,
  className = '',
  danger = false,
  disabled = false,
}: {
  label: ReactNode
  confirmMessage: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
  danger?: boolean
  disabled?: boolean
}) {
  const [pending, setPending] = useState(false)

  if (pending) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800">
        {confirmMessage}
        <button
          type="button"
          onClick={() => {
            onConfirm()
            setPending(false)
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setPending(false)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          انصراف
        </button>
      </span>
    )
  }

  return (
    <button type="button" disabled={disabled} onClick={() => setPending(true)} className={className}>
      {label}
    </button>
  )
}

export function WarningBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800">
      <span aria-hidden>⚠️</span>
      {children}
    </span>
  )
}

export function ErrorBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800">
      <span aria-hidden>⛔</span>
      {children}
    </span>
  )
}

export function SuccessBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800">
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
  gray: 'bg-slate-300 dark:bg-slate-600',
}

const textColorClasses: Record<StatusColor, string> = {
  green: 'text-emerald-700 dark:text-emerald-400',
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-700 dark:text-red-400',
  gray: 'text-slate-500 dark:text-slate-400',
}

export function ProgressBar({ percent, color }: { percent: number; color: StatusColor }) {
  const width = Math.min(100, Math.max(0, percent * 100))
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${barColorClasses[color]} transition-all`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function statusTextClass(color: StatusColor): string {
  return textColorClasses[color]
}

/** برچسب کوچک با خط زرد کنار متن — همان استایل عنوان کارت‌ها (Card)، برای وقتی که یک برچسب
 * بدون بقیه‌ی چیدمان Card (مثل داخل یک کارت دیگر) به همان زبان بصری نیاز دارد. */
export function AccentLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span aria-hidden className="h-3 w-1 shrink-0 rounded-full bg-amber-500" />
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{children}</span>
    </div>
  )
}

/** یک کادر آماری برجسته: عدد بزرگ و پررنگ + برچسب کوچک، با تُن زرد (برای مهم‌ترین/عملیاتی‌ترین
 * عدد یک بخش) یا خنثی (برای اعداد کمکی/ثانویه). همان زبان بصری بخش «سهم بودجه هر دسته». */
export function StatTile({
  label,
  value,
  hint,
  tone = 'amber',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'amber' | 'neutral'
}) {
  const boxClasses = tone === 'amber' ? 'bg-amber-50 ring-amber-100 dark:bg-amber-900/20 dark:ring-amber-800' : 'bg-slate-50 ring-slate-100 dark:bg-slate-800/60 dark:ring-slate-700'
  const labelClasses = tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
  const valueClasses = tone === 'amber' ? 'text-amber-900 dark:text-amber-200' : 'text-slate-800 dark:text-slate-200'
  return (
    <div className={`rounded-lg px-3 py-2.5 ring-1 ${boxClasses}`}>
      <p className={`text-xs font-medium ${labelClasses}`}>{label}</p>
      <p className={`text-lg font-bold ${valueClasses}`}>{value}</p>
      {hint && <p className={`mt-0.5 text-xs opacity-80 ${labelClasses}`}>{hint}</p>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  )
}

const INPUT_BASE_CLASSES = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'

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
    ? 'border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-600 dark:focus:ring-red-900/40'
    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-100 dark:border-slate-600 dark:focus:ring-amber-900/40'
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className={`${INPUT_BASE_CLASSES} ${borderClasses} ${className}`}
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
    ? 'border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-600 dark:focus:ring-red-900/40'
    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-100 dark:border-slate-600 dark:focus:ring-amber-900/40'

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
      className={`${INPUT_BASE_CLASSES} ${borderClasses} ${className}`}
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
      className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-amber-900/40 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}
