import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Card, ErrorBadge, Field, FormattedNumberInput, NumberInput, Select, WarningBadge } from '../components/ui'
import { CATEGORIES, COOKING_METHODS, MEAL_TYPES, TIERS, WASTE_RISK_LEVELS } from '../types'
import { formatPercent, formatRial } from '../lib/format'

export function EventSettingsPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const setPlanField = useAppStore((s) => s.setPlanField)
  const setCategoryBudgetShare = useAppStore((s) => s.setCategoryBudgetShare)
  const setTierWeight = useAppStore((s) => s.setTierWeight)
  const setDefaultCoverageByTier = useAppStore((s) => s.setDefaultCoverageByTier)
  const setTierCostCeilingShare = useAppStore((s) => s.setTierCostCeilingShare)
  const setNutritionTarget = useAppStore((s) => s.setNutritionTarget)
  const setCookingMethodCapacity = useAppStore((s) => s.setCookingMethodCapacity)
  const setConfidenceFactorByWasteRisk = useAppStore((s) => s.setConfidenceFactorByWasteRisk)
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
          <Field
            label="ضریب اطمینان دستی رویداد"
            hint="ضریب اضافه روی ضریب پایه‌ی هر غذا (بر اساس ریسک هدررفت آن، در تنظیمات پیشرفته) — پیش‌فرض ۱"
          >
            <NumberInput value={plan.confidenceFactor} min={1} step={0.05} onChange={(v) => setPlanField('confidenceFactor', v)} />
          </Field>
          <Field label="نرخ حضور مورد انتظار (٪)" hint="جدا از ضریب اطمینان — درصد دعوت‌شدگانی که واقعاً می‌آیند">
            <NumberInput
              value={Math.round(plan.expectedAttendanceRate * 100)}
              min={0}
              max={100}
              onChange={(v) => setPlanField('expectedAttendanceRate', v / 100)}
            />
          </Field>
          <Field label="نوع وعده">
            <Select value={plan.mealType} onChange={(v) => setPlanField('mealType', v)} options={MEAL_TYPES} />
          </Field>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          بودجه کل رویداد: <span className="font-semibold text-slate-800">{formatRial(totalBudget)}</span>
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
                <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{category}</span>
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
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-slate-500">٪</span>
                </div>
                <span className="w-32 shrink-0 text-xs text-slate-400">
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
          className="text-sm font-medium text-amber-700 hover:underline"
        >
          {showAdvanced ? '▲ بستن تنظیمات پیشرفته' : '▼ تنظیمات پیشرفته (ثابت‌های قابل‌ویرایش)'}
        </button>

        {showAdvanced && (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">وزن هر رده (برای تخصیص وزنی بودجه)</h4>
              <p className="mb-2 text-xs text-slate-400">
                توجه: رده فقط نحوه‌ی تقسیم بودجه‌ی یک دسته بین آیتم‌های آن دسته را مشخص می‌کند — کیفیت خودِ غذا از
                دیتابیس غذا می‌آید و با تغییر رده عوض نمی‌شود. رده «شاخص» یعنی «بودجه بیشتری به این آیتم اختصاص بده»،
                نه «این غذا را با کیفیت بالاتری بپز».
              </p>
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
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
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
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                سقف هزینه هر پرس به تفکیک رده — به‌صورت سهمی از بودجه سرانه (مبنای هشدار کارشناس مالی)
              </h4>
              <p className="mb-2 text-xs text-slate-400">
                چون این سقف نسبت به بودجه سرانه محاسبه می‌شود، با تغییر بودجه رویداد هم خودش را تنظیم می‌کند.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {TIERS.map((tier) => (
                  <Field
                    key={tier}
                    label={tier}
                    hint={formatRial(plan.perPersonBudget * settings.tierCostCeilingShare[tier])}
                  >
                    <NumberInput
                      value={Math.round(settings.tierCostCeilingShare[tier] * 1000) / 10}
                      min={0}
                      max={100}
                      step={0.5}
                      onChange={(v) => setTierCostCeilingShare(tier, v / 100)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                ضریب اطمینان پایه به تفکیک ریسک هدررفت (مبنای «تعداد پخت» — نگاه کنید به توضیح فرمول در صفحه انتخاب غذا)
              </h4>
              <p className="mb-2 text-xs text-slate-400">
                غذای فسادپذیر باید ضریب پایین‌تری بگیرد چون پرس اضافه‌اش هدر می‌رود؛ غذای قابل‌نگهداری می‌تواند ضریب
                بالاتری بگیرد چون کمبودش گران‌تر از اضافه‌اش تمام می‌شود. ریسک هدررفت هر غذا در دیتابیس غذا قابل ویرایش
                است.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {WASTE_RISK_LEVELS.map((risk) => (
                  <Field key={risk} label={risk}>
                    <NumberInput
                      value={settings.confidenceFactorByWasteRisk[risk]}
                      min={1}
                      step={0.05}
                      onChange={(v) => setConfidenceFactorByWasteRisk(risk, v)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                ظرفیت هر ایستگاه پخت (حداکثر غذای هم‌زمان پیش از هشدار آشپز خبره)
              </h4>
              <p className="mb-2 text-xs text-slate-400">
                ظرفیت واقعی هر روش پخت متفاوت است (مثلاً فر چند سینی را هم‌زمان می‌پزد ولی ایستگاه گریل محدودتر است).
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {COOKING_METHODS.map((method) => (
                  <Field key={method} label={method}>
                    <NumberInput
                      value={settings.cookingMethodCapacity[method]}
                      min={1}
                      onChange={(v) => setCookingMethodCapacity(method, v)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
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
              <p className="mt-2 text-xs text-slate-400">
                چربی سهم مستقلی از بشقاب ندارد و صرفاً اطلاعاتی نمایش داده می‌شود (بدون هدف یا رنگ هشدار).
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
