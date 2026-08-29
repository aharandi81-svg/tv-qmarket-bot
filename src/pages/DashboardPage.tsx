import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { computeCookingComplexity, computePlanSummary } from '../lib/calculations'
import { Card, ProgressBar, WarningBadge, statusColorFor, statusTextClass } from '../components/ui'
import { formatGrams, formatPercent, formatRial } from '../lib/format'
import type { Category, MacroKey } from '../types'
import { DIETARY_TAGS } from '../types'

const macroLabels: Record<MacroKey, string> = {
  carb: 'کربوهیدرات / غلات',
  protein: 'پروتئین',
  veg: 'سبزیجات و میوه',
  fat: 'چربی',
}

const PLATE_CATEGORIES: Category[] = ['غذای اصلی', 'پیش‌غذا', 'دسر']

export function DashboardPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const dishes = useAppStore((s) => s.dishes)

  const dishesById = useMemo(() => buildDishesById(dishes), [dishes])
  const summary = useMemo(() => computePlanSummary(plan, dishesById, settings), [plan, dishesById, settings])
  const complexity = useMemo(() => computeCookingComplexity(plan, dishesById, settings), [plan, dishesById, settings])

  const costRatio = summary.totalBudget > 0 ? summary.totalCost / summary.totalBudget : 0
  const costColor = statusColorFor(costRatio, false)
  const estimatedRatio = summary.totalBudget > 0 ? summary.estimatedTotalCost / summary.totalBudget : 0

  const dietaryCounts = useMemo(() => {
    const selectedFoodDishIds = new Set(
      plan.selectedItems
        .map((it) => dishesById.get(it.dishId))
        .filter((d): d is NonNullable<typeof d> => !!d && d.category !== 'نوشیدنی')
        .map((d) => d.id),
    )
    return DIETARY_TAGS.map((tag) => ({
      tag,
      count: Array.from(selectedFoodDishIds).filter((id) => dishesById.get(id)?.dietaryTags.includes(tag)).length,
    }))
  }, [plan.selectedItems, dishesById])

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={
          <div className="flex items-center justify-between">
            <span>هزینه کل رویداد در برابر بودجه</span>
            {summary.hasMissingPrices && (
              <WarningBadge>{summary.missingPriceCount} آیتم قیمت ندارند و در «هزینه قطعی» لحاظ نشده‌اند</WarningBadge>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className={`font-semibold ${statusTextClass(costColor)}`}>هزینه قطعی: {formatRial(summary.totalCost)}</span>
            <span className="text-gray-400">از {formatRial(summary.totalBudget)}</span>
          </div>
          <ProgressBar percent={costRatio} color={costColor} />
          <span className="text-xs text-gray-400">{formatPercent(costRatio)} از بودجه کل (بر اساس هزینه قطعی) مصرف شده است</span>

          {summary.hasMissingPrices && (
            <div className="mt-2 flex flex-col gap-1 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-amber-800">
                  هزینه تخمینی (با احتساب موارد بدون قیمت): {formatRial(summary.estimatedTotalCost)}
                </span>
                <span className="text-amber-600">{formatPercent(estimatedRatio)} از بودجه</span>
              </div>
              <span className="text-xs text-amber-700">
                برای آیتم‌های بدون قیمت، میانگین هزینه‌ی سایر غذاهای قیمت‌دار همان دسته جایگزین شده — صرفاً یک تخمین است، نه
                عدد واقعی.
              </span>
            </div>
          )}
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
        <p className="mt-3 text-xs text-gray-400">
          نوشیدنی‌ها در این جمع‌بندی لحاظ نمی‌شوند. عدد هر دسته میانگین وزنی (بر اساس تعداد پوشش) بین آیتم‌های همان دسته
          است — نه جمع همه‌ی آیتم‌ها — چون یک مهمان معمولاً از هر دسته حدوداً یک بار سرو می‌گیرد، نه یک پرس کامل از هر
          گزینه.
        </p>
        {PLATE_CATEGORIES.some((c) => summary.macro.categoryAverages.find((a) => a.category === c)?.avgPortionGrams) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summary.macro.categoryAverages.map((avg) => (
              <div key={avg.category} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-medium text-gray-700">{avg.category}: </span>
                میانگین {formatGrams(avg.avgPortionGrams)} برای هر مهمان
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="گزینه‌های رژیمی موجود در سناریو (تشخیص خودکار — نیازمند تأیید دستی)">
        <div className="flex flex-wrap gap-3">
          {dietaryCounts.map(({ tag, count }) => (
            <span
              key={tag}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
            >
              {tag}: {count} غذا
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-600">
          ⚠️ این برچسب‌ها صرفاً از روی نام/مواد اولیه به‌صورت خودکار حدس زده شده‌اند و برای اعلام رسمی به مهمانان با
          حساسیت غذایی/مذهبی باید توسط تیم آشپزخانه تأیید دستی شوند (نگاه کنید به دیتابیس غذاها).
        </p>
      </Card>

      <Card title="شاخص پیچیدگی آشپزخانه (روش پخت، در برابر ظرفیت واقعی هر ایستگاه)">
        {complexity.length === 0 ? (
          <p className="text-sm text-gray-400">هنوز غذایی با روش پخت مشخصی انتخاب نشده است.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-start text-xs text-gray-500">
                <th className="px-2 py-2 text-start">روش پخت</th>
                <th className="px-2 py-2 text-start">تعداد غذا</th>
                <th className="px-2 py-2 text-start">ظرفیت ایستگاه</th>
                <th className="px-2 py-2 text-start">غذاها</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {complexity.map((row) => (
                <tr key={row.method} className="border-b border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-800">{row.method}</td>
                  <td className="px-2 py-2">{row.count}</td>
                  <td className="px-2 py-2 text-gray-500">{row.capacity}</td>
                  <td className="px-2 py-2 text-gray-500">{row.dishNames.join('، ')}</td>
                  <td className="px-2 py-2">{row.overCapacity && <WarningBadge>بیش از ظرفیت ایستگاه</WarningBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-gray-400">ظرفیت هر ایستگاه از صفحه تنظیمات رویداد قابل ویرایش است.</p>
      </Card>
    </div>
  )
}
