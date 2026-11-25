import { useEffect, useRef, useState } from 'react'
import { Camera, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useData } from '../hooks/contexts'
import useSubmitLock from '../hooks/useSubmitLock'
import { assigneeOf, assigneeOptions } from '../lib/tasks'
import { MAX_PHOTOS, compressPhoto, deletePhotos, uploadPhoto } from '../lib/photos'
import { Photo, PhotoViewer } from './Photo'
import { INPUT_CLASS, PRIMARY_CLASS } from '../lib/ui'

const PHOTO_DELETE = 'absolute -top-1 -right-1 rounded-full bg-gray-800 p-1.5 text-white'

const toDraft = (t) => ({ id: t.id, title: t.title, assignee: assigneeOf(t), due_date: t.due_date, sort_order: t.sort_order })
const newSub = (sort_order) => ({ id: crypto.randomUUID(), title: '', assignee: 'both', due_date: null, sort_order })

function DateInput({ value, onChange, label }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <input type="date" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={INPUT_CLASS} />
      {value && <button type="button" aria-label={`${label}を消す`} onClick={() => onChange(null)} className="p-2 text-gray-500"><X size={18} /></button>}
    </span>
  )
}

function TaskEditor({ task, subs, defaultCategory, onClose }) {
  const { members, categories, photos, write, reload, updateItem, setMessage } = useData()
  const { busy, run } = useSubmitLock()
  const people = assigneeOptions(members)
  // 開いた時点の内容。新規でも id を先に決め、再送しても二重登録にならないようにする
  const [initial] = useState(() => ({
    form: task
      ? { id: task.id, title: task.title, category_id: task.category_id, assignee: assigneeOf(task), due_date: task.due_date, note: task.note ?? '', keep_photos: task.keep_photos }
      : { id: crypto.randomUUID(), title: '', category_id: defaultCategory, assignee: 'both', due_date: null, note: '', keep_photos: false },
    subs: subs.map(toDraft),
  }))
  const [form, setForm] = useState(initial.form)
  const [drafts, setDrafts] = useState(initial.subs)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setDraft = (id, patch) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  // 追加した写真は、保存するまで端末内に置く
  const [pending, setPending] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [viewing, setViewing] = useState(null)
  const attemptedRef = useRef(new Map()) // 送信を始めたが、登録が終わっていない写真
  const previewsRef = useRef([])
  const savedPhotos = photos.filter((p) => p.item_id === form.id)
  const room = MAX_PHOTOS - savedPhotos.length - pending.length

  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const addPhotos = async (e) => {
    const files = [...e.target.files]
    e.target.value = '' // 同じ写真を選び直せるようにする
    if (files.length > room) setMessage(`写真は1タスク${MAX_PHOTOS}枚までです`)
    setCompressing(true)
    for (const file of files.slice(0, room)) {
      try {
        const photo = await compressPhoto(file)
        previewsRef.current.push(photo.previewUrl)
        setPending((ps) => [...ps, photo])
      } catch (error) {
        console.error('写真の変換失敗', error)
        setMessage('読み込めない写真がありました')
      }
    }
    setCompressing(false)
  }

  const removePending = (photo) => {
    setPending((ps) => ps.filter((p) => p.id !== photo.id))
    const attempted = attemptedRef.current.get(photo.id)
    if (attempted) {
      attemptedRef.current.delete(photo.id)
      deletePhotos([attempted]).then(reload)
    }
  }

  const removeSaved = (photo) => {
    if (!window.confirm('この写真を削除しますか？元に戻せません。')) return
    run(async () => {
      if (!(await deletePhotos([photo]))) setMessage('写真を削除できませんでした')
      await reload()
    })
  }

  const uploadPending = async () => {
    let failed = 0
    for (const photo of pending) {
      const row = { id: photo.id, item_id: form.id }
      attemptedRef.current.set(photo.id, row)
      try {
        await uploadPhoto(form.id, photo)
        attemptedRef.current.delete(photo.id)
        setPending((ps) => ps.filter((p) => p.id !== photo.id))
      } catch (error) {
        console.error('写真の保存失敗', error)
        failed++
      }
    }
    await reload()
    if (failed > 0) setMessage(`写真${failed}枚を保存できませんでした。もう一度「保存」を押してください`)
    return failed === 0
  }

  // 送信が途中で止まった写真の後始末。記録だけ登録済みの場合もあるため両方消す
  const cleanUpPhotos = () => {
    const rows = [...attemptedRef.current.values()]
    if (rows.length > 0) deletePhotos(rows).then(reload)
  }

  const close = () => {
    const dirty = pending.length > 0 || JSON.stringify({ form, subs: drafts }) !== JSON.stringify(initial)
    if (busy || compressing || (dirty && !window.confirm('変更を保存せずに閉じますか？'))) return
    cleanUpPhotos()
    onClose()
  }

  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const title = form.title.trim()
      if (!title) { setMessage('題名を入力してください'); return false }
      const isSaved = (d) => initial.subs.some((s) => s.id === d.id)
      // 何も入力していない新しい行は無視する
      const kept = drafts.filter((d) => isSaved(d) || d.title.trim() || d.assignee !== 'both' || d.due_date)
      if (kept.some((d) => !d.title.trim())) { setMessage('サブタスクの題名を入力してください'); return false }

      const removed = initial.subs.filter((s) => !drafts.some((d) => d.id === s.id)).map((s) => s.id)
      if (removed.length > 0) {
        const ok = await write(supabase.from('task_items').update({ deleted_at: new Date().toISOString() }).in('id', removed).select('id'))
        if (!ok) return false
      }
      // 変更したサブタスクだけを親と1回で送り、途中まで保存される状態を避ける。
      // completed_at は含めず、その間に相手が付けた完了を消さない。
      const changed = kept.filter((d) => JSON.stringify(d) !== JSON.stringify(initial.subs.find((s) => s.id === d.id)))
      const rows = [
        { ...form, title, note: form.note.trim() || null, parent_id: null, sort_order: task?.sort_order ?? 0 },
        ...changed.map((d) => ({ ...d, title: d.title.trim(), category_id: null, note: null, keep_photos: false, parent_id: form.id })),
      ]
      const ok = await write(supabase.from('task_items').upsert(rows).select('id'))
      if (!ok || !(await uploadPending())) return false
      onClose()
      return true
    })
  }

  const remove = () => {
    if (!window.confirm('このタスクを削除しますか？（設定のゴミ箱から戻せます）')) return
    run(async () => {
      const ok = await updateItem(task.id, { deleted_at: new Date().toISOString() })
      if (ok) {
        cleanUpPhotos()
        onClose()
      }
      return ok
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-black/40">
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label={task ? 'タスクを編集' : 'タスクを追加'}
        className="flex w-full max-w-[480px] flex-col bg-[#f3f6f4] pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between px-2 py-2">
          <button type="button" onClick={close} aria-label="閉じる" className="p-2 text-gray-600"><X /></button>
          <h2 className="font-bold text-gray-700">{task ? 'タスクを編集' : 'タスクを追加'}</h2>
          {task ? <button type="button" disabled={busy} onClick={remove} aria-label="タスクを削除" className="p-2 text-red-600"><Trash2 size={20} /></button> : <span className="w-10" />}
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <label className="flex flex-col gap-1 text-sm text-gray-600">題名（必須）
            <input value={form.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} autoFocus={!task} className={INPUT_CLASS} />
          </label>
          <fieldset>
            <legend className="mb-1 text-sm text-gray-600">担当者</legend>
            <div className="grid grid-cols-3 gap-2">
              {people.map((p) => (
                <button key={p.key} type="button" aria-pressed={form.assignee === p.key} onClick={() => set({ assignee: p.key })}
                  className={`flex min-w-0 flex-col items-center rounded-xl border-2 bg-white py-2 text-xs ${form.assignee === p.key ? 'border-emerald-700 font-bold text-emerald-800' : 'border-transparent text-gray-600'}`}>
                  <span className="text-3xl">{p.emoji}</span><span className="max-w-full truncate px-1">{p.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm text-gray-600">カテゴリ
            <select value={form.category_id ?? ''} onChange={(e) => set({ category_id: e.target.value || null })} className={INPUT_CLASS}>
              <option value="">未分類</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm text-gray-600">期限
            <DateInput label="期限" value={form.due_date} onChange={(due_date) => set({ due_date })} />
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-600">備考
            <textarea rows={4} maxLength={5000} value={form.note} onChange={(e) => set({ note: e.target.value })} className={INPUT_CLASS} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-gray-600">写真（{savedPhotos.length + pending.length}/{MAX_PHOTOS}）</legend>
            <div className="grid grid-cols-4 gap-2">
              {savedPhotos.map((p, i) => (
                <span key={p.id} className="relative">
                  <button type="button" aria-label={`写真${i + 1}を見る`} onClick={() => setViewing(i)} className="block w-full">
                    <Photo photo={p} small className="aspect-square w-full rounded-lg object-cover" />
                  </button>
                  <button type="button" aria-label={`写真${i + 1}を削除`} disabled={busy} onClick={() => removeSaved(p)} className={PHOTO_DELETE}><X size={16} /></button>
                </span>
              ))}
              {pending.map((p, i) => (
                <span key={p.id} className="relative">
                  <img src={p.previewUrl} alt="追加する写真" className="aspect-square w-full rounded-lg object-cover" />
                  <button type="button" aria-label={`追加する写真${i + 1}を取り消す`} disabled={busy} onClick={() => removePending(p)} className={PHOTO_DELETE}><X size={16} /></button>
                </span>
              ))}
              {room > 0 && (
                <label className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-gray-400 text-xs text-gray-600">
                  <Camera size={22} />{compressing ? '準備中' : '追加'}
                  <input type="file" accept="image/*" multiple aria-label="写真を追加" disabled={busy || compressing} onChange={addPhotos} className="sr-only" />
                </label>
              )}
            </div>
            {savedPhotos.length + pending.length > 0 && (
              <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
                <input type="checkbox" checked={form.keep_photos} onChange={(e) => set({ keep_photos: e.target.checked })} className="size-5 accent-emerald-700" />
                📌 写真を残す（完了から90日後の自動削除をしない）
              </label>
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-gray-600">サブタスク</legend>
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-col gap-2 rounded-xl bg-white p-2">
                <div className="flex items-center gap-1">
                  <input aria-label="サブタスクの題名" placeholder="サブタスクの題名" value={d.title} maxLength={200}
                    onChange={(e) => setDraft(d.id, { title: e.target.value })} className={INPUT_CLASS} />
                  <button type="button" aria-label="サブタスクを削除" onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))} className="p-2 text-gray-500"><Trash2 size={18} /></button>
                </div>
                <div className="flex gap-2">
                  <select aria-label="サブタスクの担当者" value={d.assignee} onChange={(e) => setDraft(d.id, { assignee: e.target.value })}
                    className="w-28 shrink-0 rounded-lg border border-gray-300 bg-white px-1 text-gray-800">
                    {people.map((p) => <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>)}
                  </select>
                  <DateInput label="サブタスクの期限" value={d.due_date} onChange={(due_date) => setDraft(d.id, { due_date })} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setDrafts((ds) => [...ds, newSub(Math.max(0, ...ds.map((d) => d.sort_order)) + 1)])}
              className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-400 py-2.5 text-sm text-gray-600">
              <Plus size={16} />サブタスクを追加
            </button>
          </fieldset>
        </div>
        <footer className="flex flex-col bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="submit" disabled={busy || compressing} className={PRIMARY_CLASS}>{busy ? '保存中...' : '保存'}</button>
        </footer>
      </form>
      {viewing !== null && <PhotoViewer photos={savedPhotos} index={viewing} onMove={setViewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default TaskEditor
