import { describe, expect, it } from 'vitest'
import type { AppSettings, Dish, EventPlan, SelectedItem } from '../types'
import {
  categoryBudgetAmount,
  computeAllItemCalcs,
  computeCookingComplexity,
  computeMacroStatus,
  computePlanSummary,
} from './calculations'

const settings: AppSettings = {
  tierWeights: { 'شاخص': 1.5, 'استاندارد': 1.0, 'اقتصادی': 0.6 },
  defaultCoverageByTier: { 'شاخص': 0.4, 'استاندارد': 0.7, 'اقتصادی': 1.0 },
  tierCostCeiling: { 'شاخص': 3_500_000, 'استاندارد': 2_000_000, 'اقتصادی': 1_000_000 },
  confidenceFactorDefault: 1.1,
  nutritionTargets: { totalGramsPerGuest: 520, carbShare: 0.25, proteinShare: 0.25, vegShare: 0.5 },
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
    ...overrides,
  }
}

function makePlan(overrides: Partial<EventPlan> = {}): EventPlan {
  return {
    guestCount: 100,
    perPersonBudget: 1_000_000,
    confidenceFactor: 1.1,
    mealType: 'فقط شام',
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

describe('weighted budget allocation (computeAllItemCalcs)', () => {
  it('splits a category budget between two items proportional to tier weight', () => {
    const dishA = makeDish({ id: 'a', costPerServing: 50_000 })
    const dishB = makeDish({ id: 'b', costPerServing: 50_000 })
    const dishesById = new Map([
      ['a', dishA],
      ['b', dishB],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'a', tier: 'شاخص', coverageCount: 50, portionSize: 200 }, // weight 1.5
      { itemId: '2', dishId: 'b', tier: 'اقتصادی', coverageCount: 50, portionSize: 200 }, // weight 0.6
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
    const items: SelectedItem[] = [{ itemId: '1', dishId: 'a', tier: 'استاندارد', coverageCount: 60, portionSize: 250 }]
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
    const items: SelectedItem[] = [{ itemId: '1', dishId: 'a', tier: 'استاندارد', coverageCount: 20, portionSize: 200 }]
    const plan = makePlan({ selectedItems: items })
    const [calc] = computeAllItemCalcs(plan, dishesById, settings)

    expect(calc.maxAffordableQty).toBeNull()
    expect(calc.totalItemCost).toBeNull()
  })
})

describe('computeMacroStatus', () => {
  it('sums grams per guest across main+starter+dessert but excludes drinks', () => {
    const main = makeDish({ id: 'main', category: 'غذای اصلی', macro: { carb: 25, protein: 25, veg: 50, fat: 0 } })
    const drink = makeDish({ id: 'drink', category: 'نوشیدنی', macro: { carb: 100, protein: 0, veg: 0, fat: 0 } })
    const dishesById = new Map([
      ['main', main],
      ['drink', drink],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'main', tier: 'استاندارد', coverageCount: 100, portionSize: 300 },
      { itemId: '2', dishId: 'drink', tier: 'استاندارد', coverageCount: 100, portionSize: 300 },
    ]
    const plan = makePlan({ selectedItems: items })
    const calcs = computeAllItemCalcs(plan, dishesById, settings)
    const status = computeMacroStatus(calcs, settings)

    // فقط غذای اصلی باید در جمع لحاظ شود: 300g × 25% = 75g کربوهیدرات
    expect(status.totalGrams.carb).toBeCloseTo(75)
    expect(status.targetGrams.carb).toBeCloseTo(520 * 0.25)
    expect(status.statusPercent.carb).toBeCloseTo(75 / (520 * 0.25))
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
      { itemId: '1', dishId: 'priced', tier: 'استاندارد', coverageCount: 10, portionSize: 200 },
      { itemId: '2', dishId: 'unpriced', tier: 'استاندارد', coverageCount: 10, portionSize: 200 },
    ]
    const plan = makePlan({ selectedItems: items })
    const summary = computePlanSummary(plan, dishesById, settings)

    expect(summary.hasMissingPrices).toBe(true)
    expect(summary.totalCost).toBe(20_000 * Math.round(10 * plan.confidenceFactor))
  })
})

describe('computeCookingComplexity', () => {
  it('counts main dishes per cooking method and ignores non-main categories', () => {
    const grilled1 = makeDish({ id: 'g1', category: 'غذای اصلی' })
    const grilled2 = makeDish({ id: 'g2', category: 'غذای اصلی' })
    const fried = makeDish({ id: 'f1', category: 'غذای اصلی' })
    const starter = makeDish({ id: 's1', category: 'پیش‌غذا' })
    const dishesById = new Map([
      ['g1', grilled1],
      ['g2', grilled2],
      ['f1', fried],
      ['s1', starter],
    ])
    const items: SelectedItem[] = [
      { itemId: '1', dishId: 'g1', tier: 'استاندارد', coverageCount: 10, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '2', dishId: 'g2', tier: 'استاندارد', coverageCount: 10, portionSize: 200, cookingMethod: 'گریل' },
      { itemId: '3', dishId: 'f1', tier: 'استاندارد', coverageCount: 10, portionSize: 200, cookingMethod: 'سرخ‌کردنی' },
      { itemId: '4', dishId: 's1', tier: 'استاندارد', coverageCount: 10, portionSize: 200, cookingMethod: 'گریل' },
    ]
    const plan = makePlan({ selectedItems: items })
    const complexity = computeCookingComplexity(plan, dishesById)

    expect(complexity.find((c) => c.method === 'گریل')?.count).toBe(2)
    expect(complexity.find((c) => c.method === 'سرخ‌کردنی')?.count).toBe(1)
    expect(complexity.reduce((sum, c) => sum + c.count, 0)).toBe(3) // پیش‌غذا حساب نمی‌شود
  })
})
