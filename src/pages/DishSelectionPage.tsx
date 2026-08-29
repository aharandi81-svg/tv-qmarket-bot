import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { computeAllItemCalcs } from '../lib/calculations'
import { Card, NumberInput, Select, WarningBadge } from '../components/ui'
import { DishPicker } from '../components/DishPicker'
import { CATEGORIES, COOKING_METHODS, TIERS, mealTypeIncludesBreakfast, mealTypeIncludesLunchOrDinner } from '../types'
import type { AppSettings, Category, Dish } from '../types'
import { formatNumber, formatRial } from '../lib/format'

export function DishSelectionPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const dishes = useAppStore((s) => s.dishes)
  const addSelectedItem = useAppStore((s) => s.addSelectedItem)
  const updateSelectedItem = useAppStore((s) => s.updateSelectedItem)
  const removeSelectedItem = useAppStore((s) => s.removeSelectedItem)

  const dishesById = useMemo(() => buildDishesById(dishes), [dishes])
  const itemCalcs = useMemo(() => computeAllItemCalcs(plan, dishesById, settings), [plan, dishesById, settings])
  const calcByItemId = useMemo(() => new Map(itemCalcs.map((c) => [c.itemId, c])), [itemCalcs])

  const showBreakfast = mealTypeIncludesBreakfast(plan.mealType)
  const showLunchDinner = mealTypeIncludesLunchOrDinner(plan.mealType)

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-slate-50">
        <p className="text-sm text-slate-700">
          نحوه‌ی تعیین «تعداد پخت»: هر آیتم یک <strong>سهم پوشش</strong> دارد (چند درصد از مهمانان <em>حاضر</em> این
          غذا را می‌گیرند). تعداد نفر = تعداد میهمانان × نرخ حضور مورد انتظار × سهم پوشش — و از آن‌جا:{' '}
          <strong>تعداد پخت</strong> = تعداد نفر × ضریب اطمینان. چون این فرمول همیشه از روی مقادیر تازه‌ی صفحه
          «تنظیمات رویداد» محاسبه می‌شود، با تغییر تعداد میهمانان یا نرخ حضور، همه‌ی اعداد این صفحه به‌صورت خودکار
          به‌روز می‌شوند — نیازی به ویرایش دستی هر ردیف نیست.
        </p>
      </Card>

      {CATEGORIES.map((category) => (
        <CategorySection
          key={category}
          category={category}
          dishes={dishes}
          plan={plan}
          settings={settings}
          showBreakfast={showBreakfast}
          showLunchDinner={showLunchDinner}
          selectedItems={plan.selectedItems.filter((it) => dishesById.get(it.dishId)?.category === category)}
          calcByItemId={calcByItemId}
          onAdd={(dishId) => addSelectedItem(category, dishId)}
          onUpdate={updateSelectedItem}
          onRemove={removeSelectedItem}
        />
      ))}
    </div>
  )
}

function CategorySection({
  category,
  dishes,
  plan,
  settings,
  showBreakfast,
  showLunchDinner,
  selectedItems,
  calcByItemId,
  onAdd,
  onUpdate,
  onRemove,
}: {
  category: Category
  dishes: Dish[]
  plan: ReturnType<typeof useAppStore.getState>['plan']
  settings: AppSettings
  showBreakfast: boolean
  showLunchDinner: boolean
  selectedItems: ReturnType<typeof useAppStore.getState>['plan']['selectedItems']
  calcByItemId: Map<string, ReturnType<typeof computeAllItemCalcs>[number]>
  onAdd: (dishId: string) => void
  onUpdate: (itemId: string, patch: Partial<(typeof selectedItems)[number]>) => void
  onRemove: (itemId: string) => void
}) {
  const showCookingMethod = category !== 'نوشیدنی'
  // نوشیدنی‌ها مستقل از نوع وعده‌اند (چای/قهوه/آب‌میوه در صبحانه و ناهار و شام یکسان کاربرد دارند)
  // پس فیلتر مرتبط‌بودن با وعده فقط برای دسته‌های غذایی واقعی اعمال می‌شود.
  const relevantDishes =
    category === 'نوشیدنی' ? dishes : dishes.filter((d) => (d.isBreakfastItem ? showBreakfast : showLunchDinner))

  return (
    <Card title={category}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
              <th className="px-2 py-2" />
              <th className="px-2 py-2 text-start">غذا</th>
              <th className="px-2 py-2 text-start">رده</th>
              <th className="px-2 py-2 text-start">سهم پوشش (٪ مهمانان حاضر)</th>
              <th className="px-2 py-2 text-start">اندازه پرس (گرم)</th>
              {showCookingMethod && <th className="px-2 py-2 text-start">روش پخت</th>}
              <th className="px-2 py-2 text-start">هزینه هر پرس</th>
              <th className="px-2 py-2 text-start">سهم بودجه</th>
              <th className="px-2 py-2 text-start">وضعیت بودجه</th>
              <th className="px-2 py-2 text-start">تعداد پخت</th>
              <th className="px-2 py-2 text-start">حداکثر قابل‌خرید</th>
              <th className="px-2 py-2 text-start">هزینه کل</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item) => {
              const dish = dishes.find((d) => d.id === item.dishId)
              const calc = calcByItemId.get(item.itemId)
              if (!dish || !calc) return null
              const over = calc.overBudget
              const percentInvalid = item.coveragePercent > 1
              return (
                <tr key={item.itemId} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onRemove(item.itemId)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="حذف"
                    >
                      ✕
                    </button>
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-800">
                    {dish.name}
                    {dish.dietaryTags.length > 0 && (
                      <span
                        className="ms-1 text-xs font-normal text-emerald-600"
                        title="تشخیص خودکار و تأییدنشده — پیش از اعلام به مهمانان بازبینی دستی کنید"
                      >
                        ({dish.dietaryTags.join('/')} — تأییدنشده)
                      </span>
                    )}
                    {dish.needsPrice && (
                      <div className="mt-1">
                        <WarningBadge>نیاز به قیمت</WarningBadge>
                      </div>
                    )}
                    {dish.priceVarianceFlag && (
                      <div className="mt-1">
                        <WarningBadge>پراکندگی قیمت بالا</WarningBadge>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      value={item.tier}
                      onChange={(tier) => onUpdate(item.itemId, { tier, coveragePercent: settings.defaultCoverageByTier[tier] })}
                      options={TIERS}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <NumberInput
                        value={Math.round(item.coveragePercent * 1000) / 10}
                        min={0}
                        max={100}
                        step={5}
                        invalid={percentInvalid}
                        className="w-20"
                        onChange={(v) => onUpdate(item.itemId, { coveragePercent: v / 100 })}
                      />
                      <span className="text-xs text-slate-500">٪</span>
                    </div>
                    <p className="mt-1 max-w-[9rem] text-xs text-slate-400">
                      = {formatNumber(calc.coverageCount)} نفر ({plan.guestCount} × {Math.round(plan.expectedAttendanceRate * 100)}٪ × {Math.round(item.coveragePercent * 100)}٪)
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    <NumberInput
                      value={item.portionSize}
                      min={0}
                      className="w-24"
                      onChange={(v) => onUpdate(item.itemId, { portionSize: v })}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      مرجع: {dish.referencePortionGrams} گرم
                      {dish.needsPortionEstimate && ' (برآوردی)'}
                    </p>
                  </td>
                  {showCookingMethod && (
                    <td className="px-2 py-2">
                      <Select
                        value={item.cookingMethod ?? COOKING_METHODS[0]}
                        onChange={(v) => onUpdate(item.itemId, { cookingMethod: v })}
                        options={COOKING_METHODS}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 whitespace-nowrap">{formatRial(dish.costPerServing)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatRial(calc.budgetShare)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        dish.needsPrice
                          ? 'bg-slate-100 text-slate-500'
                          : over
                            ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      {dish.needsPrice ? 'نامشخص' : over ? 'خارج از بودجه' : 'در بودجه'}
                    </span>
                  </td>
                  <td className="px-2 py-2">{formatNumber(calc.batchQuantity)}</td>
                  <td className="px-2 py-2">{calc.maxAffordableQty != null ? formatNumber(calc.maxAffordableQty) : '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">{formatRial(calc.totalItemCost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 max-w-sm">
        <DishPicker category={category} dishes={relevantDishes} onPick={onAdd} />
        {relevantDishes.length < dishes.filter((d) => d.category === category).length && (
          <p className="mt-1 text-xs text-slate-400">
            فقط غذاهای مرتبط با «{plan.mealType}» نشان داده می‌شوند — نوع وعده را از تنظیمات رویداد عوض کنید تا فهرست
            کامل دیده شود.
          </p>
        )}
      </div>
    </Card>
  )
}
