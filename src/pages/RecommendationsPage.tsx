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
  return (
    <ul className="flex flex-col gap-2">
      {items.map((rec) => (
        <li key={rec.id} className={`rounded-lg px-3 py-2 text-sm ${SEVERITY_STYLE[rec.severity]}`}>
          {SEVERITY_ICON[rec.severity]} {rec.text}
        </li>
      ))}
    </ul>
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
        <p className={`rounded-lg px-3 py-2 text-sm font-medium ${banner.className}`}>
          {SEVERITY_ICON[overall]} {banner.text}
        </p>
      </Card>
      <Card title="👤 برنامه‌ریز رویداد">
        <RecommendationList items={plannerRecs} />
      </Card>
      <Card title="👨‍🍳 آشپز خبره">
        <RecommendationList items={chefRecs} />
      </Card>
      <Card title="💰 کارشناس مالی">
        <RecommendationList items={financeRecs} />
      </Card>
    </div>
  )
}
