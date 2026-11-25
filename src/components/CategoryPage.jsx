import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useData } from '../hooks/contexts'
import useSubmitLock from '../hooks/useSubmitLock'
import EmojiPicker from './EmojiPicker'
import { CATEGORY_EMOJIS, COLORS, INPUT_CLASS, PRIMARY_CLASS } from '../lib/ui'

const ICON_BUTTON = 'p-2 text-gray-600 disabled:opacity-25'

function CategoryPage() {
  const { categories, items, write, setMessage } = useData()
  const { busy, run } = useSubmitLock()
  const [form, setForm] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const table = () => supabase.from('task_categories')

  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const name = form.name.trim()
      if (!name) { setMessage('名前を入力してください'); return false }
      if (categories.some((c) => c.name === name && c.id !== form.id)) { setMessage(`「${name}」は既にあります`); return false }
      const ok = await write(table().upsert([{ id: form.id, name, emoji: form.emoji.trim() || '📁', color: form.color, sort_order: form.sort_order }]).select('id'))
      if (ok) setForm(null)
      return ok
    })
  }

  const move = (index, step) => run(async () => {
    const order = [...categories]
    const [moved] = order.splice(index, 1)
    order.splice(index + step, 0, moved)
    await write(table().upsert(order.map(({ id, name, emoji, color }, i) => ({ id, name, emoji, color, sort_order: i }))).select('id'))
  })

  const remove = (c) => {
    const count = items.filter((t) => t.category_id === c.id).length
    if (count > 0) { setMessage(`タスクが${count}件あるため削除できません（完了済み・ゴミ箱も含む）`); return }
    if (!window.confirm(`「${c.name}」を削除しますか？`)) return
    run(() => write(table().delete().eq('id', c.id).select('id'), '削除できませんでした。タスクが残っていないか確認してください'))
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="text-lg font-bold text-gray-700">カテゴリ</h1>
      {!form && categories.map((c, i) => (
        <div key={c.id} className="flex items-center rounded-xl border-l-4 bg-white py-1 pl-3" style={{ borderLeftColor: c.color }}>
          <span className="min-w-0 flex-1 truncate text-gray-800">{c.emoji} {c.name}</span>
          <button type="button" aria-label={`${c.name}を上へ`} disabled={busy || i === 0} onClick={() => move(i, -1)} className={ICON_BUTTON}><ChevronUp size={20} /></button>
          <button type="button" aria-label={`${c.name}を下へ`} disabled={busy || i === categories.length - 1} onClick={() => move(i, 1)} className={ICON_BUTTON}><ChevronDown size={20} /></button>
          <button type="button" aria-label={`${c.name}を編集`} onClick={() => setForm(c)} className={ICON_BUTTON}><Pencil size={18} /></button>
          <button type="button" aria-label={`${c.name}を削除`} disabled={busy} onClick={() => remove(c)} className={ICON_BUTTON}><Trash2 size={18} /></button>
        </div>
      ))}
      {!form && (
        <button type="button" className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-400 py-3 text-gray-600"
          onClick={() => setForm({ id: crypto.randomUUID(), name: '', emoji: '📁', color: COLORS[categories.length % COLORS.length], sort_order: Math.max(-1, ...categories.map((c) => c.sort_order)) + 1 })}>
          <Plus size={18} />カテゴリを追加
        </button>
      )}
      {form && (
        <form onSubmit={save} className="flex flex-col gap-3 rounded-xl bg-white p-4">
          <input aria-label="カテゴリ名" placeholder="例: 家事系" maxLength={50} value={form.name} onChange={(e) => set({ name: e.target.value })} className={INPUT_CLASS} />
          <EmojiPicker value={form.emoji} onChange={(emoji) => set({ emoji })} choices={CATEGORY_EMOJIS} />
          <div className="flex justify-between">
            {COLORS.map((color, i) => (
              <button key={color} type="button" aria-label={`色${i + 1}`} aria-pressed={form.color === color} onClick={() => set({ color })}
                style={{ backgroundColor: color }} className={`size-8 rounded-full ${form.color === color ? 'ring-2 ring-gray-800 ring-offset-2' : ''}`} />
            ))}
          </div>
          <button type="submit" disabled={busy} className={PRIMARY_CLASS}>保存</button>
          <button type="button" onClick={() => setForm(null)} className="py-1 text-sm text-gray-500">キャンセル</button>
        </form>
      )}
    </div>
  )
}

export default CategoryPage
