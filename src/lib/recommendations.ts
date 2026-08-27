import type { AppSettings, Dish, EventPlan } from '../types'
import { computeAllItemCalcs, computeCookingComplexity } from './calculations'

export interface Recommendation {
  id: string
  text: string
  severity: 'info' | 'warning'
}

/** برنامه‌ریز رویداد: پیشنهاد تعداد خط بوفه و نیروی سرو. */
export function eventPlannerRecommendations(plan: EventPlan): Recommendation[] {
  const items = plan.selectedItems.length
  if (items === 0) return [{ id: 'no-items', text: 'هنوز هیچ آیتمی به سناریو اضافه نشده است.', severity: 'info' }]

  // فرض کاری: هر خط بوفه پاسخگوی حداکثر ۸۰ میهمان و حداکثر ۶ آیتم هم‌زمان است.
  const linesByGuests = Math.ceil(plan.guestCount / 80)
  const linesByItems = Math.ceil(items / 6)
  const lines = Math.max(1, linesByGuests, linesByItems)

  // فرض کاری: هر ۲۵ میهمان به یک نیروی سرو نیاز دارد.
  const staff = Math.max(2, Math.ceil(plan.guestCount / 25))

  return [
    {
      id: 'lines',
      text: `پیشنهاد ${lines} خط بوفه (بر اساس فرض ۱ خط به ازای هر ۸۰ میهمان و حداکثر ۶ آیتم هم‌زمان روی هر خط).`,
      severity: 'info',
    },
    {
      id: 'staff',
      text: `پیشنهاد حداقل ${staff} نیروی سرو (بر اساس فرض ۱ نیرو به ازای هر ۲۵ میهمان).`,
      severity: 'info',
    },
  ]
}

/** آشپز خبره: تنوع روش پخت و امکان استفاده از مواد پایه مشترک. */
export function chefRecommendations(plan: EventPlan, dishesById: Map<string, Dish>): Recommendation[] {
  const recs: Recommendation[] = []
  const complexity = computeCookingComplexity(plan, dishesById)

  for (const row of complexity) {
    if (row.count > 3) {
      recs.push({
        id: `method-${row.method}`,
        text: `${row.count} غذای اصلی هم‌زمان با روش «${row.method}» پخته می‌شوند (${row.dishNames.join('، ')}) — فشار بر ایستگاه پخت مربوطه را در نظر بگیرید.`,
        severity: 'warning',
      })
    }
  }

  if (complexity.length === 1 && complexity[0].count >= 3) {
    recs.push({
      id: 'low-diversity',
      text: 'تمام غذاهای اصلی از یک روش پخت استفاده می‌کنند؛ برای توزیع بار آشپزخانه، تنوع روش پخت را افزایش دهید.',
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

/** کارشناس مالی: عبور هزینه هر پرس از سقف رده، و پیشنهاد جابه‌جایی رده/سهم بودجه. */
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
    const ceiling = settings.tierCostCeiling[item.tier]
    if (dish.costPerServing > ceiling) {
      recs.push({
        id: `ceiling-${item.itemId}`,
        text: `هزینه هر پرس «${dish.name}» (${dish.costPerServing.toLocaleString('fa-IR')} ریال) از سقف رده «${item.tier}» (${ceiling.toLocaleString('fa-IR')} ریال) عبور کرده — رده پایین‌تر یا افزایش سهم بودجه دسته «${dish.category}» را در نظر بگیرید.`,
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
      text: `${missingPriceDishes.length} آیتم بدون قیمت ثبت‌شده هستند (${missingPriceDishes.map((d) => d.name).join('، ')}) و در جمع هزینه لحاظ نشده‌اند.`,
      severity: 'warning',
    })
  }

  if (recs.length === 0) {
    recs.push({ id: 'ok', text: 'در حال حاضر هیچ آیتمی از سقف رده یا سهم بودجه‌اش عبور نکرده است.', severity: 'info' })
  }

  return recs
}
