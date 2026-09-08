import { CATEGORIES } from '../types'
import type { AppSettings, Category, Dish, EventPlan, MealType } from '../types'
import { categoryBudgetAmount, computeAllItemCalcs, computeCookingComplexity, tierCostCeilingAmount } from './calculations'
import { formatNumber, formatRial } from './format'

export type Severity = 'critical' | 'warning' | 'info' | 'success'

export interface Recommendation {
  id: string
  text: string
  severity: Severity
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 }

function sortBySeverity(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

function okIfEmpty(recs: Recommendation[], okId: string, okText: string): Recommendation[] {
  return recs.length > 0 ? sortBySeverity(recs) : [{ id: okId, text: okText, severity: 'success' }]
}

/** بالاترین سطح هشدار در بین چند بخش — برای خلاصه‌ی وضعیت کلی بالای صفحه. */
export function overallSeverity(sections: Recommendation[][]): Severity {
  let best: Severity = 'success'
  for (const recs of sections) {
    for (const r of recs) {
      if (SEVERITY_RANK[r.severity] < SEVERITY_RANK[best]) best = r.severity
    }
  }
  return best
}

// -----------------------------------------------------------------------
// برنامه‌ریز رویداد: چیدمان بوفه، نیروی سرو، و پوشش وعده/رژیم غذایی مهمانان.
// -----------------------------------------------------------------------
export function eventPlannerRecommendations(plan: EventPlan, dishesById: Map<string, Dish>): Recommendation[] {
  if (plan.selectedItems.length === 0) {
    return [{ id: 'no-items', text: 'هنوز هیچ آیتمی به سناریو اضافه نشده — از صفحه «انتخاب غذا» شروع کنید.', severity: 'info' }]
  }

  const dishesInPlan = plan.selectedItems.map((it) => dishesById.get(it.dishId)).filter((d): d is Dish => !!d)
  const countByCategory: Record<Category, number> = { 'غذای اصلی': 0, 'پیش‌غذا': 0, 'دسر': 0, 'نوشیدنی': 0 }
  for (const dish of dishesInPlan) countByCategory[dish.category] += 1
  const mainLineItems = countByCategory['غذای اصلی'] + countByCategory['پیش‌غذا']

  const recs: Recommendation[] = []

  // فرض کاری: هر خط بوفه اصلی پاسخگوی حداکثر ۸۰ میهمان و حداکثر ۶ آیتم هم‌زمان (اصلی+پیش‌غذا) است.
  if (mainLineItems > 0) {
    const lines = Math.max(1, Math.ceil(plan.guestCount / 80), Math.ceil(mainLineItems / 6))
    recs.push({
      id: 'main-lines',
      text: `برای «${plan.mealType}» با ${formatNumber(plan.guestCount)} میهمان و ${mainLineItems} آیتم اصلی/پیش‌غذا، ${lines} خط بوفه پیشنهاد می‌شود (هر خط حداکثر ۸۰ میهمان یا ۶ آیتم هم‌زمان).`,
      severity: 'info',
    })
  }

  if (countByCategory['دسر'] > 0) {
    const dessertTables = Math.max(1, Math.ceil(plan.guestCount / 120))
    recs.push({
      id: 'dessert-table',
      text: `${dessertTables} میز دسر جداگانه از خط اصلی بوفه در نظر بگیرید (هر میز حداکثر ۱۲۰ میهمان).`,
      severity: 'info',
    })
  }
  if (countByCategory['نوشیدنی'] > 0) {
    const drinkStations = Math.max(1, Math.ceil(plan.guestCount / 100))
    recs.push({
      id: 'drink-station',
      text: `${drinkStations} ایستگاه نوشیدنی جداگانه در نظر بگیرید (هر ایستگاه حداکثر ۱۰۰ میهمان).`,
      severity: 'info',
    })
  }

  const staff = Math.max(2, Math.ceil(plan.guestCount / 25))
  recs.push({
    id: 'staff',
    text: `حداقل ${staff} نیروی سرو برای این تعداد میهمان لازم است (۱ نیرو به ازای هر ۲۵ میهمان).`,
    severity: 'info',
  })

  // آیا آیتم انتخابی با نوع وعده هم‌خوان است؟ (اگر بعد از انتخاب غذا، نوع وعده عوض شده باشد)
  const breakfastMeal: MealType[] = ['صبحانه', 'صبحانه و ناهار', 'صبحانه، ناهار و شام']
  const wantsBreakfast = breakfastMeal.includes(plan.mealType)
  const hasBreakfastDish = dishesInPlan.some((d) => d.isBreakfastItem)
  const hasNonBreakfastMain = dishesInPlan.some((d) => !d.isBreakfastItem && d.category !== 'نوشیدنی')
  if (wantsBreakfast && !hasBreakfastDish) {
    recs.push({
      id: 'no-breakfast-item',
      text: `نوع وعده «${plan.mealType}» است اما هیچ غذای صبحانه‌ای انتخاب نشده — لیست را بازبینی کنید.`,
      severity: 'warning',
    })
  }
  if (plan.mealType === 'صبحانه' && hasNonBreakfastMain) {
    recs.push({
      id: 'unexpected-non-breakfast',
      text: 'وعده «صبحانه» است اما در سناریو غذای غیرصبحانه هم انتخاب شده — احتمالاً باقی‌مانده از تغییر نوع وعده است.',
      severity: 'warning',
    })
  }

  // پوشش رژیمی: حداقل یک گزینه گیاهی در دسته‌های اصلی برای مهمانانی که گوشت مصرف نمی‌کنند.
  const mainAndAppetizer = dishesInPlan.filter((d) => d.category === 'غذای اصلی' || d.category === 'پیش‌غذا')
  const hasVegetarianOption = mainAndAppetizer.some((d) => d.dietaryTags.includes('گیاهی'))
  if (mainAndAppetizer.length > 0 && !hasVegetarianOption) {
    recs.push({
      id: 'no-vegetarian-option',
      text: 'در حال حاضر هیچ گزینه گیاهی مشخصی در غذای اصلی/پیش‌غذا وجود ندارد — برای پوشش مهمانان گیاه‌خوار، افزودن حداقل یک گزینه توصیه می‌شود (برچسب‌های رژیمی خودکارند؛ در دیتابیس غذا بررسی کنید).',
      severity: 'info',
    })
  }

  return okIfEmpty(recs, 'planner-ok', 'چیدمان بوفه، نیروی سرو و پوشش وعده در وضعیت مناسبی است.')
}

// -----------------------------------------------------------------------
// آشپز خبره: فشار روی ایستگاه‌های پخت و فرصت آماده‌سازی دسته‌ای مواد اولیه‌ی اصلی.
// -----------------------------------------------------------------------

// مواد اولیه‌ی پایه/ادویه‌ای که تقریباً در همه‌ی غذاها مشترک‌اند و اشاره به اشتراک آن‌ها
// اطلاعات عملی جدیدی برای آشپزخانه ندارد (نویز). فهرست از روی نام‌های واقعی دیتابیس غذا
// (data/dishes.json) استخراج شده — تطبیق دقیق (نه زیررشته‌ای)، چون زیررشته باعث می‌شود
// مثلاً «فلفل دلمه رنگی» (یک سبزی مجزا) با «فلفل» (ادویه) یکی به‌حساب بیاید، یا «سیروپ افرا»
// چون کاراکترهای «سیر» را در خود دارد به‌اشتباه پیش‌پاافتاده تشخیص داده شود.
const TRIVIAL_INGREDIENTS = new Set([
  'نمک',
  'نمک تصفیه',
  'نمک و فلفل',
  'فلفل',
  'فلفل سیاه',
  'فلفل سفید',
  'پودر فلفل قرمز',
  'روغن',
  'روغن مایع',
  'روغن زیتون',
  'روغن سرخ کردنی',
  'روغن پخت و پز',
  'آب',
  'شکر',
  'شکر سفید',
  'پیاز',
  'پیاز زرد',
  'پیاز سفید',
  'پیاز قرمز',
  'پیازداغ',
  'سیر',
  'پودر سیر',
  'پودر پیاز',
  'زردچوبه',
  'دارچین',
  'لیمو',
  'لیمو ترش',
  'آبلیمو',
  'آبلیمو شرکتی',
  'آبلیمو طبیعی',
  'آب لیمو',
  'سرکه',
  'سرکه سفید',
  'رب گوجه',
  'رب گوجه‌فرنگی',
  'آرد',
  'کره',
  'ادویه',
])

function isTrivialIngredient(name: string): boolean {
  return TRIVIAL_INGREDIENTS.has(name)
}

export function chefRecommendations(plan: EventPlan, dishesById: Map<string, Dish>, settings: AppSettings): Recommendation[] {
  const recs: Recommendation[] = []
  const complexity = computeCookingComplexity(plan, dishesById, settings)

  for (const row of complexity.filter((r) => r.overCapacity)) {
    const ratio = row.count / row.capacity
    recs.push({
      id: `method-${row.method}`,
      text: `ایستگاه «${row.method}»: ${row.count} غذا هم‌زمان (${row.dishNames.join('، ')}) در برابر ظرفیت معمول ${row.capacity} غذا — ${
        ratio >= 2 ? 'فشار جدی بر این ایستگاه؛ روش پخت برخی آیتم‌ها را تغییر دهید یا زمان‌بندی پخت را جدا کنید.' : 'ظرفیت را با احتیاط مدیریت کنید.'
      }`,
      severity: ratio >= 2 ? 'critical' : 'warning',
    })
  }

  if (complexity.length === 1 && complexity[0].count >= 3) {
    recs.push({
      id: 'low-diversity',
      text: 'همه‌ی غذاها از یک روش پخت استفاده می‌کنند — تنوع روش پخت را افزایش دهید تا بار آشپزخانه روی یک ایستگاه متمرکز نشود.',
      severity: 'warning',
    })
  }

  const ingredientToDishes = new Map<string, Set<string>>()
  for (const item of plan.selectedItems) {
    const dish = dishesById.get(item.dishId)
    if (!dish?.ingredients) continue
    for (const ing of dish.ingredients) {
      const key = ing.name.trim()
      if (isTrivialIngredient(key)) continue
      const set = ingredientToDishes.get(key) ?? new Set<string>()
      set.add(dish.name)
      ingredientToDishes.set(key, set)
    }
  }
  const sharedIngredients = Array.from(ingredientToDishes.entries())
    .filter(([, dishNames]) => dishNames.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 3) // فقط ۳ مورد پراستفاده‌تر، برای جلوگیری از شلوغی فهرست

  for (const [ingredient, dishNames] of sharedIngredients) {
    recs.push({
      id: `shared-${ingredient}`,
      text: `«${ingredient}» در ${dishNames.size} غذای انتخابی مشترک است (${Array.from(dishNames).join('، ')}) — آماده‌سازی دسته‌ای این ماده در زمان و هزینه صرفه‌جویی می‌کند.`,
      severity: 'info',
    })
  }

  // تخصیص گروهی ذخیره‌ی احتیاطی: وقتی چند غذا در یک دسته کنار هم‌اند، مهمان بین آن‌ها جابه‌جا
  // می‌شود (اگر یکی کم بیاید، معمولاً از گزینه‌ی دیگر برمی‌دارد) — پس جمع ذخیره‌های جداگانه‌ی
  // هر آیتم بیش از نیاز واقعی دسته است. عدد ۰.۶ یک قاعده‌ی سرانگشتی محافظه‌کارانه است، نه محاسبه‌ی
  // دقیق آماری؛ فقط برای نشان‌دادن مقیاس فرصت صرفه‌جویی است.
  const itemCalcs = computeAllItemCalcs(plan, dishesById, settings)
  for (const category of CATEGORIES) {
    const calcsInCategory = itemCalcs.filter((c) => c.category === category)
    if (calcsInCategory.length < 2) continue
    const totalReserve = calcsInCategory.reduce((s, c) => s + c.reserveQuantity, 0)
    if (totalReserve <= 0) continue
    const pooledSuggestion = Math.round(totalReserve * 0.6)
    const saved = totalReserve - pooledSuggestion
    if (saved > 0) {
      recs.push({
        id: `pooled-reserve-${category}`,
        text: `در دسته «${category}»، ${calcsInCategory.length} غذا هرکدام جداگانه ذخیره‌ی احتیاطی می‌گیرند (جمعاً ${formatNumber(totalReserve)} پرس) — چون مهمانان معمولاً بین گزینه‌های یک دسته جابه‌جا می‌شوند، یک ذخیره‌ی مشترک حدود ${formatNumber(pooledSuggestion)} پرس (مواد اولیه‌ی آماده‌ی مشترک، نه پخت جداگانه برای هرکدام) معمولاً کافی است و حدود ${formatNumber(saved)} پرس آماده‌سازی غیرضروری را حذف می‌کند.`,
        severity: 'info',
      })
    }
  }

  return okIfEmpty(recs, 'chef-ok', 'فشار خاصی روی ایستگاه‌های پخت دیده نمی‌شود؛ تنوع روش پخت مناسب است.')
}

// -----------------------------------------------------------------------
// کارشناس مالی: سقف هزینه هر رده، سهم بودجه هر دسته، و پوشش قیمتی داده‌ها.
// -----------------------------------------------------------------------
export function financialRecommendations(
  plan: EventPlan,
  dishesById: Map<string, Dish>,
  settings: AppSettings,
): Recommendation[] {
  const recs: Recommendation[] = []
  const itemCalcs = computeAllItemCalcs(plan, dishesById, settings)

  // سقف هزینه هر رده — گروه‌بندی‌شده بر اساس رده تا به‌جای یک هشدار جدا برای هر غذا، یک خط خلاصه بدهیم.
  const overCeilingByTier = new Map<string, string[]>()
  for (const item of plan.selectedItems) {
    const dish = dishesById.get(item.dishId)
    if (!dish || dish.costPerServing == null) continue
    const ceiling = tierCostCeilingAmount(plan, settings, item.tier)
    if (dish.costPerServing > ceiling) {
      const list = overCeilingByTier.get(item.tier) ?? []
      list.push(dish.name)
      overCeilingByTier.set(item.tier, list)
    }
  }
  for (const [tier, names] of overCeilingByTier) {
    const ceiling = tierCostCeilingAmount(plan, settings, tier as (typeof plan.selectedItems)[number]['tier'])
    recs.push({
      id: `ceiling-${tier}`,
      text: `${names.length} غذا در رده «${tier}» از سقف هزینه این رده (${formatRial(ceiling)} هر پرس) عبور کرده‌اند: ${names.join('، ')} — رده پایین‌تر یا افزایش سهم بودجه دسته مربوطه را در نظر بگیرید.`,
      severity: 'warning',
    })
  }

  // سهم بودجه هر دسته: هزینه واقعی (فقط آیتم‌های قیمت‌دار) در برابر بودجه تخصیص‌یافته به آن دسته.
  for (const category of CATEGORIES) {
    const calcsInCategory = itemCalcs.filter((c) => c.category === category)
    if (calcsInCategory.length === 0) continue
    const allocated = categoryBudgetAmount(plan, category)
    if (allocated <= 0) continue
    const spent = calcsInCategory.reduce((s, c) => s + (c.totalItemCost ?? 0), 0)
    const ratio = spent / allocated
    if (ratio > 1.15) {
      recs.push({
        id: `category-over-${category}`,
        text: `هزینه دسته «${category}» (${formatRial(spent)}) حدود ${Math.round(ratio * 100)}٪ بودجه تخصیص‌یافته (${formatRial(allocated)}) است — سهم بودجه این دسته را افزایش دهید یا آیتمی را حذف/تغییر رده دهید.`,
        severity: ratio > 1.4 ? 'critical' : 'warning',
      })
    }
  }

  const missingPriceDishes = Array.from(new Set(plan.selectedItems.map((it) => dishesById.get(it.dishId)).filter((d): d is Dish => !!d?.needsPrice)))
  if (missingPriceDishes.length > 0) {
    recs.push({
      id: 'missing-price',
      text: `${missingPriceDishes.length} آیتم بدون قیمت ثبت‌شده هستند (${missingPriceDishes.map((d) => d.name).join('، ')}) — این‌ها در «هزینه قطعی» لحاظ نشده‌اند؛ برای برآورد واقعی به «هزینه تخمینی» در داشبورد نگاه کنید یا قیمت را در دیتابیس غذا وارد کنید.`,
      severity: 'warning',
    })
  }

  const totalBudget = plan.guestCount * plan.perPersonBudget
  const estimatedCost = itemCalcs.reduce((s, c) => s + (c.totalItemCost ?? 0), 0)
  if (totalBudget > 0 && missingPriceDishes.length === 0) {
    const overallRatio = estimatedCost / totalBudget
    if (overallRatio > 1) {
      recs.push({
        id: 'total-over-budget',
        text: `هزینه کل برآوردی (${formatRial(estimatedCost)}) از بودجه کل رویداد (${formatRial(totalBudget)}) عبور کرده است.`,
        severity: 'critical',
      })
    }
  }

  // ریسک هدررفت مالی: اگر ذخیره‌ی احتیاطی غذاهای فسادپذیر مصرف نشود، همین مقدار هدر می‌رود —
  // جدا از «سهم بودجه»، چون این هزینه حتی وقتی همه‌چیز در بودجه است هم می‌تواند قابل توجه باشد.
  const wasteExposureItems = itemCalcs
    .filter((c) => c.wasteRiskAmount != null && c.wasteRiskAmount > 0)
    .sort((a, b) => (b.wasteRiskAmount ?? 0) - (a.wasteRiskAmount ?? 0))
  const totalWasteExposure = wasteExposureItems.reduce((s, c) => s + (c.wasteRiskAmount ?? 0), 0)
  if (totalBudget > 0 && totalWasteExposure > 0) {
    const exposureRatio = totalWasteExposure / totalBudget
    if (exposureRatio > 0.02) {
      const topItems = wasteExposureItems
        .slice(0, 3)
        .map((c) => `${c.dish?.name} (${formatRial(c.wasteRiskAmount ?? 0)})`)
      recs.push({
        id: 'waste-risk-exposure',
        text: `مجموع ریسک هدررفت مالی غذاهای فسادپذیر حدود ${formatRial(totalWasteExposure)} است (~${Math.round(exposureRatio * 100)}٪ از بودجه کل) — یعنی اگر ذخیره‌ی احتیاطی این‌ها مصرف نشود، همین مقدار هدر می‌رود. بیشترین سهم: ${topItems.join('، ')}.`,
        severity: exposureRatio > 0.05 ? 'critical' : 'warning',
      })
    }
  }

  return okIfEmpty(recs, 'financial-ok', 'هیچ آیتمی از سقف رده یا سهم بودجه دسته‌اش عبور نکرده است.')
}
