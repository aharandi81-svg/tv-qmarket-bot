import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { computeAllItemCalcs, computeCookingComplexity, computePlanSummary } from '../lib/calculations'
import { Card, NumberInput, ProgressBar, WarningBadge, statusColorFor, statusTextClass } from '../components/ui'
import { formatGrams, formatNumber, formatPercent, formatRial } from '../lib/format'
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
  const recordActualConsumption = useAppStore((s) => s.recordActualConsumption)

  const dishesById = useMemo(() => buildDishesById(dishes), [dishes])
  const summary = useMemo(() => computePlanSummary(plan, dishesById, settings), [plan, dishesById, settings])
  const complexity = useMemo(() => computeCookingComplexity(plan, dishesById, settings), [plan, dishesById, settings])
  const itemCalcs = useMemo(() => computeAllItemCalcs(plan, dishesById, settings), [plan, dishesById, settings])

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
            <span className="text-slate-400">از {formatRial(summary.totalBudget)}</span>
          </div>
          <ProgressBar percent={costRatio} color={costColor} />
          <span className="text-xs text-slate-400">{formatPercent(costRatio)} از بودجه کل (بر اساس هزینه قطعی) مصرف شده است</span>

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
              <div key={key} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3">
                <span className="text-sm font-medium text-slate-700">{macroLabels[key]}</span>
                <span className="text-lg font-semibold text-slate-800">{formatGrams(summary.macro.totalGrams[key])}</span>
                {!isFat && (
                  <>
                    <ProgressBar percent={percent} color={color} />
                    <span className={`text-xs ${statusTextClass(color)}`}>
                      {formatPercent(percent)} از هدف ({formatGrams(summary.macro.targetGrams[key])})
                    </span>
                  </>
                )}
                {isFat && <span className="text-xs text-slate-400">نمایش اطلاعاتی — بدون هدف یا هشدار</span>}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          نوشیدنی‌ها در این جمع‌بندی لحاظ نمی‌شوند. عدد هر دسته میانگین وزنی (بر اساس تعداد پوشش) بین آیتم‌های همان دسته
          است — نه جمع همه‌ی آیتم‌ها — چون یک مهمان معمولاً از هر دسته حدوداً یک بار سرو می‌گیرد، نه یک پرس کامل از هر
          گزینه.
        </p>
        {PLATE_CATEGORIES.some((c) => summary.macro.categoryAverages.find((a) => a.category === c)?.avgPortionGrams) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summary.macro.categoryAverages.map((avg) => (
              <div key={avg.category} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">{avg.category}: </span>
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
          <p className="text-sm text-slate-400">هنوز غذایی با روش پخت مشخصی انتخاب نشده است.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                <th className="px-2 py-2 text-start">روش پخت</th>
                <th className="px-2 py-2 text-start">تعداد غذا</th>
                <th className="px-2 py-2 text-start">ظرفیت ایستگاه</th>
                <th className="px-2 py-2 text-start">غذاها</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {complexity.map((row) => (
                <tr key={row.method} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-800">{row.method}</td>
                  <td className="px-2 py-2">{row.count}</td>
                  <td className="px-2 py-2 text-slate-500">{row.capacity}</td>
                  <td className="px-2 py-2 text-slate-500">{row.dishNames.join('، ')}</td>
                  <td className="px-2 py-2">{row.overCapacity && <WarningBadge>بیش از ظرفیت ایستگاه</WarningBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-400">ظرفیت هر ایستگاه از صفحه تنظیمات رویداد قابل ویرایش است.</p>
      </Card>

      <RecordActualsCard plan={plan} itemCalcs={itemCalcs} dishesById={dishesById} onRecord={recordActualConsumption} />
    </div>
  )
}

/**
 * حلقه‌ی یادگیری از رویداد واقعی: بعد از پایان رویداد، مصرف واقعی هر آیتم اینجا ثبت می‌شود و
 * میانگین متحرک «سهم پوشش مشاهده‌شده» همان غذا در دیتابیس غذا به‌روز می‌شود — از رویداد بعد،
 * این عدد به‌جای حدس کلی رده به‌عنوان پیش‌فرض سهم پوشش استفاده می‌شود (نگاه کنید به
 * useAppStore.addSelectedItem). بدون این ثبت، سیستم همیشه روی حدس اولیه گیر می‌ماند.
 */
function RecordActualsCard({
  plan,
  itemCalcs,
  dishesById,
  onRecord,
}: {
  plan: ReturnType<typeof useAppStore.getState>['plan']
  itemCalcs: ReturnType<typeof computeAllItemCalcs>
  dishesById: ReturnType<typeof buildDishesById>
  onRecord: (itemId: string, actualServed: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({})

  if (plan.selectedItems.length === 0) return null

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-sm font-medium text-amber-700 hover:underline"
      >
        {expanded ? '▲ بستن' : '▼'} ثبت مصرف واقعی پس از رویداد (برای اصلاح خودکار برآورد رویدادهای بعدی)
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            بعد از پایان رویداد، تعداد پرسی که واقعاً از هر غذا مصرف شد را وارد کنید. سیستم از روی این عدد میانگین
            «سهم پوشش مشاهده‌شده» همان غذا را به‌روز می‌کند تا در رویدادهای بعدی به‌جای حدس اولیه، از داده‌ی واقعی
            استفاده شود (نگاه کنید به ستون «سهم پوشش مشاهده‌شده» در دیتابیس غذا).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                  <th className="px-2 py-2 text-start">غذا</th>
                  <th className="px-2 py-2 text-start">پیش‌بینی (تعداد پخت)</th>
                  <th className="px-2 py-2 text-start">مصرف واقعی</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {plan.selectedItems.map((item) => {
                  const dish = dishesById.get(item.dishId)
                  const calc = itemCalcs.find((c) => c.itemId === item.itemId)
                  if (!dish || !calc) return null
                  const draft = drafts[item.itemId] ?? calc.batchQuantity
                  return (
                    <tr key={item.itemId} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-800">{dish.name}</td>
                      <td className="px-2 py-2 text-slate-500">{formatNumber(calc.batchQuantity)}</td>
                      <td className="px-2 py-2">
                        <NumberInput
                          value={draft}
                          min={0}
                          className="w-24"
                          onChange={(v) => setDrafts((s) => ({ ...s, [item.itemId]: v }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        {savedIds[item.itemId] ? (
                          <span className="text-xs text-emerald-600">✓ ثبت شد</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onRecord(item.itemId, draft)
                              setSavedIds((s) => ({ ...s, [item.itemId]: true }))
                            }}
                            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            ثبت
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
