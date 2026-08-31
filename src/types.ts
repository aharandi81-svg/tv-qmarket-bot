export const CATEGORIES = ['غذای اصلی', 'پیش‌غذا', 'دسر', 'نوشیدنی'] as const
export type Category = (typeof CATEGORIES)[number]

export const TIERS = ['شاخص', 'استاندارد', 'اقتصادی'] as const
export type Tier = (typeof TIERS)[number]

export const COOKING_METHODS = [
  'گریل',
  'کبابی',
  'سرخ‌کردنی',
  'آب‌پز/بخارپز',
  'خورشتی/آرام‌پز',
  'فر',
  'سرد/بدون پخت',
] as const
export type CookingMethod = (typeof COOKING_METHODS)[number]

export const MEAL_TYPES = ['صبحانه', 'ناهار', 'شام', 'صبحانه و ناهار', 'ناهار و شام', 'صبحانه، ناهار و شام'] as const
export type MealType = (typeof MEAL_TYPES)[number]

/** آیا این نوع وعده شامل صبحانه/ناهار-شام می‌شود — مبنای فیلتر مرتبط‌بودن غذا در صفحه انتخاب غذا. */
export function mealTypeIncludesBreakfast(mealType: MealType): boolean {
  return mealType === 'صبحانه' || mealType === 'صبحانه و ناهار' || mealType === 'صبحانه، ناهار و شام'
}
export function mealTypeIncludesLunchOrDinner(mealType: MealType): boolean {
  return mealType !== 'صبحانه'
}

// برچسب رژیمی به‌صورت خودکار و صرفاً از روی کلیدواژه‌ی مواد اولیه تشخیص داده می‌شود؛
// هرگز به‌عنوان تضمین ایمنی/مذهبی برای مهمانان استفاده نشود — نگاه کنید به dietaryTagsVerified.
export const DIETARY_TAGS = ['گیاهی', 'وگان'] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

// ریسک هدررفت اگر بیشتر از نیاز واقعی پخته/آماده شود: «فسادپذیر» یعنی پرس اضافه معمولاً باید
// دور ریخته شود (غذای گرم بوفه)، «قابل‌نگهداری» یعنی پرس اضافه قابل فریز/بسته‌بندی/استفاده در
// رویداد بعد است (نوشیدنی بطری‌شده، دسر بسته‌بندی). مبنای تعیین ضریب اطمینان جداگانه هر غذا.
export const WASTE_RISK_LEVELS = ['فسادپذیر', 'قابل‌نگهداری'] as const
export type WasteRisk = (typeof WASTE_RISK_LEVELS)[number]

export interface Macro {
  carb: number
  protein: number
  veg: number
  fat: number
}

export interface Ingredient {
  name: string
  quantity: number
  unit: string
}

export interface Dish {
  id: string
  name: string
  category: Category
  macro: Macro
  costPerServing: number | null
  costSource: string
  priceVarianceFlag: boolean
  needsPrice: boolean
  eventsUsedIn: string[]
  ingredients?: Ingredient[] | null
  /** وزن هر پرس (گرم)، برآوردشده از کارت رسپی یا پیش‌فرض دسته — نگاه کنید به needsPortionEstimate. */
  referencePortionGrams: number
  portionSource: string
  needsPortionEstimate: boolean
  /** تشخیص خودکار و تأییدنشده از روی نام/مواد اولیه — همیشه با dietaryTagsVerified نمایش داده شود. */
  dietaryTags: DietaryTag[]
  dietaryTagsVerified: boolean
  /** تشخیص خودکار از روی نام غذا — آیا این غذا برای وعده صبحانه مناسب است (نان و پنیر، املت، پنکیک و ...). */
  isBreakfastItem: boolean
  /** تشخیص خودکار از روی دسته/نام — نگاه کنید به تعریف WasteRisk. مبنای ضریب اطمینان این غذا. */
  wasteRisk: WasteRisk
  wasteRiskVerified: boolean
  /** میانگین سهم پوششی که در رویدادهای گذشته واقعاً درست از آب درآمده (از «ثبت مصرف واقعی» بعد
   * از رویداد) — وقتی موجود باشد به‌جای پیش‌فرض کلی رده، به‌عنوان پیش‌فرض سهم پوشش این غذا در
   * رویدادهای بعدی استفاده می‌شود. null یعنی هنوز هیچ داده‌ی واقعی ثبت نشده. */
  observedCoveragePercent: number | null
  observedEventsRecorded: number
}

export interface SelectedItem {
  itemId: string
  dishId: string
  tier: Tier
  portionSize: number
  cookingMethod?: CookingMethod
}

export type CategoryBudgetShare = Record<Category, number>

export interface EventPlan {
  guestCount: number
  perPersonBudget: number
  /** ضریب اطمینان دستیِ اضافه‌ی این رویداد — روی ضریب پایه‌ی هر غذا (که بر اساس ریسک هدررفت آن
   * در تنظیمات مشخص می‌شود) ضرب می‌شود. پیش‌فرض ۱ (بدون تغییر) — فقط برای رویدادهایی که برنامه‌ریز
   * دلیل خاصی برای احتیاط بیشتر/کمتر کلی دارد (مثلاً رویداد فضای باز با پیش‌بینی نامطمئن). */
  confidenceFactor: number
  /** درصد مهمانان دعوت‌شده که واقعاً حضور می‌یابند — برای پیشنهاد پیش‌فرض واقع‌بینانه‌تر تعداد پوشش. */
  expectedAttendanceRate: number
  mealType: MealType
  categoryBudgetShare: CategoryBudgetShare
  selectedItems: SelectedItem[]
}

export interface NutritionTargets {
  totalGramsPerGuest: number
  carbShare: number
  proteinShare: number
  vegShare: number
}

export interface AppSettings {
  tierWeights: Record<Tier, number>
  defaultCoverageByTier: Record<Tier, number>
  /** سقف هزینه هر پرس به تفکیک رده، به‌صورت سهمی از بودجه سرانه (نه عدد ثابت ریالی) — با هر بودجه‌ای مقیاس می‌شود. */
  tierCostCeilingShare: Record<Tier, number>
  /** ضریب اطمینان پایه به تفکیک ریسک هدررفت غذا — به‌جای یک عدد ثابت برای همه؛ غذای فسادپذیر
   * حاشیه‌ی امنیت کمتری می‌گیرد (پرس اضافه‌اش هدر می‌رود)، غذای قابل‌نگهداری حاشیه‌ی بیشتری
   * می‌تواند بگیرد (کمبودش گران‌تر از اضافه‌اش است). */
  confidenceFactorByWasteRisk: Record<WasteRisk, number>
  nutritionTargets: NutritionTargets
  /** ظرفیت هر ایستگاه پخت: حداکثر تعداد غذای هم‌زمان با آن روش پیش از هشدار — هر روش پخت ظرفیت واقعی متفاوتی دارد. */
  cookingMethodCapacity: Record<CookingMethod, number>
}

export type MacroKey = keyof Macro
