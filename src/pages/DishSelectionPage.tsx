import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildDishesById } from '../data/dishes'
import { computeAllItemCalcs } from '../lib/calculations'
import { Card, NumberInput, Select, WarningBadge } from '../components/ui'
import { DishPicker } from '../components/DishPicker'
import { CATEGORIES, COOKING_METHODS, TIERS } from '../types'
import type { Category } from '../types'
import { formatRial } from '../lib/format'

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

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map((category) => (
        <CategorySection
          key={category}
          category={category}
          dishes={dishes}
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
  selectedItems,
  calcByItemId,
  onAdd,
  onUpdate,
  onRemove,
}: {
  category: Category
  dishes: ReturnType<typeof useAppStore.getState>['dishes']
  selectedItems: ReturnType<typeof useAppStore.getState>['plan']['selectedItems']
  calcByItemId: Map<string, ReturnType<typeof computeAllItemCalcs>[number]>
  onAdd: (dishId: string) => void
  onUpdate: (itemId: string, patch: Partial<(typeof selectedItems)[number]>) => void
  onRemove: (itemId: string) => void
}) {
  const isMain = category === 'غذای اصلی'
  return (
    <Card title={category}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-start text-xs text-gray-500">
              <th className="px-2 py-2" />
              <th className="px-2 py-2 text-start">غذا</th>
              <th className="px-2 py-2 text-start">رده</th>
              <th className="px-2 py-2 text-start">تعداد پوشش</th>
              <th className="px-2 py-2 text-start">اندازه پرس (گرم)</th>
              {isMain && <th className="px-2 py-2 text-start">روش پخت</th>}
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
              return (
                <tr key={item.itemId} className="border-b border-gray-100 align-top">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onRemove(item.itemId)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="حذف"
                    >
                      ✕
                    </button>
                  </td>
                  <td className="px-2 py-2 font-medium text-gray-800">
                    {dish.name}
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
                    <Select value={item.tier} onChange={(v) => onUpdate(item.itemId, { tier: v })} options={TIERS} />
                  </td>
                  <td className="px-2 py-2">
                    <NumberInput
                      value={item.coverageCount}
                      min={0}
                      className="w-24"
                      onChange={(v) => onUpdate(item.itemId, { coverageCount: v })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <NumberInput
                      value={item.portionSize}
                      min={0}
                      className="w-24"
                      onChange={(v) => onUpdate(item.itemId, { portionSize: v })}
                    />
                  </td>
                  {isMain && (
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
                          ? 'bg-gray-100 text-gray-500'
                          : over
                            ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      {dish.needsPrice ? 'نامشخص' : over ? 'خارج از بودجه' : 'در بودجه'}
                    </span>
                  </td>
                  <td className="px-2 py-2">{calc.batchQuantity}</td>
                  <td className="px-2 py-2">{calc.maxAffordableQty ?? '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">{formatRial(calc.totalItemCost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 max-w-sm">
        <DishPicker category={category} dishes={dishes} onPick={onAdd} />
      </div>
    </Card>
  )
}
