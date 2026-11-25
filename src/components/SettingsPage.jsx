import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth, useData } from '../hooks/contexts'
import useSubmitLock from '../hooks/useSubmitLock'
import { INPUT_CLASS } from '../lib/ui'

function MemberRow({ member, isMe }) {
  const { write, setMessage } = useData()
  const { busy, run } = useSubmitLock()
  const [name, setName] = useState(member.name)
  const [emoji, setEmoji] = useState(member.emoji)
  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const ok = await write(supabase.from('task_members')
        .update({ name: name.trim() || member.name, emoji: emoji.trim() || member.emoji }).eq('user_id', member.user_id).select('user_id'))
      if (ok) setMessage('保存しました')
      return ok
    })
  }
  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <input aria-label="絵文字" maxLength={16} value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-14 shrink-0 rounded-lg border border-gray-300 bg-white py-2.5 text-center" />
      <input aria-label="名前" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
      <span className="w-8 shrink-0 text-xs text-gray-500">{isMe && '自分'}</span>
      <button type="submit" disabled={busy} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">保存</button>
    </form>
  )
}

function SettingsPage() {
  const { userId, logout } = useAuth()
  const { members, items, write, updateItem } = useData()
  const { busy, run } = useSubmitLock()
  const byId = new Map(items.map((t) => [t.id, t]))
  // 親も削除されているサブタスクは、親を戻すまで表示しない
  const trash = items.filter((t) => t.deleted_at && !byId.get(t.parent_id)?.deleted_at)
    .sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))

  const purge = (t) => {
    if (!window.confirm(`「${t.title}」を完全に削除しますか？サブタスクも消え、元に戻せません。`)) return
    run(() => write(supabase.from('task_items').delete().eq('id', t.id).select('id')))
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-lg font-bold text-gray-700">担当者の表示</h1>
        {[...members].sort((a, b) => a.role.localeCompare(b.role)).map((m) => <MemberRow key={m.user_id} member={m} isMe={m.user_id === userId} />)}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-gray-700">ゴミ箱</h2>
        {trash.length === 0 && <p className="text-sm text-gray-500">空です</p>}
        {trash.map((t) => (
          <div key={t.id} className="flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-sm">
            <span className="min-w-0 flex-1 break-words text-gray-700">{t.title}
              {t.parent_id && <span className="block text-xs text-gray-500">サブタスク（{byId.get(t.parent_id)?.title}）</span>}
            </span>
            <button type="button" onClick={() => updateItem(t.id, { deleted_at: null })} className="shrink-0 p-2 font-bold text-emerald-700">戻す</button>
            <button type="button" disabled={busy} onClick={() => purge(t)} className="shrink-0 p-2 text-red-600">完全削除</button>
          </div>
        ))}
      </section>
      <button type="button" onClick={logout} className="rounded-xl bg-white py-3 text-gray-600">ログアウト</button>
    </div>
  )
}

export default SettingsPage
