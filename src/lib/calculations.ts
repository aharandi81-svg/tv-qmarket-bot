import type { AppSettings, Category, Dish, EventPlan, Macro, MacroKey, SelectedItem } from '../types'

const MACRO_KEYS: MacroKey[] = ['carb', 'protein', 'veg', 'fat']
const DRINK_CATEGORY: Category = 'نوشیدنی'

export function zeroMacro(): Macro {
  return { carb: 0, protein: 0, veg: 0, fat: 0 }
}

export function categoryBudgetAmount(plan: EventPlan, category: Category): number {
  return plan.guestCount * plan.perPersonBudget * (plan.categoryBudgetShare[category] ?? 0)
}

export function tierWeight(item: SelectedItem, settings: AppSettings): number {
  return settings.tierWeights[item.tier]
}

/** مجموع وزن رده‌ای همه‌ی آیتم‌های یک دسته غذایی مشخص در سناریو. */
export function sumWeightsInCategory(
  items: SelectedItem[],
  dishesById: Map<string, Dish>,
  category: Category,
  settings: AppSettings,
): number {
  return items
    .filter((it) => dishesById.get(it.dishId)?.category === category)
    .reduce((sum, it) => sum + tierWeight(it, settings), 0)
}

export interface ItemCalc {
  itemId: string
  dishId: string
  dish: Dish | undefined
  weight: number
  budgetShare: number
  batchQuantity: number
  maxAffordableQty: number | null // null یعنی نامحدود/نامشخص (بدون قیمت)
  totalItemCost: number | null
  gramsPerGuestAvg: number
  gramsPerGuest: Macro
  overBudget: boolean
}

/**
 * محاسبه‌ی کامل یک ردیف انتخابی طبق فرمول‌های بخش ۴ مستند محصول.
 * weightSumInCategory باید از قبل برای همه‌ی آیتم‌های همان دسته محاسبه شده باشد.
 */
export function computeItemCalc(
  item: SelectedItem,
  dish: Dish | undefined,
  plan: EventPlan,
  settings: AppSettings,
  weightSumInCategory: number,
): ItemCalc {
  const weight = tierWeight(item, settings)
  const category = dish?.category
  const categoryBudget = category ? categoryBudgetAmount(plan, category) : 0
  const budgetShare = weightSumInCategory > 0 ? (weight / weightSumInCategory) * categoryBudget : 0

  const batchQuantity = Math.round(item.coverageCount * plan.confidenceFactor)

  const costPerServing = dish?.costPerServing ?? null
  const maxAffordableQty = costPerServing && costPerServing > 0 ? Math.floor(budgetShare / costPerServing) : null
  const totalItemCost = costPerServing != null ? costPerServing * batchQuantity : null

  const gramsPerGuestAvg = plan.guestCount > 0 ? (item.coverageCount / plan.guestCount) * item.portionSize : 0

  const gramsPerGuest = zeroMacro()
  if (dish) {
    for (const key of MACRO_KEYS) {
      gramsPerGuest[key] = gramsPerGuestAvg * (dish.macro[key] / 100)
    }
  }

  const overBudget = totalItemCost != null && totalItemCost > budgetShare

  return {
    itemId: item.itemId,
    dishId: item.dishId,
    dish,
    weight,
    budgetShare,
    batchQuantity,
    maxAffordableQty,
    totalItemCost,
    gramsPerGuestAvg,
    gramsPerGuest,
    overBudget,
  }
}

export function computeAllItemCalcs(plan: EventPlan, dishesById: Map<string, Dish>, settings: AppSettings): ItemCalc[] {
  const weightSums = new Map<Category, number>()
  for (const item of plan.selectedItems) {
    const category = dishesById.get(item.dishId)?.category
    if (!category || weightSums.has(category)) continue
    weightSums.set(category, sumWeightsInCategory(plan.selectedItems, dishesById, category, settings))
  }

  return plan.selectedItems.map((item) => {
    const dish = dishesById.get(item.dishId)
    const category = dish?.category
    const weightSum = category ? (weightSums.get(category) ?? 0) : 0
    return computeItemCalc(item, dish, plan, settings, weightSum)
  })
}

export interface MacroStatus {
  totalGrams: Macro
  targetGrams: Macro
  statusPercent: Macro
}

/** جمع‌بندی ترکیب تغذیه‌ای در سطح کل سفره؛ نوشیدنی‌ها طبق مستند محصول در جمع لحاظ نمی‌شوند. */
export function computeMacroStatus(itemCalcs: ItemCalc[], settings: AppSettings): MacroStatus {
  const totalGrams = zeroMacro()
  for (const calc of itemCalcs) {
    if (calc.dish?.category === DRINK_CATEGORY) continue
    for (const key of MACRO_KEYS) {
      totalGrams[key] += calc.gramsPerGuest[key]
    }
  }

  const { totalGramsPerGuest, carbShare, proteinShare, vegShare } = settings.nutritionTargets
  const targetGrams: Macro = {
    carb: totalGramsPerGuest * carbShare,
    protein: totalGramsPerGuest * proteinShare,
    veg: totalGramsPerGuest * vegShare,
    // چربی سهم مستقل بشقاب ندارد؛ صرفاً برای نمایش اطلاعاتی نگه داشته می‌شود (بدون هدف/رنگ هشدار).
    fat: 0,
  }

  const statusPercent = zeroMacro()
  for (const key of MACRO_KEYS) {
    statusPercent[key] = targetGrams[key] > 0 ? totalGrams[key] / targetGrams[key] : 0
  }

  return { totalGrams, targetGrams, statusPercent }
}

export interface PlanSummary {
  itemCalcs: ItemCalc[]
  totalCost: number
  totalBudget: number
  hasMissingPrices: boolean
  macro: MacroStatus
}

export function computePlanSummary(plan: EventPlan, dishesById: Map<string, Dish>, settings: AppSettings): PlanSummary {
  const itemCalcs = computeAllItemCalcs(plan, dishesById, settings)
  const totalCost = itemCalcs.reduce((sum, c) => sum + (c.totalItemCost ?? 0), 0)
  const totalBudget = plan.guestCount * plan.perPersonBudget
  const hasMissingPrices = itemCalcs.some((c) => c.totalItemCost == null)
  const macro = computeMacroStatus(itemCalcs, settings)
  return { itemCalcs, totalCost, totalBudget, hasMissingPrices, macro }
}

export interface CookingMethodCount {
  method: string
  count: number
  dishNames: string[]
}

/** شاخص پیچیدگی آشپزخانه: تعداد غذای اصلی به تفکیک روش پخت. */
export function computeCookingComplexity(plan: EventPlan, dishesById: Map<string, Dish>): CookingMethodCount[] {
  const counts = new Map<string, string[]>()
  for (const item of plan.selectedItems) {
    const dish = dishesById.get(item.dishId)
    if (!dish || dish.category !== 'غذای اصلی' || !item.cookingMethod) continue
    const list = counts.get(item.cookingMethod) ?? []
    list.push(dish.name)
    counts.set(item.cookingMethod, list)
  }
  return Array.from(counts.entries())
    .map(([method, dishNames]) => ({ method, count: dishNames.length, dishNames }))
    .sort((a, b) => b.count - a.count)
}
