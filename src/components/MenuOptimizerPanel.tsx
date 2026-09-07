import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { generateMenuProposals } from '../lib/menuOptimizer'
import { Button, Card, ConfirmButton, WarningBadge } from './ui'
import { MENU_STRATEGY_LABELS, PROTEIN_SOURCE_LABELS, PROTEIN_SOURCES } from '../types'
import type { MenuProposal } from '../types'
import { formatNumber, formatRial } from '../lib/format'

const COMPARE_ROWS: { key: keyof MenuProposal | 'costPerGuest'; label: string; format: (p: MenuProposal) => string }[] = [
  { key: 'menuOptimizationScore', label: 'امتیاز کلی بهینه‌سازی منو', format: (p) => `${Math.round(p.menuOptimizationScore)} / ۱۰۰` },
  { key: 'proteinFitScore', label: 'تناسب پروتئین با هدف', format: (p) => `${Math.round(p.proteinFitScore)} / ۱۰۰` },
  { key: 'macroFitScore', label: 'هم‌راستایی ماکرو', format: (p) => `${Math.round(p.macroFitScore)} / ۱۰۰` },
  { key: 'proteinDiversityScore', label: 'تنوع منابع پروتئین', format: (p) => `${Math.round(p.proteinDiversityScore)} / ۱۰۰` },
  { key: 'menuVarietyScore', label: 'تنوع کلی منو', format: (p) => `${Math.round(p.menuVarietyScore)} / ۱۰۰` },
  { key: 'kitchenFeasibilityScore', label: 'امکان‌سنجی آشپزخانه', format: (p) => `${Math.round(p.kitchenFeasibilityScore)} / ۱۰۰` },
  { key: 'costScore', label: 'امتیاز هزینه', format: (p) => `${Math.round(p.costScore)} / ۱۰۰` },
  { key: 'avgDishScore', label: 'میانگین Dish Score', format: (p) => `${Math.round(p.avgDishScore)} / ۱۰۰` },
  { key: 'costPerGuest', label: 'هزینه هر مهمان', format: (p) => formatRial(p.costPerGuest) },
  { key: 'totalCost', label: 'هزینه کل', format: (p) => formatRial(p.totalCost) },
  { key: 'totalProteinGrams', label: 'مجموع پروتئین (گرم)', format: (p) => formatNumber(Math.round(p.totalProteinGrams)) },
]

export function MenuOptimizerPanel() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const dishes = useAppStore((s) => s.dishes)
  const applyMenuProposal = useAppStore((s) => s.applyMenuProposal)

  const [result, setResult] = useState<{ proposals: MenuProposal[]; warnings: string[] } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<string | null>(null)

  const proteinTarget = plan.guestCount * settings.menuOptimizer.proteinTargetGramsPerGuest

  const compareProposals = useMemo(
    () => (result?.proposals ?? []).filter((p) => compareIds.has(p.id)),
    [result, compareIds],
  )

  function handleGenerate() {
    const r = generateMenuProposals(dishes, plan, settings)
    setResult(r)
    setExpandedId(null)
    setCompareIds(new Set())
    setApplied(null)
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <span aria-hidden>🧠</span>
          <span>بهینه‌ساز هوشمند منو (AI Menu Optimizer)</span>
        </div>
      }
      className="bg-gradient-to-br from-amber-50/40 to-white"
    >
      <p className="mb-4 text-sm text-slate-600">
        بر اساس تعداد میهمانان ({formatNumber(plan.guestCount)} نفر)، بودجه سرانه ({formatRial(plan.perPersonBudget)})، پروفایل هدف
        فعال («{settings.menuOptimizer.targetMenuProfiles[settings.menuOptimizer.activeTargetProfileId].label}») و هدف پروتئین کل
        رویداد ({formatNumber(Math.round(proteinTarget))} گرم = {formatNumber(plan.guestCount)} × {settings.menuOptimizer.proteinTargetGramsPerGuest} گرم)،
        چند ترکیب منوی متفاوت و قابل‌اجرا از دیتابیس واقعی غذا پیشنهاد می‌شود. برای تغییر این پارامترها به «تنظیمات
        رویداد» بروید؛ برای الزامی/ممنوع‌کردن یک غذای خاص، از دیتابیس غذا استفاده کنید.
      </p>

      <Button variant="primary" onClick={handleGenerate}>
        تولید منوهای بهینه
      </Button>

      {result && result.warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <WarningBadge key={i}>{w}</WarningBadge>
          ))}
        </div>
      )}

      {result && result.proposals.length === 0 && (
        <p className="mt-4 text-sm text-red-600">
          با تنظیمات و محدودیت‌های فعلی هیچ ترکیب معتبری پیدا نشد — محدودیت‌های سخت (سقف پروتئین، بودجه، حداقل/حداکثر
          هر دسته) را در «تنظیمات رویداد» بازبینی کنید یا محدودیت‌های Must Include/Exclude را در دیتابیس غذا کم کنید.
        </p>
      )}

      {result && result.proposals.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {result.proposals.map((p, idx) => {
            const expanded = expandedId === p.id
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-amber-700">پیشنهاد {idx + 1} — {MENU_STRATEGY_LABELS[p.strategyId]}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{Math.round(p.menuOptimizationScore)}<span className="text-sm font-normal text-slate-400"> / ۱۰۰</span></p>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" checked={compareIds.has(p.id)} onChange={() => toggleCompare(p.id)} />
                    مقایسه
                  </label>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><dt>هزینه هر مهمان</dt><dd className="font-medium text-slate-800">{formatRial(p.costPerGuest)}</dd></div>
                  <div className="flex justify-between"><dt>مجموع پروتئین</dt><dd className="font-medium text-slate-800">{formatNumber(Math.round(p.totalProteinGrams))} گرم</dd></div>
                  <div className="flex justify-between"><dt>تناسب پروتئین</dt><dd>{Math.round(p.proteinFitScore)}٪</dd></div>
                  <div className="flex justify-between"><dt>تنوع منو</dt><dd>{Math.round(p.menuVarietyScore)}٪</dd></div>
                </dl>

                {p.warnings.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {p.warnings.map((w, i) => (
                      <WarningBadge key={i}>{w}</WarningBadge>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {expanded ? 'بستن جزئیات' : 'مشاهده جزئیات'}
                  </button>
                  <ConfirmButton
                    label="اعمال این منو"
                    confirmMessage="ردیف‌های انتخاب‌شده‌ی فعلی صفحه «انتخاب غذا» با این پیشنهاد جایگزین می‌شود."
                    confirmLabel="بله، اعمال کن"
                    onConfirm={() => {
                      applyMenuProposal(p)
                      setApplied(p.id)
                    }}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  />
                  {applied === p.id && <span className="text-xs font-medium text-emerald-600">اعمال شد ✓</span>}
                </div>

                {expanded && (
                  <div className="mt-3 overflow-x-auto border-t border-slate-100 pt-3">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="text-start text-slate-400">
                          <th className="px-1 py-1 text-start">غذا</th>
                          <th className="px-1 py-1 text-start">دسته</th>
                          <th className="px-1 py-1 text-start">منبع پروتئین</th>
                          <th className="px-1 py-1 text-start">پروتئین هر پرس (گرم)</th>
                          <th className="px-1 py-1 text-start">تعداد پرس</th>
                          <th className="px-1 py-1 text-start">هزینه هر پرس</th>
                          <th className="px-1 py-1 text-start">هزینه کل قلم</th>
                          <th className="px-1 py-1 text-start">Dish Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.dishes.map((d) => (
                          <tr key={d.dishId} className="border-t border-slate-100">
                            <td className="px-1 py-1 font-medium text-slate-700">
                              {d.dishName}
                              {d.needsNutritionReview && (
                                <span className="ms-1 text-amber-600" title="فاقد کارت رسپی — مقدار تغذیه‌ای برآوردی">⚠️</span>
                              )}
                            </td>
                            <td className="px-1 py-1">{d.category}</td>
                            <td className="px-1 py-1">{PROTEIN_SOURCE_LABELS[d.proteinSource]}</td>
                            <td className="px-1 py-1">{Math.round(d.proteinGrams)}</td>
                            <td className="px-1 py-1">{formatNumber(d.servingCount)}</td>
                            <td className="px-1 py-1 whitespace-nowrap">{formatRial(d.costPerServing)}</td>
                            <td className="px-1 py-1 whitespace-nowrap">{formatRial(d.totalCost)}</td>
                            <td className="px-1 py-1">{Math.round(d.dishScore)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      {PROTEIN_SOURCES.map((src) => (
                        <span key={src}>
                          {PROTEIN_SOURCE_LABELS[src]}: {Math.round(p.proteinSourceBreakdownPercent[src])}٪
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {compareProposals.length >= 2 && (
        <div className="mt-6 overflow-x-auto">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">مقایسه پیشنهادهای انتخاب‌شده</h4>
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                <th className="px-2 py-2 text-start">معیار</th>
                {compareProposals.map((p) => (
                  <th key={p.id} className="px-2 py-2 text-start">{MENU_STRATEGY_LABELS[p.strategyId]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-slate-500">{row.label}</td>
                  {compareProposals.map((p) => (
                    <td key={p.id} className="px-2 py-2 font-medium text-slate-800">{row.format(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
