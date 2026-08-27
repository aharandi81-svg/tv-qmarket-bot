import type { Dish } from '../types'
// دیتابیس واقعی غذاها، تولیدشده توسط scripts/extract_dishes.py از فایل اکسل سوابق رویدادها.
import raw from '../../data/dishes.json'

export const dishes: Dish[] = raw as Dish[]

export function buildDishesById(list: Dish[] = dishes): Map<string, Dish> {
  return new Map(list.map((d) => [d.id, d]))
}
