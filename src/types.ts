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
  mealType: string
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
  /** سقف هزینه هر پرس (ریال) به تفکیک رده — مبنای هشدار کارشناس مالی. */
  tierCostCeiling: Record<Tier, number>
  confidenceFactorDefault: number
  nutritionTargets: NutritionTargets
}

export type MacroKey = keyof Macro
