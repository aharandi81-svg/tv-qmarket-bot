import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dishes as initialDishes } from '../data/dishes'
import { defaultEventPlan, defaultSettings } from '../data/defaultSettings'
import type { AppSettings, Category, Dish, EventPlan, SelectedItem, Tier } from '../types'

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
  setTierCostCeiling: (tier: Tier, value: number) => void
  setNutritionTarget: (key: keyof AppSettings['nutritionTargets'], value: number) => void

  updateDish: (dishId: string, patch: Partial<Dish>) => void
  upsertDishes: (updated: Dish[], added: Dish[]) => void
  bulkAdjustPrices: (percent: number) => number

  resetPlan: () => void
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
        const coverageCount = Math.round(plan.guestCount * settings.defaultCoverageByTier[tier])
        const dish = dishes.find((d) => d.id === dishId)
        const newItem: SelectedItem = {
          itemId: makeId(),
          dishId,
          tier,
          coverageCount,
          portionSize: dish?.referencePortionGrams ?? 250,
          cookingMethod: category === 'غذای اصلی' ? 'گریل' : undefined,
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

      setTierCostCeiling: (tier, value) =>
        set((state) => ({
          settings: { ...state.settings, tierCostCeiling: { ...state.settings.tierCostCeiling, [tier]: value } },
        })),

      setNutritionTarget: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, nutritionTargets: { ...state.settings.nutritionTargets, [key]: value } },
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
    { name: 'buffet-planner-storage' },
  ),
)
