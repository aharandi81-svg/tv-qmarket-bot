import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Button, Field, Modal, NumberInput, Select } from './ui'
import { COOKING_METHODS, TIERS } from '../types'
import type { Category, Dish, SelectedItem } from '../types'

/** پاپ‌آپ ویرایش یک ردیف انتخاب‌شده — رده، اندازه پرس و روش پخت تنها فیلدهای واقعاً قابل‌ویرایش
 * این ردیف‌اند (بقیه‌ی ستون‌های جدول محاسباتی و خودکارند)؛ مثل بقیه‌ی پاپ‌آپ‌های اپ، تغییرات
 * بلافاصله روی store اعمال می‌شوند، پس فقط یک دکمه‌ی «بستن» دارد. */
export function EditSelectedItemModal({
  item,
  dish,
  category,
  onClose,
}: {
  item: SelectedItem
  dish: Dish
  category: Category
  onClose: () => void
}) {
  const updateSelectedItem = useAppStore((s) => s.updateSelectedItem)
  const showCookingMethod = category !== 'نوشیدنی'

  return (
    <Modal title={`ویرایش «${dish.name}»`} onClose={onClose} widthClassName="max-w-lg">
      <div className="flex flex-col gap-4">
        <Field label="رده">
          <Select value={item.tier} onChange={(tier) => updateSelectedItem(item.itemId, { tier })} options={TIERS} />
        </Field>
        <Field label="اندازه پرس (گرم)" hint={`مرجع: ${dish.referencePortionGrams} گرم${dish.needsPortionEstimate ? ' (برآوردی)' : ''}`}>
          <NumberInput value={item.portionSize} min={0} onChange={(v) => updateSelectedItem(item.itemId, { portionSize: v })} />
        </Field>
        {showCookingMethod && (
          <Field label="روش پخت">
            <Select
              value={item.cookingMethod ?? COOKING_METHODS[0]}
              onChange={(v) => updateSelectedItem(item.itemId, { cookingMethod: v })}
              options={COOKING_METHODS}
            />
          </Field>
        )}
      </div>
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button onClick={onClose}>بستن</Button>
      </div>
    </Modal>
  )
}

/** پاپ‌آپ افزودن غذا به یک دسته — جایگزین دراپ‌داون کوچک قبلی؛ باز می‌ماند تا چند غذا پشت‌سرهم
 * اضافه شوند و کاربر خودش با «بستن» آن را می‌بندد. */
export function PickDishModal({
  category,
  dishes,
  restrictedNote,
  onAdd,
  onClose,
}: {
  category: Category
  dishes: Dish[]
  restrictedNote?: string
  onAdd: (dishId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const options = useMemo(() => {
    const inCategory = dishes.filter((d) => d.category === category)
    if (!query.trim()) return inCategory
    const q = query.trim()
    return inCategory.filter((d) => d.name.includes(q))
  }, [dishes, category, query])

  const handlePick = (dishId: string) => {
    onAdd(dishId)
    setJustAdded(dishId)
    window.setTimeout(() => setJustAdded((cur) => (cur === dishId ? null : cur)), 900)
  }

  return (
    <Modal title={`افزودن غذا به «${category}»`} onClose={onClose} widthClassName="max-w-xl">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="جستجوی نام غذا…"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      {restrictedNote && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{restrictedNote}</p>}

      <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">غذایی یافت نشد</li>}
        {options.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => handlePick(d.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm hover:bg-amber-50 dark:hover:bg-slate-800"
            >
              <span className="font-medium text-slate-800 dark:text-slate-200">{d.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                {justAdded === d.id && <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ افزوده شد</span>}
                {d.referencePortionGrams} گرم
                {d.needsPrice && <span className="text-amber-600 dark:text-amber-400">بدون قیمت</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button onClick={onClose}>بستن</Button>
      </div>
    </Modal>
  )
}
