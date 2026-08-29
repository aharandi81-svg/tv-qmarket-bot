import { describe, expect, it } from 'vitest'
import type { AppSettings, Dish, EventPlan, SelectedItem } from '../types'
import {
  categoryBudgetAmount,
  computeAllItemCalcs,
  computeCookingComplexity,
  computeMacroStatus,
  computePlanSummary,
  tierCostCeilingAmount,
} from './calculations'

const settings: AppSettings = {
  tierWeights: { 'شاخص': 1.5, 'استاندارد': 1.0, 'اقتصادی': 0.6 },
  defaultCoverageByTier: { 'شاخص': 0.4, 'استاندارد': 0.7, 'اقتصادی': 1.0 },
  tierCostCeilingShare: { 'شاخص': 0.12, 'استاندارد': 0.07, 'اقتصادی': 0.035 },
  confidenceFactorDefault: 1.1,
  nutritionTargets: { totalGramsPerGuest: 520, carbShare: 0.25, proteinShare: 0.25, vegShare: 0.5 },
  cookingMethodCapacity: {
    'گریل': 3,
    'کبابی': 3,
    'سرخ‌کردنی': 3,
    'آب‌پز/بخارپز': 5,
    'خورشتی/آرام‌پز': 5,
    'فر': 5,
    'سرد/بدون پخت': 8,
  },
}

function makeDish(overrides: Partial<Dish> & { id: string }): Dish {
  return {
    name: overrides.id,
    category: 'غذای اصلی',
    macro: { carb: 25, protein: 25, veg: 50, fat: 0 },
    costPerServing: 100_000,
    costSource: 'test',
    priceVarianceFlag: false,
    needsPrice: false,
    eventsUsedIn: [],
    referencePortionGrams: 250,
    portionSource: 'test',
    needsPortionEstimate: false,
    dietaryTags: [],
    dietaryTagsVerified: false,
    isBreakfastItem: false,
    ...overrides,
  }
}

function makePlan(overrides: Partial<EventPlan> = {}): EventPlan {
  return {
    guestCount: 100,
    perPersonBudget: 1_000_000,
    confidenceFactor: 1.1,
    expectedAttendanceRate: 1,
    mealType: 'شام',
    categoryBudgetShare: { 'غذای اصلی': 0.58, 'پیش‌غذا': 0.15, 'دسر': 0.1, 'نوشیدنی': 0.17 },
    selectedItems: [],
    ...overrides,
  }
}

describe('categoryBudgetAmount', () => {
  it('multiplies guests × per-person budget × share', () => {
    const plan = makePlan()
    expect(categoryBudgetAmount(plan, 'غذای اصلی')).toBeCloseTo(100 * 1_000_000 * 0.58)
  })
})

describe('tierCostCeilingAmount', () => {
  it('scales with per-person budget instead of being a fixed rial figure', () => {
    const plan = makePlan({ perPersonBudget: 1_000_000 })
    expect(tierCostCeilingAmount(plan, settings, 'شاخص')).toBeCloseTo(120_000)
    const biggerPlan = makePlan({ perPersonBudget: 10_000_000 })
    expect(tierCostCeilingAmount(biggerPlan, settings, 'شاخص')).toBeCloseTo(1_200_000)
  })
})

describe('weighted budget allocation (computeAllItemCalcs)', () => {
  it('splits a category budget between two items proportional to tier weight', () => {
    const dishA = makeDish({ id: 'a', costPerServing: 50_000 })
    const dishB = makeDish({ id: 'b', costPerServing: 50_000 })
    const dishesById = new Map([
      ['a', dishA],
      ['b', dishB],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'a', tier: 'شاخص', coveragePercent: 0.5, portionSize: 200 }, // weight 1.5
      { itemId: '2', dishId: 'b', tier: 'اقتصادی', coveragePercent: 0.5, portionSize: 200 }, // weight 0.6
    ]
    const plan = makePlan({ selectedItems: items })
    const calcs = computeAllItemCalcs(plan, dishesById, settings)

    const categoryBudget = categoryBudgetAmount(plan, 'غذای اصلی')
    const weightSum = 1.5 + 0.6
    const expectedShareA = (1.5 / weightSum) * categoryBudget
    const expectedShareB = (0.6 / weightSum) * categoryBudget

    expect(calcs[0].budgetShare).toBeCloseTo(expectedShareA)
    expect(calcs[1].budgetShare).toBeCloseTo(expectedShareB)
    // شاخص + اقتصادی باید کل بودجه‌ی دسته را بدون کم و زیاد تقسیم کنند
    expect(calcs[0].budgetShare + calcs[1].budgetShare).toBeCloseTo(categoryBudget)
  })

  it('computes batch quantity, max affordable qty and total cost per the spec formulas', () => {
    const dish = makeDish({ id: 'a', costPerServing: 10_000 })
    const dishesById = new Map([['a', dish]])
    const items: SelectedItem[] = [{ itemId: '1', dishId: 'a', tier: 'استاندارد', coveragePercent: 0.6, portionSize: 250 }]
    const plan = makePlan({ selectedItems: items, confidenceFactor: 1.1 })
    const [calc] = computeAllItemCalcs(plan, dishesById, settings)

    expect(calc.batchQuantity).toBe(Math.round(60 * 1.1))
    expect(calc.totalItemCost).toBe(10_000 * calc.batchQuantity)
    expect(calc.maxAffordableQty).toBe(Math.floor(calc.budgetShare / 10_000))
    expect(calc.gramsPerGuestAvg).toBeCloseTo((60 / 100) * 250)
  })

  it('leaves maxAffordableQty and totalItemCost null when the dish has no price', () => {
    const dish = makeDish({ id: 'a', costPerServing: null, needsPrice: true })
    const dishesById = new Map([['a', dish]])
    const items: SelectedItem[] = [{ itemId: '1', dishId: 'a', tier: 'استاندارد', coveragePercent: 0.2, portionSize: 200 }]
    const plan = makePlan({ selectedItems: items })
    const [calc] = computeAllItemCalcs(plan, dishesById, settings)

    expect(calc.maxAffordableQty).toBeNull()
    expect(calc.totalItemCost).toBeNull()
  })
})

describe('computeMacroStatus (coverage-weighted category average)', () => {
  it('excludes drinks from the plate total', () => {
    const main = makeDish({ id: 'main', category: 'غذای اصلی', macro: { carb: 25, protein: 25, veg: 50, fat: 0 } })
    const drink = makeDish({ id: 'drink', category: 'نوشیدنی', macro: { carb: 100, protein: 0, veg: 0, fat: 0 } })
    const dishesById = new Map([
      ['main', main],
      ['drink', drink],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'main', tier: 'استاندارد', coveragePercent: 1, portionSize: 300 },
      { itemId: '2', dishId: 'drink', tier: 'استاندارد', coveragePercent: 1, portionSize: 300 },
    ]
    const plan = makePlan({ selectedItems: items })
    const calcs = computeAllItemCalcs(plan, dishesById, settings)
    const status = computeMacroStatus(calcs, settings)

    // یک غذای اصلی به‌تنهایی در یک دسته: میانگین وزنی = خودش. 300g × 25% = 75g کربوهیدرات
    expect(status.totalGrams.carb).toBeCloseTo(75)
    expect(status.targetGrams.carb).toBeCloseTo(520 * 0.25)
    expect(status.statusPercent.carb).toBeCloseTo(75 / (520 * 0.25))
  })

  it('averages (does not sum) multiple dishes within the same category, weighted by coverage', () => {
    // این تست دقیقاً همان اشکالی را می‌پوشاند که رفع شد: در بوفه یک مهمان از هر دسته
    // حدوداً یک بار سرو می‌گیرد، نه یک پرس کامل از هر آیتم انتخابی آن دسته.
    const dishA = makeDish({ id: 'a', category: 'غذای اصلی', macro: { carb: 100, protein: 0, veg: 0, fat: 0 } })
    const dishB = makeDish({ id: 'b', category: 'غذای اصلی', macro: { carb: 0, protein: 100, veg: 0, fat: 0 } })
    const dishesById = new Map([
      ['a', dishA],
      ['b', dishB],
    ])
    // پوشش برابر و اندازه پرس برابر → میانگین باید دقیقاً وسط دو غذا باشد، نه جمع آن‌ها
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'a', tier: 'استاندارد', coveragePercent: 0.5, portionSize: 300 },
      { itemId: '2', dishId: 'b', tier: 'استاندارد', coveragePercent: 0.5, portionSize: 300 },
    ]
    const plan = makePlan({ selectedItems: items })
    const calcs = computeAllItemCalcs(plan, dishesById, settings)
    const status = computeMacroStatus(calcs, settings)

    // میانگین پرس این دسته باید ۳۰۰ گرم بماند (نه ۶۰۰ گرم جمع دو آیتم)
    const mainAvg = status.categoryAverages.find((a) => a.category === 'غذای اصلی')
    expect(mainAvg?.avgPortionGrams).toBeCloseTo(300)
    expect(status.totalGrams.carb).toBeCloseTo(150) // 300g × 50%
    expect(status.totalGrams.protein).toBeCloseTo(150)
  })

  it('adding a third dish to a heavily-covered category does not blow up the total (regression)', () => {
    const dishesById = new Map(
      ['a', 'b'].map((id) => [id, makeDish({ id, category: 'غذای اصلی', macro: { carb: 25, protein: 25, veg: 50, fat: 0 } })]),
    )
    const twoItemPlan = makePlan({
      selectedItems: [
        { itemId: '1', dishId: 'a', tier: 'استاندارد', coveragePercent: 1, portionSize: 300 },
        { itemId: '2', dishId: 'b', tier: 'استاندارد', coveragePercent: 1, portionSize: 300 },
      ],
    })
    const twoItemStatus = computeMacroStatus(computeAllItemCalcs(twoItemPlan, dishesById, settings), settings)

    const dishesById3 = new Map(dishesById)
    dishesById3.set('c', makeDish({ id: 'c', category: 'غذای اصلی', macro: { carb: 25, protein: 25, veg: 50, fat: 0 } }))
    const threeItemPlan = makePlan({
      selectedItems: [
        ...twoItemPlan.selectedItems,
        { itemId: '3', dishId: 'c', tier: 'استاندارد', coveragePercent: 1, portionSize: 300 },
      ],
    })
    const threeItemStatus = computeMacroStatus(computeAllItemCalcs(threeItemPlan, dishesById3, settings), settings)

    // چون هر سه غذا مشخصات یکسان دارند، افزودن گزینه‌ی سوم نباید عدد نهایی را عوض کند
    expect(threeItemStatus.totalGrams.carb).toBeCloseTo(twoItemStatus.totalGrams.carb)
  })
})

describe('computePlanSummary', () => {
  it('flags missing prices without silently treating them as zero cost', () => {
    const priced = makeDish({ id: 'priced', costPerServing: 20_000 })
    const unpriced = makeDish({ id: 'unpriced', costPerServing: null, needsPrice: true })
    const dishesById = new Map([
      ['priced', priced],
      ['unpriced', unpriced],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'priced', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200 },
      { itemId: '2', dishId: 'unpriced', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200 },
    ]
    const plan = makePlan({ selectedItems: items })
    const summary = computePlanSummary(plan, dishesById, settings)

    expect(summary.hasMissingPrices).toBe(true)
    expect(summary.missingPriceCount).toBe(1)
    expect(summary.totalCost).toBe(20_000 * Math.round(10 * plan.confidenceFactor))
  })

  it('estimates a fallback total for missing-price items using the category average', () => {
    const priced = makeDish({ id: 'priced', category: 'دسر', costPerServing: 20_000 })
    const unpriced = makeDish({ id: 'unpriced', category: 'دسر', costPerServing: null, needsPrice: true })
    const dishesById = new Map([
      ['priced', priced],
      ['unpriced', unpriced],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'priced', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200 },
      { itemId: '2', dishId: 'unpriced', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200 },
    ]
    const plan = makePlan({ selectedItems: items })
    const summary = computePlanSummary(plan, dishesById, settings)

    // برآورد باید بیشتر از هزینه قطعی باشد چون آیتم بدون قیمت هم لحاظ شده
    expect(summary.estimatedTotalCost).toBeGreaterThan(summary.totalCost)
  })
})

describe('computeCookingComplexity', () => {
  it('counts dishes per cooking method across main/starter/dessert (not drinks) against real station capacity', () => {
    const grilled1 = makeDish({ id: 'g1', category: 'غذای اصلی' })
    const grilled2 = makeDish({ id: 'g2', category: 'غذای اصلی' })
    const grilled3 = makeDish({ id: 'g3', category: 'غذای اصلی' })
    const fried = makeDish({ id: 'f1', category: 'غذای اصلی' })
    const starter = makeDish({ id: 's1', category: 'پیش‌غذا' })
    const drink = makeDish({ id: 'd1', category: 'نوشیدنی' })
    const dishesById = new Map([
      ['g1', grilled1],
      ['g2', grilled2],
      ['g3', grilled3],
      ['f1', fried],
      ['s1', starter],
      ['d1', drink],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'g1', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '2', dishId: 'g2', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '3', dishId: 'f1', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'سرخ‌کردنی' },
      { itemId: '4', dishId: 's1', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '5', dishId: 'd1', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '6', dishId: 'g3', tier: 'استاندارد', coveragePercent: 0.1, portionSize: 200, cookingMethod: 'گریل' },
    ]
    const plan = makePlan({ selectedItems: items })
    const complexity = computeCookingComplexity(plan, dishesById, settings)

    // پیش‌غذا هم باید حساب شود (بر خلاف نسخه قبلی)؛ نوشیدنی حساب نمی‌شود
    const grill = complexity.find((c) => c.method === 'گریل')
    expect(grill?.count).toBe(4) // g1, g2, g3, s1 — نه نوشیدنی
    expect(grill?.capacity).toBe(settings.cookingMethodCapacity['گریل'])
    expect(grill?.overCapacity).toBe(true) // 4 > ظرفیت گریل (3)
    expect(complexity.find((c) => c.method === 'سرخ‌کردنی')?.count).toBe(1)
    expect(complexity.find((c) => c.method === 'سرخ‌کردنی')?.overCapacity).toBe(false)
    expect(complexity.reduce((sum, c) => sum + c.count, 0)).toBe(5) // نوشیدنی حساب نمی‌شود
  })
})
