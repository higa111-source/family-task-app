import { useState } from 'react'
import { ListTodo, Tags, Settings } from 'lucide-react'
import { useAuth, useData } from './hooks/contexts'
import DataProvider from './components/DataProvider'
import LoginPage from './components/LoginPage'
import TaskListPage from './components/TaskListPage'
import CategoryPage from './components/CategoryPage'
import SettingsPage from './components/SettingsPage'

const NAV_ITEMS = [
  { key: 'tasks', label: 'タスク', icon: ListTodo },
  { key: 'categories', label: 'カテゴリ', icon: Tags },
  { key: 'settings', label: '設定', icon: Settings },
]
const LINK_CLASS = 'px-4 py-2 font-bold text-emerald-700 underline'

function Main() {
  const [page, setPage] = useState('tasks')
  const { logout } = useAuth()
  const { loaded, loadError, members, reload, message } = useData()

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-500">
        <p>{loadError ? 'データを取得できませんでした' : '読み込み中...'}</p>
        {loadError && <button type="button" onClick={reload} className={LINK_CLASS}>再試行</button>}
        {loadError && <button type="button" onClick={logout} className={LINK_CLASS}>ログアウト</button>}
      </div>
    )
  }
  if (members.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-gray-600">
        <p>このアカウントは家族タスクに登録されていません</p>
        <button type="button" onClick={logout} className={LINK_CLASS}>ログアウト</button>
      </div>
    )
  }

  return (
    <>
      <div className="shrink-0 pt-[env(safe-area-inset-top)]" />
      {loadError && (
        <div className="flex items-center justify-between bg-amber-100 px-4 py-1 text-xs text-amber-900">
          <span>最新の状態を取得できていません</span>
          <button type="button" onClick={reload} className="px-2 py-1 font-bold underline">再試行</button>
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {page === 'tasks' && <TaskListPage />}
        {page === 'categories' && <CategoryPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      {message && (
        <p role="alert" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-lg bg-gray-800 px-4 py-3 text-center text-sm text-white">{message}</p>
      )}
      <nav className="grid shrink-0 grid-cols-3 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setPage(key)} aria-current={page === key ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-xs ${page === key ? 'font-bold text-emerald-700' : 'text-gray-500'}`}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}

function App() {
  const { loggedIn } = useAuth()
  if (!loggedIn) return <LoginPage />
  return <DataProvider><Main /></DataProvider>
}

export default App
