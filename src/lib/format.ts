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

// تقویم شمسی مستقیماً از Intl.DateTimeFormat مرورگر می‌آید (calendar: persian)، نه یک
// کتابخانه‌ی جداگانه — چون خودِ مرورگرها همین محاسبه را دقیق و بدون وابستگی اضافه انجام می‌دهند.
const jalaliDateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long', timeStyle: 'short' })

/** تاریخ و ساعت شمسی یک برچسب زمانی ISO — برای لاگ تغییر قیمت مواد اولیه. */
export function formatJalaliDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return jalaliDateTimeFormatter.format(d)
}
