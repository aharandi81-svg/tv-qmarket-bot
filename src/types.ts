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

export const MEAL_TYPES = [
  'فقط شام',
  'فقط ناهار',
  'ناهار و شام',
  'صبحانه',
  'میان‌وعده/کافه‌بریک',
  'بوفه کامل روز',
] as const
export type MealType = (typeof MEAL_TYPES)[number]

// برچسب رژیمی به‌صورت خودکار و صرفاً از روی کلیدواژه‌ی مواد اولیه تشخیص داده می‌شود؛
// هرگز به‌عنوان تضمین ایمنی/مذهبی برای مهمانان استفاده نشود — نگاه کنید به dietaryTagsVerified.
export const DIETARY_TAGS = ['گیاهی', 'وگان'] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

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
}

export interface SelectedItem {
  itemId: string
  dishId: string
  tier: Tier
  coverageCount: number
  portionSize: number
  cookingMethod?: CookingMethod
}

export type CategoryBudgetShare = Record<Category, number>

export interface EventPlan {
  guestCount: number
  perPersonBudget: number
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
  confidenceFactorDefault: number
  nutritionTargets: NutritionTargets
  /** ظرفیت هر ایستگاه پخت: حداکثر تعداد غذای هم‌زمان با آن روش پیش از هشدار — هر روش پخت ظرفیت واقعی متفاوتی دارد. */
  cookingMethodCapacity: Record<CookingMethod, number>
}

export type MacroKey = keyof Macro
