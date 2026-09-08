// نگاشت نام هر ماده اولیه به دسته‌بندی‌اش (کربوهیدرات/پروتئین/چربی و... )، تولیدشده توسط
// scripts/extract_dishes.py::classify_ingredient_label از روی فهرست اصلی گروه‌بندی مواد اولیه‌ی
// شرکت کاترینگ + قواعد کلیدواژه‌ای — نگاه کنید به data/EXTRACTION_NOTES.md.
import raw from '../../data/ingredientGroups.json'

export const ingredientGroups: Record<string, string> = raw as Record<string, string>

export const FALLBACK_INGREDIENT_GROUP = 'سایر'

export function ingredientGroupOf(name: string): string {
  return ingredientGroups[name] ?? FALLBACK_INGREDIENT_GROUP
}

/** ترتیب نمایش دسته‌بندی‌های ماده اولیه در صفحه «مواد اولیه» — همان دسته‌های تولیدشده توسط
 * scripts/extract_dishes.py::classify_ingredient_label، با «سایر» همیشه در انتها. */
export const INGREDIENT_GROUP_ORDER = [
  'پروتئین',
  'کربوهیدرات',
  'سبزیجات و میوه',
  'چربی و روغن',
  'لبنیات',
  'شیرینی و دسر',
  'حبوبات و خشکبار',
  'چاشنی، سس و ادویه',
  'نوشیدنی',
  FALLBACK_INGREDIENT_GROUP,
] as const
