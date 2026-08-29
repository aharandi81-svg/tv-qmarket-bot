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
      <header className="border-b-2 border-amber-500 bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            برنامه‌ریز و بهینه‌ساز منوی بوفه رویداد سازمانی
          </h1>
          <p className="mt-1 text-sm text-slate-300">همه‌ی محاسبات به‌صورت زنده و سمت مرورگر انجام می‌شود.</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <nav className="flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
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
