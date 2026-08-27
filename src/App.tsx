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
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">برنامه‌ریز و بهینه‌ساز منوی بوفه رویداد سازمانی</h1>
        <p className="mt-1 text-sm text-gray-500">همه‌ی محاسبات به‌صورت زنده و سمت مرورگر انجام می‌شود.</p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
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
  )
}

export default App
