import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Button, Checkbox, Field, FormattedNumberInput, Modal, NumberInput, Select } from './ui'
import {
  CATEGORIES,
  COOKING_METHODS,
  DIETARY_TAGS,
  PROTEIN_SOURCES,
  PROTEIN_SOURCE_LABELS,
  WASTE_RISK_LEVELS,
} from '../types'
import type { Category, CookingMethod, Dish, DietaryTag, MacroKey, NewDishInput, ProteinSourceType, WasteRisk } from '../types'

const macroKeys: MacroKey[] = ['carb', 'protein', 'veg', 'fat']
const macroLabels: Record<MacroKey, string> = { carb: 'کربوهیدرات', protein: 'پروتئین', veg: 'سبزیجات', fat: 'چربی' }
const NO_COOKING_METHOD = 'بدون پخت (نوشیدنی/آماده)' as const

function makeInitialForm(category: Category): NewDishInput {
  return {
    name: '',
    category,
    macro: { carb: 25, protein: 25, veg: 25, fat: 25 },
    costPerServing: null,
    referencePortionGrams: 250,
    dietaryTags: [],
    isBreakfastItem: false,
    wasteRisk: 'فسادپذیر',
    proteinSource: 'plant-other',
    defaultCookingMethod: category === 'نوشیدنی' ? null : 'گریل',
    nutrition: { proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: null, calories: null },
  }
}

function formFromDish(dish: Dish): NewDishInput {
  return {
    name: dish.name,
    category: dish.category,
    macro: dish.macro,
    costPerServing: dish.costPerServing,
    referencePortionGrams: dish.referencePortionGrams,
    dietaryTags: dish.dietaryTags,
    isBreakfastItem: dish.isBreakfastItem,
    wasteRisk: dish.wasteRisk,
    proteinSource: dish.proteinSource,
    defaultCookingMethod: dish.defaultCookingMethod,
    nutrition: dish.nutrition,
  }
}

/** پاپ‌آپ فرم غذا — هم برای «افزودن غذای جدید» و هم برای «ویرایش غذای موجود» از همین یک فرم
 * استفاده می‌شود (با props دوگانه‌ی dish/initialCategory) تا تجربه‌ی افزودن و ویرایش کاملاً یکسان
 * باشد. در حالت ویرایش، ذخیره یعنی کاربر کل رکورد را مرور کرده — پس همه‌ی پرچم‌های Verified هم
 * درست مثل addDish روی true تنظیم می‌شوند. */
export function DishFormModal({
  dish,
  initialCategory,
  onClose,
}: {
  dish?: Dish
  initialCategory: Category
  onClose: (savedId?: string) => void
}) {
  const addDish = useAppStore((s) => s.addDish)
  const updateDish = useAppStore((s) => s.updateDish)
  const [form, setForm] = useState<NewDishInput>(() => (dish ? formFromDish(dish) : makeInitialForm(initialCategory)))
  const [costText, setCostText] = useState(dish?.costPerServing ?? 0)
  const [submitted, setSubmitted] = useState(false)

  const patch = (p: Partial<NewDishInput>) => setForm((f) => ({ ...f, ...p }))

  const macroSum = macroKeys.reduce((s, k) => s + form.macro[k], 0)
  const macroOk = Math.abs(macroSum - 100) < 1
  const nameValid = form.name.trim().length > 0

  const toggleDietaryTag = (tag: DietaryTag) => {
    patch({ dietaryTags: form.dietaryTags.includes(tag) ? form.dietaryTags.filter((t) => t !== tag) : [...form.dietaryTags, tag] })
  }

  const handleSubmit = () => {
    setSubmitted(true)
    if (!nameValid) return
    const name = form.name.trim()
    const costPerServing = costText > 0 ? costText : null
    if (dish) {
      updateDish(dish.id, {
        name,
        category: form.category,
        macro: form.macro,
        costPerServing,
        needsPrice: costPerServing == null,
        referencePortionGrams: form.referencePortionGrams,
        needsPortionEstimate: false,
        dietaryTags: form.dietaryTags,
        dietaryTagsVerified: true,
        isBreakfastItem: form.isBreakfastItem,
        wasteRisk: form.wasteRisk,
        wasteRiskVerified: true,
        proteinSource: form.proteinSource,
        proteinSourceVerified: true,
        defaultCookingMethod: form.defaultCookingMethod,
        defaultCookingMethodVerified: form.defaultCookingMethod != null,
        nutrition: form.nutrition,
        needsNutritionReview: false,
      })
      onClose(dish.id)
    } else {
      const id = addDish({ ...form, name, costPerServing })
      onClose(id)
    }
  }

  return (
    <Modal title={dish ? `ویرایش «${dish.name}»` : 'افزودن غذای جدید'} onClose={() => onClose()}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نام غذا">
            <input
              type="text"
              autoFocus
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="مثلاً چیکن استراگانف"
              className={`rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
                submitted && !nameValid
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-600'
                  : 'border-slate-300 focus:border-amber-500 focus:ring-amber-100 dark:border-slate-600 dark:focus:ring-amber-900/40'
              }`}
            />
            {submitted && !nameValid && <span className="text-xs text-red-600 dark:text-red-400">نام غذا اجباری است.</span>}
          </Field>
          <Field label="دسته">
            <Select
              value={form.category}
              onChange={(v) => patch({ category: v, defaultCookingMethod: v === 'نوشیدنی' ? null : (form.defaultCookingMethod ?? 'گریل') })}
              options={CATEGORIES}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">ترکیب ماکرو (٪ از پرس)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {macroKeys.map((k) => (
              <Field key={k} label={macroLabels[k]}>
                <NumberInput value={form.macro[k]} min={0} max={100} onChange={(v) => patch({ macro: { ...form.macro, [k]: v } })} />
              </Field>
            ))}
          </div>
          {!macroOk && <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">جمع فعلی {Math.round(macroSum)}٪ است — بهتر است ۱۰۰٪ شود.</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="هزینه هر پرس (ریال)" hint="خالی/صفر بگذارید اگر هنوز قیمت مشخص نیست.">
            <FormattedNumberInput value={costText} onChange={setCostText} />
          </Field>
          <Field label="وزن هر پرس (گرم)">
            <NumberInput value={form.referencePortionGrams} min={0} onChange={(v) => patch({ referencePortionGrams: v })} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ریسک هدررفت">
            <Select value={form.wasteRisk} onChange={(v: WasteRisk) => patch({ wasteRisk: v })} options={WASTE_RISK_LEVELS} />
          </Field>
          <Field label="منبع پروتئین غالب">
            <select
              value={form.proteinSource}
              onChange={(e) => patch({ proteinSource: e.target.value as ProteinSourceType })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {PROTEIN_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {PROTEIN_SOURCE_LABELS[src]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {form.category !== 'نوشیدنی' && (
          <Field label="روش پخت پیش‌فرض">
            <select
              value={form.defaultCookingMethod ?? NO_COOKING_METHOD}
              onChange={(e) => patch({ defaultCookingMethod: e.target.value === NO_COOKING_METHOD ? null : (e.target.value as CookingMethod) })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {[...COOKING_METHODS, NO_COOKING_METHOD].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Checkbox checked={form.isBreakfastItem} onChange={(v) => patch({ isBreakfastItem: v })} label="مناسب وعده صبحانه" />
          {DIETARY_TAGS.map((tag) => (
            <Checkbox key={tag} checked={form.dietaryTags.includes(tag)} onChange={() => toggleDietaryTag(tag)} label={`برچسب: ${tag}`} />
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">تغذیه (گرم برای یک پرس مرجع) — اختیاری</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="پروتئین">
              <NumberInput value={form.nutrition.proteinGrams} min={0} onChange={(v) => patch({ nutrition: { ...form.nutrition, proteinGrams: v } })} />
            </Field>
            <Field label="کربوهیدرات">
              <NumberInput value={form.nutrition.carbGrams} min={0} onChange={(v) => patch({ nutrition: { ...form.nutrition, carbGrams: v } })} />
            </Field>
            <Field label="چربی">
              <NumberInput value={form.nutrition.fatGrams} min={0} onChange={(v) => patch({ nutrition: { ...form.nutrition, fatGrams: v } })} />
            </Field>
            <Field label="کالری">
              <NumberInput
                value={form.nutrition.calories ?? 0}
                min={0}
                onChange={(v) => patch({ nutrition: { ...form.nutrition, calories: v || null } })}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="outline" onClick={() => onClose()}>
            انصراف
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {dish ? 'ذخیره تغییرات' : 'افزودن غذا'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
