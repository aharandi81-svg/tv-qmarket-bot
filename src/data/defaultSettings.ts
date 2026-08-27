import type { AppSettings, CategoryBudgetShare, EventPlan } from '../types'

// اعداد این فایل صرفاً مقادیر پیش‌فرض اولیه هستند و همگی از صفحه تنظیمات قابل ویرایش‌اند؛
// هیچ‌کدام در منطق محاسباتی هاردکد نشده‌اند (نگاه کنید به lib/calculations.ts).
export const defaultSettings: AppSettings = {
  tierWeights: {
    'شاخص': 1.5,
    'استاندارد': 1.0,
    'اقتصادی': 0.6,
  },
  // سهم پیش‌فرض تعداد پوشش هر رده از کل میهمانان — قابل بازنویسی دستی برای هر آیتم
  defaultCoverageByTier: {
    'شاخص': 0.4,
    'استاندارد': 0.7,
    'اقتصادی': 1.0,
  },
  // سقف هزینه هر پرس به تفکیک رده (ریال) — مبنای هشدار «کارشناس مالی» در پنل توصیه‌ها؛ کاملاً قابل ویرایش.
  tierCostCeiling: {
    'شاخص': 3_500_000,
    'استاندارد': 2_000_000,
    'اقتصادی': 1_000_000,
  },
  confidenceFactorDefault: 1.1,
  // استاندارد «فرمول تقسیم سفره»: Harvard Healthy Eating Plate / USDA MyPlate / AMDR
  // برای بشقاب ۵۲۰ گرمی: ۲۵٪ غلات، ۲۵٪ پروتئین، ۵۰٪ سبزیجات و میوه؛ چربی سهم مستقل ندارد.
  nutritionTargets: {
    totalGramsPerGuest: 520,
    carbShare: 0.25,
    proteinShare: 0.25,
    vegShare: 0.5,
  },
}

export const defaultCategoryBudgetShare: CategoryBudgetShare = {
  'غذای اصلی': 0.58,
  'پیش‌غذا': 0.15,
  'دسر': 0.1,
  'نوشیدنی': 0.17,
}

export const defaultEventPlan: EventPlan = {
  guestCount: 180,
  perPersonBudget: 30_000_000,
  confidenceFactor: defaultSettings.confidenceFactorDefault,
  mealType: 'فقط شام',
  categoryBudgetShare: defaultCategoryBudgetShare,
  selectedItems: [],
}
