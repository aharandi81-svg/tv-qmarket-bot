import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { computeCookingComplexity, computePlanSummary } from '../lib/calculations'
import { Card, ProgressBar, WarningBadge, statusColorFor, statusTextClass } from '../components/ui'
import { formatGrams, formatPercent, formatRial } from '../lib/format'
import type { MacroKey } from '../types'

const macroLabels: Record<MacroKey, string> = {
  carb: 'کربوهیدرات / غلات',
  protein: 'پروتئین',
  veg: 'سبزیجات و میوه',
  fat: 'چربی',
}

export function DashboardPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const dishes = useAppStore((s) => s.dishes)

  const dishesById = useMemo(() => buildDishesById(dishes), [dishes])
  const summary = useMemo(() => computePlanSummary(plan, dishesById, settings), [plan, dishesById, settings])
  const complexity = useMemo(() => computeCookingComplexity(plan, dishesById), [plan, dishesById])

  const costRatio = summary.totalBudget > 0 ? summary.totalCost / summary.totalBudget : 0
  const costColor = statusColorFor(costRatio, false)

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={
          <div className="flex items-center justify-between">
            <span>هزینه کل رویداد در برابر بودجه</span>
            {summary.hasMissingPrices && <WarningBadge>برخی آیتم‌ها قیمت ندارند و در جمع لحاظ نشده‌اند</WarningBadge>}
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className={`font-semibold ${statusTextClass(costColor)}`}>{formatRial(summary.totalCost)}</span>
            <span className="text-gray-400">از {formatRial(summary.totalBudget)}</span>
          </div>
          <ProgressBar percent={costRatio} color={costColor} />
          <span className="text-xs text-gray-400">{formatPercent(costRatio)} از بودجه کل مصرف شده است</span>
        </div>
      </Card>

      <Card title="ترکیب تغذیه‌ای سطح سفره (طبق فرمول تقسیم سفره)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(macroLabels) as MacroKey[]).map((key) => {
            const isFat = key === 'fat'
            const percent = summary.macro.statusPercent[key]
            const color = isFat ? 'gray' : statusColorFor(percent)
            return (
              <div key={key} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3">
                <span className="text-sm font-medium text-gray-700">{macroLabels[key]}</span>
                <span className="text-lg font-semibold text-gray-800">{formatGrams(summary.macro.totalGrams[key])}</span>
                {!isFat && (
                  <>
                    <ProgressBar percent={percent} color={color} />
                    <span className={`text-xs ${statusTextClass(color)}`}>
                      {formatPercent(percent)} از هدف ({formatGrams(summary.macro.targetGrams[key])})
                    </span>
                  </>
                )}
                {isFat && <span className="text-xs text-gray-400">نمایش اطلاعاتی — بدون هدف یا هشدار</span>}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400">نوشیدنی‌ها در این جمع‌بندی لحاظ نمی‌شوند.</p>
      </Card>

      <Card title="شاخص پیچیدگی آشپزخانه (روش پخت غذاهای اصلی)">
        {complexity.length === 0 ? (
          <p className="text-sm text-gray-400">هنوز غذای اصلی با روش پخت مشخصی انتخاب نشده است.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-start text-xs text-gray-500">
                <th className="px-2 py-2 text-start">روش پخت</th>
                <th className="px-2 py-2 text-start">تعداد غذا</th>
                <th className="px-2 py-2 text-start">غذاها</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {complexity.map((row) => (
                <tr key={row.method} className="border-b border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-800">{row.method}</td>
                  <td className="px-2 py-2">{row.count}</td>
                  <td className="px-2 py-2 text-gray-500">{row.dishNames.join('، ')}</td>
                  <td className="px-2 py-2">
                    {row.count > 3 && <WarningBadge>بیش از ۳ غذا هم‌زمان با این روش پخت</WarningBadge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
