import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dishes as initialDishes } from '../data/dishes'
import { defaultEventPlan, defaultSettings } from '../data/defaultSettings'
import type { AppSettings, Category, CookingMethod, Dish, EventPlan, SelectedItem, Tier } from '../types'

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface AppState {
  dishes: Dish[]
  plan: EventPlan
  settings: AppSettings

  setPlanField: <K extends keyof EventPlan>(key: K, value: EventPlan[K]) => void
  setCategoryBudgetShare: (category: Category, value: number) => void

  addSelectedItem: (category: Category, dishId: string) => void
  updateSelectedItem: (itemId: string, patch: Partial<SelectedItem>) => void
  removeSelectedItem: (itemId: string) => void

  setSettings: (patch: Partial<AppSettings>) => void
  setTierWeight: (tier: Tier, value: number) => void
  setDefaultCoverageByTier: (tier: Tier, value: number) => void
  setTierCostCeilingShare: (tier: Tier, value: number) => void
  setNutritionTarget: (key: keyof AppSettings['nutritionTargets'], value: number) => void
  setCookingMethodCapacity: (method: CookingMethod, value: number) => void

  updateDish: (dishId: string, patch: Partial<Dish>) => void
  upsertDishes: (updated: Dish[], added: Dish[]) => void
  bulkAdjustPrices: (percent: number) => number

  resetPlan: () => void
}

// فیلدهای واقعاً «ویرایش کاربر» روی یک غذا — بقیه فیلدها (ماکرو خام‌استخراج‌شده، مواد اولیه،
// برچسب رژیمی خودکار و ...) همیشه باید از کاتالوگ تازه‌ی dishes.json بیایند، نه از localStorage
// قدیمی، وگرنه هر بار که دیتابیس غذا در یک نسخه جدید اصلاح می‌شود کاربرانی که قبلاً از اپ استفاده
// کرده‌اند برای همیشه روی داده‌ی قدیمی گیر می‌کنند.
const USER_EDITABLE_DISH_FIELDS = [
  'name',
  'category',
  'macro',
  'costPerServing',
  'costSource',
  'needsPrice',
  'priceVarianceFlag',
  'referencePortionGrams',
  'needsPortionEstimate',
] as const

function reconcileDishes(persisted: Dish[] | undefined): Dish[] {
  if (!persisted || persisted.length === 0) return initialDishes
  const persistedById = new Map(persisted.map((d) => [d.id, d]))
  const freshIds = new Set(initialDishes.map((d) => d.id))

  const reconciled = initialDishes.map((fresh) => {
    const old = persistedById.get(fresh.id)
    if (!old) return fresh
    const patch: Partial<Dish> = {}
    for (const key of USER_EDITABLE_DISH_FIELDS) {
      if (old[key] !== undefined) (patch as Record<string, unknown>)[key] = old[key]
    }
    return { ...fresh, ...patch }
  })

  // غذاهایی که کاربر خودش (مثلاً از ایمپورت اکسل) اضافه کرده و در کاتالوگ تازه نیستند، حفظ می‌شوند.
  const userAdded = persisted.filter((d) => !freshIds.has(d.id))
  return [...reconciled, ...userAdded]
}

function reconcileSettings(persisted: Partial<AppSettings> | undefined): AppSettings {
  if (!persisted) return defaultSettings
  return {
    tierWeights: { ...defaultSettings.tierWeights, ...persisted.tierWeights },
    defaultCoverageByTier: { ...defaultSettings.defaultCoverageByTier, ...persisted.defaultCoverageByTier },
    tierCostCeilingShare: { ...defaultSettings.tierCostCeilingShare, ...persisted.tierCostCeilingShare },
    confidenceFactorDefault: persisted.confidenceFactorDefault ?? defaultSettings.confidenceFactorDefault,
    nutritionTargets: { ...defaultSettings.nutritionTargets, ...persisted.nutritionTargets },
    cookingMethodCapacity: { ...defaultSettings.cookingMethodCapacity, ...persisted.cookingMethodCapacity },
  }
}

function reconcilePlan(persisted: Partial<EventPlan> | undefined): EventPlan {
  if (!persisted) return defaultEventPlan
  return {
    ...defaultEventPlan,
    ...persisted,
    categoryBudgetShare: { ...defaultEventPlan.categoryBudgetShare, ...persisted.categoryBudgetShare },
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      dishes: initialDishes,
      plan: defaultEventPlan,
      settings: defaultSettings,

      setPlanField: (key, value) =>
        set((state) => ({ plan: { ...state.plan, [key]: value } })),

      setCategoryBudgetShare: (category, value) =>
        set((state) => ({
          plan: {
            ...state.plan,
            categoryBudgetShare: { ...state.plan.categoryBudgetShare, [category]: value },
          },
        })),

      addSelectedItem: (category, dishId) => {
        const { settings, plan, dishes } = get()
        const tier: Tier = 'استاندارد'
        const coverageCount = Math.round(
          plan.guestCount * plan.expectedAttendanceRate * settings.defaultCoverageByTier[tier],
        )
        const dish = dishes.find((d) => d.id === dishId)
        const newItem: SelectedItem = {
          itemId: makeId(),
          dishId,
          tier,
          coverageCount,
          portionSize: dish?.referencePortionGrams ?? 250,
          cookingMethod: category === 'نوشیدنی' ? undefined : 'گریل',
        }
        set((state) => ({ plan: { ...state.plan, selectedItems: [...state.plan.selectedItems, newItem] } }))
      },

      updateSelectedItem: (itemId, patch) =>
        set((state) => ({
          plan: {
            ...state.plan,
            selectedItems: state.plan.selectedItems.map((it) => (it.itemId === itemId ? { ...it, ...patch } : it)),
          },
        })),

      removeSelectedItem: (itemId) =>
        set((state) => ({
          plan: { ...state.plan, selectedItems: state.plan.selectedItems.filter((it) => it.itemId !== itemId) },
        })),

      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      setTierWeight: (tier, value) =>
        set((state) => ({ settings: { ...state.settings, tierWeights: { ...state.settings.tierWeights, [tier]: value } } })),

      setDefaultCoverageByTier: (tier, value) =>
        set((state) => ({
          settings: { ...state.settings, defaultCoverageByTier: { ...state.settings.defaultCoverageByTier, [tier]: value } },
        })),

      setTierCostCeilingShare: (tier, value) =>
        set((state) => ({
          settings: { ...state.settings, tierCostCeilingShare: { ...state.settings.tierCostCeilingShare, [tier]: value } },
        })),

      setNutritionTarget: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, nutritionTargets: { ...state.settings.nutritionTargets, [key]: value } },
        })),

      setCookingMethodCapacity: (method, value) =>
        set((state) => ({
          settings: { ...state.settings, cookingMethodCapacity: { ...state.settings.cookingMethodCapacity, [method]: value } },
        })),

      updateDish: (dishId, patch) =>
        set((state) => ({ dishes: state.dishes.map((d) => (d.id === dishId ? { ...d, ...patch } : d)) })),

      upsertDishes: (updated, added) =>
        set((state) => {
          const updatedById = new Map(updated.map((d) => [d.id, d]))
          const merged = state.dishes.map((d) => updatedById.get(d.id) ?? d)
          return { dishes: [...merged, ...added] }
        }),

      bulkAdjustPrices: (percent) => {
        let count = 0
        set((state) => ({
          dishes: state.dishes.map((d) => {
            if (d.costPerServing == null) return d
            count += 1
            return { ...d, costPerServing: Math.round((d.costPerServing * (1 + percent / 100)) / 1000) * 1000 }
          }),
        }))
        return count
      },

      resetPlan: () => set({ plan: defaultEventPlan }),
    }),
    {
      name: 'buffet-planner-storage',
      version: 2,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          dishes: reconcileDishes(p.dishes),
          settings: reconcileSettings(p.settings),
          plan: reconcilePlan(p.plan),
        }
      },
    },
  ),
)
