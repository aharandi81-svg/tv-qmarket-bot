import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Button, Card, ErrorBadge, StatTile, WarningBadge } from '../components/ui'
import { CoreParamsModal, CategoryBudgetModal, OptimizerSettingsModal, AdvancedConstantsModal } from '../components/EventSettingsModals'
import { BUDGET_OVERRUN_BEHAVIOR_LABELS, CATEGORIES } from '../types'
import { formatPercent, formatRial } from '../lib/format'
import type { ReactNode } from 'react'

type ModalKind = 'core' | 'budget' | 'optimizer' | 'advanced' | null

function SettingsCard({ title, description, onEdit, children }: { title: string; description?: string; onEdit: () => void; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
            <span aria-hidden className="h-5 w-1.5 rounded-full bg-amber-500" />
            {title}
          </h3>
          {description && <p className="mt-1.5 ps-4 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
          ✎ ویرایش
        </Button>
      </div>
      {children}
    </Card>
  )
}

export function EventSettingsPage() {
  const plan = useAppStore((s) => s.plan)
  const settings = useAppStore((s) => s.settings)
  const [openModal, setOpenModal] = useState<ModalKind>(null)
  const opt = settings.menuOptimizer

  const totalBudget = plan.guestCount * plan.perPersonBudget
  const shareSum = CATEGORIES.reduce((sum, c) => sum + (plan.categoryBudgetShare[c] ?? 0), 0)
  const shareOver = shareSum - 1 > 0.001
  const shareUnder = 1 - shareSum > 0.001
  const activeProfile = opt.targetMenuProfiles[opt.activeTargetProfileId]

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="پارامترهای اصلی رویداد" onEdit={() => setOpenModal('core')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="تعداد میهمانان" value={plan.guestCount.toLocaleString('en-US')} />
          <StatTile label="بودجه سرانه" value={formatRial(plan.perPersonBudget)} />
          <StatTile label="بودجه کل رویداد" value={formatRial(totalBudget)} tone="amber" />
          <StatTile label="نرخ حضور مورد انتظار" value={`${Math.round(plan.expectedAttendanceRate * 100)}٪`} />
          <StatTile label="ضریب اطمینان دستی" value={plan.confidenceFactor.toLocaleString('en-US')} />
          <StatTile label="نوع وعده" value={plan.mealType} />
        </div>
      </SettingsCard>

      <SettingsCard title="سهم بودجه هر دسته از سرانه" onEdit={() => setOpenModal('budget')}>
        {shareOver && (
          <div className="mb-3">
            <ErrorBadge>
              جمع سهم‌ها {formatPercent(shareSum)} شده — یک یا چند دسته دیگر را کم کنید یا بودجه سرانه را افزایش دهید
            </ErrorBadge>
          </div>
        )}
        {shareUnder && (
          <div className="mb-3">
            <WarningBadge>جمع سهم‌ها {formatPercent(shareSum)} است؛ {formatPercent(1 - shareSum)} از بودجه سرانه هنوز تخصیص نیافته</WarningBadge>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {CATEGORIES.map((category) => {
            const value = plan.categoryBudgetShare[category] ?? 0
            const perGuestAmount = plan.perPersonBudget * value
            return (
              <div key={category} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{category}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
                </div>
                <span className="w-12 shrink-0 text-end text-sm font-bold text-slate-800 dark:text-slate-200">{Math.round(value * 100)}٪</span>
                <span className="w-28 shrink-0 text-end text-xs text-slate-400 dark:text-slate-500">{formatRial(perGuestAmount)} / نفر</span>
              </div>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title="تنظیمات Menu Optimization Engine"
        description="هدف‌گذاری ماکرو، پروفایل‌های پروتئین/چربی/کربوهیدرات، توزیع منابع پروتئین، رفتار بودجه و وزن‌های امتیازدهی."
        onEdit={() => setOpenModal('optimizer')}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="پروفایل هدف فعال"
            value={activeProfile.label}
            hint={`پروتئین ${activeProfile.proteinSharePercent}٪ · چربی ${activeProfile.fatSharePercent}٪ · کربوهیدرات ${activeProfile.carbSharePercent}٪`}
          />
          <StatTile label="هدف پروتئین هر مهمان" value={`${opt.proteinTargetGramsPerGuest} گرم`} />
          <StatTile label="تعداد پیشنهاد منو" value={opt.numberOfProposals} />
          <StatTile label="رفتار عبور از بودجه" value={BUDGET_OVERRUN_BEHAVIOR_LABELS[opt.budgetOverrunBehavior]} />
        </div>
      </SettingsCard>

      <SettingsCard
        title="تنظیمات پیشرفته (ثابت‌های قابل‌ویرایش)"
        description="وزن رده‌ها، وزن پایه‌ی تقاضا، سقف هزینه به تفکیک رده، ضریب اطمینان بر اساس ریسک هدررفت، ظرفیت ایستگاه‌های پخت و استاندارد تغذیه‌ای «فرمول تقسیم سفره»."
        onEdit={() => setOpenModal('advanced')}
      >
        <p className="text-sm text-slate-400 dark:text-slate-500">این ثابت‌ها به‌ندرت نیاز به تغییر دارند — پیش‌فرض‌ها برای اغلب رویدادها مناسب‌اند.</p>
      </SettingsCard>

      {openModal === 'core' && <CoreParamsModal onClose={() => setOpenModal(null)} />}
      {openModal === 'budget' && <CategoryBudgetModal onClose={() => setOpenModal(null)} />}
      {openModal === 'optimizer' && <OptimizerSettingsModal onClose={() => setOpenModal(null)} />}
      {openModal === 'advanced' && <AdvancedConstantsModal onClose={() => setOpenModal(null)} />}
    </div>
  )
}
