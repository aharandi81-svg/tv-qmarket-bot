import type { AppSettings, Dish, EventPlan } from '../types'
import { computeAllItemCalcs, computeCookingComplexity, tierCostCeilingAmount } from './calculations'
import { formatRial } from './format'

export interface Recommendation {
  id: string
  text: string
  severity: 'info' | 'warning'
}

/** برنامه‌ریز رویداد: پیشنهاد تعداد خط بوفه و نیروی سرو، به تفکیک نوع ایستگاه. */
export function eventPlannerRecommendations(plan: EventPlan, dishesById: Map<string, Dish>): Recommendation[] {
  if (plan.selectedItems.length === 0) {
    return [{ id: 'no-items', text: 'هنوز هیچ آیتمی به سناریو اضافه نشده است.', severity: 'info' }]
  }

  const countByCategory = { 'غذای اصلی': 0, 'پیش‌غذا': 0, 'دسر': 0, 'نوشیدنی': 0 }
  for (const item of plan.selectedItems) {
    const category = dishesById.get(item.dishId)?.category
    if (category) countByCategory[category] += 1
  }
  const mainLineItems = countByCategory['غذای اصلی'] + countByCategory['پیش‌غذا']

  const recs: Recommendation[] = []

  // فرض کاری: هر خط بوفه اصلی پاسخگوی حداکثر ۸۰ میهمان و حداکثر ۶ آیتم هم‌زمان (اصلی+پیش‌غذا) است.
  if (mainLineItems > 0) {
    const linesByGuests = Math.ceil(plan.guestCount / 80)
    const linesByItems = Math.ceil(mainLineItems / 6)
    const lines = Math.max(1, linesByGuests, linesByItems)
    recs.push({
      id: 'main-lines',
      text: `برای ${plan.mealType} با ${plan.guestCount} میهمان، پیشنهاد ${lines} خط بوفه اصلی (غذای اصلی + پیش‌غذا) — بر اساس فرض ۱ خط به ازای هر ۸۰ میهمان و حداکثر ۶ آیتم هم‌زمان روی هر خط.`,
      severity: 'info',
    })
  }

  // میز دسر و ایستگاه نوشیدنی در رویدادهای واقعی معمولاً از خط اصلی بوفه جدا هستند.
  if (countByCategory['دسر'] > 0) {
    const dessertTables = Math.max(1, Math.ceil(plan.guestCount / 120))
    recs.push({
      id: 'dessert-table',
      text: `پیشنهاد ${dessertTables} میز دسر جداگانه از خط اصلی بوفه (بر اساس فرض ۱ میز به ازای هر ۱۲۰ میهمان).`,
      severity: 'info',
    })
  }
  if (countByCategory['نوشیدنی'] > 0) {
    const drinkStations = Math.max(1, Math.ceil(plan.guestCount / 100))
    recs.push({
      id: 'drink-station',
      text: `پیشنهاد ${drinkStations} ایستگاه نوشیدنی جداگانه (بر اساس فرض ۱ ایستگاه به ازای هر ۱۰۰ میهمان).`,
      severity: 'info',
    })
  }

  // فرض کاری: هر ۲۵ میهمان به یک نیروی سرو نیاز دارد.
  const staff = Math.max(2, Math.ceil(plan.guestCount / 25))
  recs.push({
    id: 'staff',
    text: `پیشنهاد حداقل ${staff} نیروی سرو (بر اساس فرض ۱ نیرو به ازای هر ۲۵ میهمان).`,
    severity: 'info',
  })

  return recs
}

/** آشپز خبره: فشار روی ایستگاه‌های پخت (با ظرفیت واقعی هر روش) و مواد پایه مشترک. */
export function chefRecommendations(plan: EventPlan, dishesById: Map<string, Dish>, settings: AppSettings): Recommendation[] {
  const recs: Recommendation[] = []
  const complexity = computeCookingComplexity(plan, dishesById, settings)

  for (const row of complexity) {
    if (row.overCapacity) {
      recs.push({
        id: `method-${row.method}`,
        text: `${row.count} غذا هم‌زمان با روش «${row.method}» آماده می‌شوند (${row.dishNames.join('، ')}) — از ظرفیت معمول این ایستگاه (${row.capacity} غذای هم‌زمان) عبور کرده؛ فشار بر آشپزخانه را در نظر بگیرید.`,
        severity: 'warning',
      })
    }
  }

  if (complexity.length === 1 && complexity[0].count >= 3) {
    recs.push({
      id: 'low-diversity',
      text: 'تقریباً همه‌ی غذاها از یک روش پخت استفاده می‌کنند؛ برای توزیع بار آشپزخانه، تنوع روش پخت را افزایش دهید.',
      severity: 'warning',
    })
  }

  const ingredientToDishes = new Map<string, Set<string>>()
  for (const item of plan.selectedItems) {
    const dish = dishesById.get(item.dishId)
    if (!dish?.ingredients) continue
    for (const ing of dish.ingredients) {
      const key = ing.name.trim()
      const set = ingredientToDishes.get(key) ?? new Set<string>()
      set.add(dish.name)
      ingredientToDishes.set(key, set)
    }
  }
  for (const [ingredient, dishNames] of ingredientToDishes) {
    if (dishNames.size >= 2) {
      recs.push({
        id: `shared-${ingredient}`,
        text: `«${ingredient}» در ${dishNames.size} غذای انتخابی مشترک است (${Array.from(dishNames).join('، ')}) — آماده‌سازی دسته‌ای این ماده می‌تواند در زمان و هزینه صرفه‌جویی کند.`,
        severity: 'info',
      })
    }
  }

  if (recs.length === 0) {
    recs.push({ id: 'ok', text: 'در حال حاضر هشدار خاصی برای تنوع پخت یا مواد پایه مشترک ثبت نشده است.', severity: 'info' })
  }

  return recs
}

/** کارشناس مالی: عبور هزینه هر پرس از سقف رده (نسبت به بودجه سرانه)، و پیشنهاد جابه‌جایی رده/سهم بودجه. */
export function financialRecommendations(
  plan: EventPlan,
  dishesById: Map<string, Dish>,
  settings: AppSettings,
): Recommendation[] {
  const recs: Recommendation[] = []
  const itemCalcs = computeAllItemCalcs(plan, dishesById, settings)

  for (const item of plan.selectedItems) {
    const dish = dishesById.get(item.dishId)
    if (!dish || dish.costPerServing == null) continue
    const ceiling = tierCostCeilingAmount(plan, settings, item.tier)
    if (dish.costPerServing > ceiling) {
      recs.push({
        id: `ceiling-${item.itemId}`,
        text: `هزینه هر پرس «${dish.name}» (${formatRial(dish.costPerServing)}) از سقف رده «${item.tier}» (${formatRial(ceiling)}، معادل ${Math.round(settings.tierCostCeilingShare[item.tier] * 100)}٪ بودجه سرانه) عبور کرده — رده پایین‌تر یا افزایش سهم بودجه دسته «${dish.category}» را در نظر بگیرید.`,
        severity: 'warning',
      })
    }
  }

  const overBudgetItems = itemCalcs.filter((c) => c.overBudget)
  if (overBudgetItems.length > 0) {
    recs.push({
      id: 'over-budget-items',
      text: `${overBudgetItems.length} آیتم بیش از سهم بودجه‌ی تخصیص‌یافته به خودشان هزینه دارند.`,
      severity: 'warning',
    })
  }

  const missingPriceDishes = plan.selectedItems
    .map((it) => dishesById.get(it.dishId))
    .filter((d): d is Dish => !!d?.needsPrice)
  if (missingPriceDishes.length > 0) {
    recs.push({
      id: 'missing-price',
      text: `${missingPriceDishes.length} آیتم بدون قیمت ثبت‌شده هستند (${missingPriceDishes.map((d) => d.name).join('، ')}) و در «هزینه قطعی» لحاظ نشده‌اند — به «هزینه تخمینی» در داشبورد نگاه کنید.`,
      severity: 'warning',
    })
  }

  if (recs.length === 0) {
    recs.push({ id: 'ok', text: 'در حال حاضر هیچ آیتمی از سقف رده یا سهم بودجه‌اش عبور نکرده است.', severity: 'info' })
  }

  return recs
}
