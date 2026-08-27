import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Card, NumberInput, Select, WarningBadge } from '../components/ui'
import { CATEGORIES } from '../types'
import type { Category, MacroKey } from '../types'
import { formatRial } from '../lib/format'

const ALL = 'همه' as const
const macroKeys: MacroKey[] = ['carb', 'protein', 'veg', 'fat']
const macroLabels: Record<MacroKey, string> = { carb: 'کربوهیدرات', protein: 'پروتئین', veg: 'سبزیجات', fat: 'چربی' }

export function DishDatabasePage() {
  const dishes = useAppStore((s) => s.dishes)
  const updateDish = useAppStore((s) => s.updateDish)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | typeof ALL>(ALL)

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (categoryFilter !== ALL && d.category !== categoryFilter) return false
      if (search.trim() && !d.name.includes(search.trim())) return false
      return true
    })
  }, [dishes, search, categoryFilter])

  return (
    <Card title={`دیتابیس غذاها (${dishes.length} غذا)`}>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="جستجوی نام غذا…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Select value={categoryFilter} onChange={setCategoryFilter} options={[ALL, ...CATEGORIES]} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-start text-xs text-gray-500">
              <th className="px-2 py-2 text-start">نام</th>
              <th className="px-2 py-2 text-start">دسته</th>
              {macroKeys.map((k) => (
                <th key={k} className="px-2 py-2 text-start">
                  {macroLabels[k]} ٪
                </th>
              ))}
              <th className="px-2 py-2 text-start">هزینه هر پرس</th>
              <th className="px-2 py-2 text-start">منبع هزینه</th>
              <th className="px-2 py-2 text-start">وضعیت</th>
              <th className="px-2 py-2 text-start">رویدادها</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dish) => {
              const macroSum = macroKeys.reduce((s, k) => s + dish.macro[k], 0)
              const macroOk = Math.abs(macroSum - 100) < 1
              return (
                <tr key={dish.id} className="border-b border-gray-100 align-top">
                  <td className="px-2 py-2 font-medium text-gray-800">
                    <input
                      type="text"
                      value={dish.name}
                      onChange={(e) => updateDish(dish.id, { name: e.target.value })}
                      className="w-40 rounded border border-transparent px-1 py-0.5 hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      value={dish.category}
                      onChange={(v) => updateDish(dish.id, { category: v })}
                      options={CATEGORIES}
                    />
                  </td>
                  {macroKeys.map((k) => (
                    <td key={k} className="px-2 py-2">
                      <NumberInput
                        value={dish.macro[k]}
                        min={0}
                        max={100}
                        className="w-16"
                        onChange={(v) => updateDish(dish.id, { macro: { ...dish.macro, [k]: v } })}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    {!macroOk && <WarningBadge>جمع {Math.round(macroSum)}٪</WarningBadge>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <NumberInput
                      value={dish.costPerServing ?? 0}
                      min={0}
                      step={10000}
                      className="w-32"
                      onChange={(v) => updateDish(dish.id, { costPerServing: v, needsPrice: false })}
                    />
                  </td>
                  <td className="px-2 py-2 text-gray-500">{dish.costSource}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      {dish.needsPrice && <WarningBadge>نیاز به قیمت</WarningBadge>}
                      {dish.priceVarianceFlag && <WarningBadge>پراکندگی قیمت &gt; ۳۰٪</WarningBadge>}
                      {!dish.needsPrice && !dish.priceVarianceFlag && (
                        <span className="text-xs text-gray-400">{formatRial(dish.costPerServing)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-400">{dish.eventsUsedIn.join('، ') || '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-gray-400">
                  غذایی یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
