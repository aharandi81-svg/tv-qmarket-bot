const rialFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const percentFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })

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
