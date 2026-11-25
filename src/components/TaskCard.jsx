import { useState } from 'react'
import { Check } from 'lucide-react'
import { useData } from '../hooks/contexts'
import { assigneeOf, formatDue, toDateValue } from '../lib/tasks'

function CheckButton({ task }) {
  const { updateItem } = useData()
  const done = Boolean(task.completed_at)
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={`${task.title}を完了`}
      onClick={() => updateItem(task.id, { completed_at: done ? null : new Date().toISOString() })}
      className="-m-2 shrink-0 p-2">
      <span className={`flex size-6 items-center justify-center rounded-md border-2 ${done ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-gray-400 bg-white'}`}>
        {done && <Check size={16} strokeWidth={3} />}
      </span>
    </button>
  )
}

function Due({ task }) {
  if (!task.due_date) return null
  const overdue = !task.completed_at && task.due_date < toDateValue(new Date())
  return <span className={`shrink-0 text-xs ${overdue ? 'font-bold text-red-600' : 'text-gray-500'}`}>📅 {formatDue(task.due_date)}</span>
}

function TaskCard({ task, subs, people, category, onEdit }) {
  const [open, setOpen] = useState(false)
  const person = (t) => people.find((p) => p.key === assigneeOf(t))
  const titleClass = (t) => `break-words ${t.completed_at ? 'text-gray-400 line-through' : 'text-gray-800'}`
  const who = (t, size) => <span role="img" aria-label={`担当: ${person(t).label}`} className={size}>{person(t).emoji}</span>

  return (
    <article className="rounded-xl border-l-4 bg-white px-3 py-3 shadow-sm" style={{ borderLeftColor: category?.color ?? '#d1d5db' }}>
      <div className="flex items-center gap-3">
        <CheckButton task={task} />
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block font-medium ${titleClass(task)}`}>{task.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
              {category && <span>{category.emoji} {category.name}</span>}
              <Due task={task} />
              {task.note && <span>📝 備考</span>}
            </span>
          </span>
          {who(task, 'text-3xl')}
        </button>
      </div>
      {subs.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="ml-9 pt-2 pr-4 text-xs font-bold text-emerald-800">
          {open ? '▾' : '▸'} サブタスク {subs.filter((s) => s.completed_at).length}/{subs.length}
        </button>
      )}
      {open && (
        <ul className="mt-2 ml-9 flex flex-col gap-3">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <CheckButton task={s} />
              <span className={`min-w-0 flex-1 text-sm ${titleClass(s)}`}>{s.title}</span>
              <Due task={s} />
              {who(s, 'text-xl')}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default TaskCard
