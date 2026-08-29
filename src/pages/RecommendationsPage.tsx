import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { chefRecommendations, eventPlannerRecommendations, financialRecommendations } from '../lib/recommendations'
import type { Recommendation } from '../lib/recommendations'
import { Card } from '../components/ui'

function RecommendationList({ items }: { items: Recommendation[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((rec) => (
        <li
          key={rec.id}
          className={`rounded-lg px-3 py-2 text-sm ${
            rec.severity === 'warning' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-gray-50 text-gray-700'
          }`}
        >
          {rec.severity === 'warning' ? '⚠️ ' : '💡 '}
          {rec.text}
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

  return (
    <div className="flex flex-col gap-6">
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
