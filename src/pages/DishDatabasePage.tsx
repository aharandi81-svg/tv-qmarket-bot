import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Card, FormattedNumberInput, NumberInput, Select, WarningBadge } from '../components/ui'
import { CATEGORIES } from '../types'
import type { Category, MacroKey } from '../types'
import { formatRial } from '../lib/format'
import { exportDishesToXlsx, importDishesFromFile } from '../lib/dishExcel'
import type { ImportResult } from '../lib/dishExcel'

const ALL = 'همه' as const
const macroKeys: MacroKey[] = ['carb', 'protein', 'veg', 'fat']
const macroLabels: Record<MacroKey, string> = { carb: 'کربوهیدرات', protein: 'پروتئین', veg: 'سبزیجات', fat: 'چربی' }

export function DishDatabasePage() {
  const dishes = useAppStore((s) => s.dishes)
  const updateDish = useAppStore((s) => s.updateDish)
  const upsertDishes = useAppStore((s) => s.upsertDishes)
  const bulkAdjustPrices = useAppStore((s) => s.bulkAdjustPrices)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | typeof ALL>(ALL)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [bulkPercent, setBulkPercent] = useState(0)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (categoryFilter !== ALL && d.category !== categoryFilter) return false
      if (search.trim() && !d.name.includes(search.trim())) return false
      return true
    })
  }, [dishes, search, categoryFilter])

  const handleExport = () => void exportDishesToXlsx(dishes)

  const handleImportFile = async (file: File) => {
    setImportError(null)
    setImportResult(null)
    try {
      const result = await importDishesFromFile(file, dishes)
      upsertDishes(result.updated, result.added)
      setImportResult(result)
    } catch {
      setImportError('خواندن فایل اکسل ناموفق بود — مطمئن شوید فایل معتبر است و ستون‌های آن با خروجی «اکسپورت» مطابقت دارد.')
    }
  }

  const handleBulkApply = () => {
    if (bulkPercent === 0) return
    const direction = bulkPercent > 0 ? 'افزایش' : 'کاهش'
    const ok = window.confirm(
      `قیمت هر پرس همه‌ی غذاهایی که هزینه ثبت‌شده دارند به میزان ${Math.abs(bulkPercent)}٪ ${direction} می‌یابد. ادامه می‌دهید؟`,
    )
    if (!ok) return
    const count = bulkAdjustPrices(bulkPercent)
    setBulkMessage(`قیمت ${count} غذا به میزان ${Math.abs(bulkPercent)}٪ ${direction} یافت.`)
  }

  return (
    <Card title={`دیتابیس غذاها (${dishes.length} غذا)`}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <input
          type="text"
          placeholder="جستجوی نام غذا…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Select value={categoryFilter} onChange={setCategoryFilter} options={[ALL, ...CATEGORIES]} />

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          خروجی اکسل ⬇
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ورودی از اکسل ⬆
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {importError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{importError}</div>
      )}
      {importResult && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p className="font-medium">
            {importResult.updated.length} غذا به‌روزرسانی و {importResult.added.length} غذای جدید اضافه شد.
          </p>
          {importResult.warnings.length > 0 && (
            <ul className="mt-2 flex list-disc flex-col gap-1 ps-4 text-amber-700">
              {importResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
        <span className="text-sm font-medium text-gray-700">به‌روزرسانی همه‌ی قیمت‌ها:</span>
        <NumberInput value={bulkPercent} step={1} className="w-24" onChange={setBulkPercent} />
        <span className="text-sm text-gray-500">٪ (عدد منفی برای کاهش)</span>
        <button
          type="button"
          onClick={handleBulkApply}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          اعمال
        </button>
        {bulkMessage && <span className="text-sm text-emerald-700">{bulkMessage}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1300px] border-collapse text-sm">
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
              <th className="px-2 py-2 text-start">وزن هر پرس (گرم)</th>
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
                    <FormattedNumberInput
                      value={dish.costPerServing ?? 0}
                      className="w-32"
                      onChange={(v) => updateDish(dish.id, { costPerServing: v, needsPrice: false })}
                    />
                  </td>
                  <td className="px-2 py-2 text-gray-500">{dish.costSource}</td>
                  <td className="px-2 py-2">
                    <NumberInput
                      value={dish.referencePortionGrams}
                      min={0}
                      className="w-20"
                      onChange={(v) => updateDish(dish.id, { referencePortionGrams: v, needsPortionEstimate: false })}
                    />
                    {dish.needsPortionEstimate && (
                      <div className="mt-1">
                        <WarningBadge>برآوردی</WarningBadge>
                      </div>
                    )}
                  </td>
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
                <td colSpan={10} className="px-2 py-6 text-center text-gray-400">
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
