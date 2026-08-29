// ارقام لاتین با جداکننده سه‌رقمی برای خوانایی بیشتر اعداد مالی (ریال با ارقام فارسی
// در برخی مرورگرها/فونت‌ها جداکننده هزارگان را کم‌رنگ نشان می‌دهد).
const rialFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: true })
const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: true })

export function formatRial(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${rialFormatter.format(Math.round(value))} ریال`
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return numberFormatter.format(value)
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${percentFormatter.format(Math.round(fraction * 100))}٪`
}

export function formatGrams(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${numberFormatter.format(Math.round(value))} گرم`
}
