import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { chefRecommendations, eventPlannerRecommendations, financialRecommendations, overallSeverity } from '../lib/recommendations'
import type { Recommendation, Severity } from '../lib/recommendations'
import { Card } from '../components/ui'

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-800 ring-1 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  info: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
}

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '⛔',
  warning: '⚠️',
  info: '💡',
  success: '✅',
}

const OVERALL_BANNER: Record<Severity, { text: string; className: string }> = {
  critical: { text: 'حداقل یک مورد بحرانی نیاز به رسیدگی فوری دارد.', className: 'bg-red-50 text-red-800 ring-1 ring-red-200' },
  warning: { text: 'چند نکته نیاز به بازبینی دارند — جزئیات را در ادامه ببینید.', className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
  info: { text: 'وضعیت کلی مناسب است؛ چند پیشنهاد اطلاعاتی موجود است.', className: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200' },
  success: { text: 'همه‌چیز طبق بررسی سه کارشناس در وضعیت مناسبی است.', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
}

function RecommendationList({ items }: { items: Recommendation[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">هیچ نکته‌ای برای این بخش وجود ندارد.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((rec) => (
        <li key={rec.id} className={`rounded-lg px-3 py-2.5 text-sm leading-6 ${SEVERITY_STYLE[rec.severity]}`}>
          {SEVERITY_ICON[rec.severity]} {rec.text}
        </li>
      ))}
    </ul>
  )
}

function sectionBadge(items: Recommendation[]): { text: string; className: string } | null {
  const criticalCount = items.filter((r) => r.severity === 'critical').length
  const warningCount = items.filter((r) => r.severity === 'warning').length
  if (criticalCount > 0) return { text: `${criticalCount} بحرانی`, className: 'bg-red-50 text-red-700 ring-1 ring-red-200' }
  if (warningCount > 0) return { text: `${warningCount} هشدار`, className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' }
  return null
}

function SectionTitle({ label, items }: { label: string; items: Recommendation[] }) {
  const badge = sectionBadge(items)
  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span>{label}</span>
      {badge && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>}
    </div>
  )
}

export function RecommendationsPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const dishes = useAppStore((s) => s.dishes)
  const dishesById = useMemo(() => buildDishesById(dishes), [dishes])

  const plannerRecs = useMemo(() => eventPlannerRecommendations(plan, dishesById), [plan, dishesById])
  const chefRecs = useMemo(() => chefRecommendations(plan, dishesById, settings), [plan, dishesById, settings])
  const financeRecs = useMemo(() => financialRecommendations(plan, dishesById, settings), [plan, dishesById, settings])

  const overall = useMemo(
    () => overallSeverity([plannerRecs, chefRecs, financeRecs]),
    [plannerRecs, chefRecs, financeRecs],
  )
  const banner = OVERALL_BANNER[overall]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className={`flex items-center gap-3 rounded-xl px-4 py-4 ${banner.className}`}>
          <span aria-hidden className="text-2xl">
            {SEVERITY_ICON[overall]}
          </span>
          <p className="text-base font-bold">{banner.text}</p>
        </div>
      </Card>
      <Card title={<SectionTitle label="👤 برنامه‌ریز رویداد" items={plannerRecs} />}>
        <RecommendationList items={plannerRecs} />
      </Card>
      <Card title={<SectionTitle label="👨‍🍳 آشپز خبره" items={chefRecs} />}>
        <RecommendationList items={chefRecs} />
      </Card>
      <Card title={<SectionTitle label="💰 کارشناس مالی" items={financeRecs} />}>
        <RecommendationList items={financeRecs} />
      </Card>
    </div>
  )
}
