const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function toDateValue(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function formatDue(value) {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const year = y === new Date().getFullYear() ? '' : `${y}/`
  return `${year}${m}/${d}(${WEEKDAYS[date.getDay()]})`
}

// 'YYYY-MM-DD' は文字列のまま大小比較できる
export function groupByDue(tasks, now = new Date()) {
  const today = toDateValue(now)
  const weekEnd = toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7))
  const groups = [
    { key: 'overdue', label: '⚠️ 期限切れ', tasks: [] },
    { key: 'today', label: '今日', tasks: [] },
    { key: 'week', label: '7日以内', tasks: [] },
    { key: 'later', label: 'それ以降', tasks: [] },
    { key: 'none', label: '期限なし', tasks: [] },
  ]
  for (const t of tasks) {
    const i = !t.due_date ? 4 : t.due_date < today ? 0 : t.due_date === today ? 1 : t.due_date <= weekEnd ? 2 : 3
    groups[i].tasks.push(t)
  }
  for (const g of groups) {
    g.tasks.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.created_at.localeCompare(b.created_at))
  }
  return groups.filter((g) => g.tasks.length > 0)
}

// 担当者のデフォルトは全員。以前に未割当で登録されたもの（null）も全員として扱う
export const assigneeOf = (task) => task.assignee ?? 'both'

// 「全員」は夫・妻どちらの絞り込みにも含める
export function matchesAssignee(task, filter) {
  if (filter === 'all') return true
  return assigneeOf(task) === filter || assigneeOf(task) === 'both'
}

export function assigneeOptions(members) {
  const of = (role, name, emoji) => {
    const m = members.find((x) => x.role === role)
    return { key: role, label: m?.name ?? name, emoji: m?.emoji ?? emoji }
  }
  return [
    of('husband', '夫', '👨'),
    of('wife', '妻', '👩'),
    { key: 'both', label: '全員', emoji: '👫' },
  ]
}
