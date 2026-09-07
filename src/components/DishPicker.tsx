import { useMemo, useState } from 'react'
import type { Category, Dish } from '../types'

export function DishPicker({
  category,
  dishes,
  onPick,
}: {
  category: Category
  dishes: Dish[]
  onPick: (dishId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const inCategory = dishes.filter((d) => d.category === category)
    if (!query.trim()) return inCategory.slice(0, 30)
    const q = query.trim()
    return inCategory.filter((d) => d.name.includes(q)).slice(0, 30)
  }, [dishes, category, query])

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={`+ افزودن ${category} …`}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-amber-900/40"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">غذایی یافت نشد</li>}
          {options.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(d.id)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm text-slate-900 hover:bg-amber-50 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <span>{d.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{d.referencePortionGrams} گرم</span>
                  {d.needsPrice && <span className="text-xs text-amber-600 dark:text-amber-400">بدون قیمت</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
