import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Card, ErrorBadge, Field, FormattedNumberInput, NumberInput, WarningBadge } from '../components/ui'
import type { Category } from '../types'
import { CATEGORIES, TIERS } from '../types'
import { formatPercent, formatRial } from '../lib/format'

const categoryLabels: Record<Category, string> = {
  'غذای اصلی': 'غذای اصلی',
  'پیش‌غذا': 'پیش‌غذا',
  'دسر': 'دسر',
  'نوشیدنی': 'نوشیدنی',
}

export function EventSettingsPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const setPlanField = useAppStore((s) => s.setPlanField)
  const setCategoryBudgetShare = useAppStore((s) => s.setCategoryBudgetShare)
  const setTierWeight = useAppStore((s) => s.setTierWeight)
  const setDefaultCoverageByTier = useAppStore((s) => s.setDefaultCoverageByTier)
  const setTierCostCeiling = useAppStore((s) => s.setTierCostCeiling)
  const setNutritionTarget = useAppStore((s) => s.setNutritionTarget)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const shareSum = CATEGORIES.reduce((sum, c) => sum + (plan.categoryBudgetShare[c] ?? 0), 0)
  const shareOver = shareSum - 1 > 0.001
  const shareUnder = 1 - shareSum > 0.001
  const totalBudget = plan.guestCount * plan.perPersonBudget

  return (
    <div className="flex flex-col gap-6">
      <Card title="پارامترهای اصلی رویداد">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="تعداد میهمانان">
            <NumberInput value={plan.guestCount} min={1} onChange={(v) => setPlanField('guestCount', v)} />
          </Field>
          <Field label="بودجه سرانه (ریال)">
            <FormattedNumberInput value={plan.perPersonBudget} onChange={(v) => setPlanField('perPersonBudget', v)} />
          </Field>
          <Field label="ضریب اطمینان" hint="ضریب افزایش تعداد پخت نسبت به پوشش">
            <NumberInput value={plan.confidenceFactor} min={1} step={0.05} onChange={(v) => setPlanField('confidenceFactor', v)} />
          </Field>
          <Field label="نوع وعده">
            <input
              type="text"
              value={plan.mealType}
              onChange={(e) => setPlanField('mealType', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          بودجه کل رویداد: <span className="font-semibold text-gray-800">{formatRial(totalBudget)}</span>
        </p>
      </Card>

      <Card
        title={
          <div className="flex items-center justify-between">
            <span>سهم بودجه هر دسته از سرانه</span>
            {shareOver && (
              <ErrorBadge>
                جمع سهم‌ها {formatPercent(shareSum)} شده — یک یا چند دسته دیگر را کم کنید یا بودجه سرانه را افزایش
                دهید
              </ErrorBadge>
            )}
            {shareUnder && (
              <WarningBadge>جمع سهم‌ها {formatPercent(shareSum)} است؛ {formatPercent(1 - shareSum)} از بودجه سرانه هنوز تخصیص نیافته</WarningBadge>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {CATEGORIES.map((category) => {
            const value = plan.categoryBudgetShare[category] ?? 0
            return (
              <div key={category} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-sm font-medium text-gray-700">{categoryLabels[category]}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={value}
                  onChange={(e) => setCategoryBudgetShare(category, Number(e.target.value))}
                  className="flex-1 accent-red-600"
                />
                <div className="flex w-28 items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(value * 100)}
                    onChange={(e) => setCategoryBudgetShare(category, Number(e.target.value) / 100)}
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-gray-500">٪</span>
                </div>
                <span className="w-32 shrink-0 text-xs text-gray-400">
                  {formatRial(plan.guestCount * plan.perPersonBudget * value)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          {showAdvanced ? '▲ بستن تنظیمات پیشرفته' : '▼ تنظیمات پیشرفته (ثابت‌های قابل‌ویرایش)'}
        </button>

        {showAdvanced && (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">وزن هر رده (برای تخصیص وزنی بودجه)</h4>
              <div className="grid grid-cols-3 gap-3">
                {TIERS.map((tier) => (
                  <Field key={tier} label={tier}>
                    <NumberInput
                      value={settings.tierWeights[tier]}
                      min={0}
                      step={0.1}
                      onChange={(v) => setTierWeight(tier, v)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">
                سهم پیش‌فرض تعداد پوشش هر رده از کل میهمانان (٪) — هنگام افزودن آیتم جدید پیشنهاد می‌شود
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {TIERS.map((tier) => (
                  <Field key={tier} label={tier}>
                    <NumberInput
                      value={Math.round(settings.defaultCoverageByTier[tier] * 100)}
                      min={0}
                      max={100}
                      onChange={(v) => setDefaultCoverageByTier(tier, v / 100)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">
                سقف هزینه هر پرس به تفکیک رده (مبنای هشدار کارشناس مالی)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {TIERS.map((tier) => (
                  <Field key={tier} label={tier}>
                    <FormattedNumberInput
                      value={settings.tierCostCeiling[tier]}
                      onChange={(v) => setTierCostCeiling(tier, v)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">
                استاندارد تغذیه‌ای «فرمول تقسیم سفره» (Harvard Healthy Eating Plate / USDA MyPlate)
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="کل گرم بشقاب هر میهمان">
                  <NumberInput
                    value={settings.nutritionTargets.totalGramsPerGuest}
                    min={0}
                    onChange={(v) => setNutritionTarget('totalGramsPerGuest', v)}
                  />
                </Field>
                <Field label="سهم کربوهیدرات (٪)">
                  <NumberInput
                    value={Math.round(settings.nutritionTargets.carbShare * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => setNutritionTarget('carbShare', v / 100)}
                  />
                </Field>
                <Field label="سهم پروتئین (٪)">
                  <NumberInput
                    value={Math.round(settings.nutritionTargets.proteinShare * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => setNutritionTarget('proteinShare', v / 100)}
                  />
                </Field>
                <Field label="سهم سبزیجات و میوه (٪)">
                  <NumberInput
                    value={Math.round(settings.nutritionTargets.vegShare * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => setNutritionTarget('vegShare', v / 100)}
                  />
                </Field>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                چربی سهم مستقلی از بشقاب ندارد و صرفاً اطلاعاتی نمایش داده می‌شود (بدون هدف یا رنگ هشدار).
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
