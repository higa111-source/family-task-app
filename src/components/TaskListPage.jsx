import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useData } from '../hooks/contexts'
import { assigneeOptions, groupByDue, matchesAssignee } from '../lib/tasks'
import TaskCard from './TaskCard'
import TaskEditor from './TaskEditor'

function Chip({ active, onClick, color, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={active ? { backgroundColor: color ?? '#374151' } : undefined}
      className={`shrink-0 rounded-full px-3 py-2 text-sm ${active ? 'font-bold text-white' : 'bg-white text-gray-600'}`}>
      {children}
    </button>
  )
}

function TaskListPage() {
  const { members, categories, items } = useData()
  const [assignee, setAssignee] = useState('all')
  const [category, setCategory] = useState('all')
  const [showDone, setShowDone] = useState(false)
  // null: 閉じている / { task }: 編集 / {}: 新規
  const [editor, setEditor] = useState(null)

  const people = assigneeOptions(members)
  const live = items.filter((t) => !t.deleted_at)
  const subsOf = (id) => live.filter((t) => t.parent_id === id)
  // 他の端末で削除されたカテゴリを選んだままなら「すべて」に戻す
  const activeCategory = category === 'none' || categories.some((c) => c.id === category) ? category : 'all'

  const visible = live.filter((t) => {
    if (t.parent_id) return false
    if (activeCategory !== 'all' && (t.category_id ?? 'none') !== activeCategory) return false
    return matchesAssignee(t, assignee)
      || subsOf(t.id).some((s) => !s.completed_at && s.assignee === assignee)
  })
  const groups = groupByDue(visible.filter((t) => !t.completed_at))
  const done = visible.filter((t) => t.completed_at).sort((a, b) => b.completed_at.localeCompare(a.completed_at))
  const card = (t) => (
    <TaskCard key={t.id} task={t} subs={subsOf(t.id)} people={people}
      category={categories.find((c) => c.id === t.category_id)} onEdit={() => setEditor({ task: t })} />
  )

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-[#f3f6f4] py-3">
        <div className="flex gap-2 overflow-x-auto px-3">
          <Chip active={assignee === 'all'} onClick={() => setAssignee('all')}>全員</Chip>
          {people.filter((p) => p.key !== 'both').map((p) => (
            <Chip key={p.key} active={assignee === p.key} onClick={() => setAssignee(p.key)}>{p.emoji} {p.label}</Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto px-3">
          <Chip active={activeCategory === 'all'} onClick={() => setCategory('all')}>すべて</Chip>
          {categories.map((c) => (
            <Chip key={c.id} color={c.color} active={activeCategory === c.id} onClick={() => setCategory(c.id)}>{c.emoji} {c.name}</Chip>
          ))}
          <Chip active={activeCategory === 'none'} onClick={() => setCategory('none')}>未分類</Chip>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-3 pb-24">
        {groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2">
            <h2 className={`text-sm font-bold ${g.key === 'overdue' ? 'text-red-600' : 'text-gray-600'}`}>{g.label}</h2>
            {g.tasks.map(card)}
          </section>
        ))}
        {groups.length === 0 && <p className="py-12 text-center text-gray-500">未完了のタスクはありません</p>}
        {done.length > 0 && (
          <section className="flex flex-col gap-2">
            <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="py-2 text-left text-sm font-bold text-gray-600">
              {showDone ? '▾' : '▸'} 完了済み ({done.length})
            </button>
            {showDone && done.map(card)}
          </section>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] mx-auto flex max-w-[480px] justify-end px-4">
        <button type="button" aria-label="タスクを追加" onClick={() => setEditor({})}
          className="pointer-events-auto rounded-full bg-emerald-700 p-4 text-white shadow-lg"><Plus size={26} /></button>
      </div>
      {editor && (
        <TaskEditor task={editor.task} subs={editor.task ? subsOf(editor.task.id) : []}
          defaultCategory={activeCategory === 'all' || activeCategory === 'none' ? null : activeCategory} onClose={() => setEditor(null)} />
      )}
    </>
  )
}

export default TaskListPage
