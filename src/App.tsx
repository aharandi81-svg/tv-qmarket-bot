import { useState } from 'react'
import { EventSettingsPage } from './pages/EventSettingsPage'
import { DishSelectionPage } from './pages/DishSelectionPage'
import { DashboardPage } from './pages/DashboardPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { DishDatabasePage } from './pages/DishDatabasePage'

const TABS = [
  { id: 'settings', label: 'تنظیمات رویداد', Component: EventSettingsPage },
  { id: 'selection', label: 'انتخاب غذا', Component: DishSelectionPage },
  { id: 'dashboard', label: 'داشبورد جمع‌بندی', Component: DashboardPage },
  { id: 'recommendations', label: 'توصیه‌های تخصصی', Component: RecommendationsPage },
  { id: 'database', label: 'دیتابیس غذاها', Component: DishDatabasePage },
] as const

type TabId = (typeof TABS)[number]['id']

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('settings')
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.Component ?? EventSettingsPage

  return (
    <div className="min-h-screen">
      <header className="bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
          <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg bg-amber-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              برنامه‌ریز و بهینه‌ساز منوی بوفه رویداد سازمانی
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">همه‌ی محاسبات به‌صورت زنده و سمت مرورگر انجام می‌شود.</p>
          </div>
        </div>
        <div className="h-1 w-full bg-amber-400" />
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-slate-900 p-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="pb-10">
          <ActiveComponent />
        </main>
      </div>
    </div>
  )
}

export default App
