import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DataContext } from '../hooks/contexts'

const PAGE_SIZE = 1000

// Supabase は1回に1000件までしか返さないため、分けて取得する
async function fetchAll(makeQuery) {
  const all = []
  for (;;) {
    const { data, error } = await makeQuery().range(all.length, all.length + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < PAGE_SIZE) return all
  }
}

function DataProvider({ children }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [message, setMessage] = useState('')
  const requestRef = useRef(0)
  const pendingRef = useRef(0)

  const reload = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const [members, categories, items, photos] = await Promise.all([
        supabase.from('task_members').select('*'),
        supabase.from('task_categories').select('*').order('sort_order').order('created_at'),
        fetchAll(() => supabase.from('task_items').select('*').order('sort_order').order('created_at').order('id')),
        fetchAll(() => supabase.from('task_photos').select('*').order('created_at').order('id')),
      ])
      if (members.error) throw members.error
      if (categories.error) throw categories.error
      if (request !== requestRef.current) return // 古い取得結果で上書きしない
      setData({ members: members.data, categories: categories.data, items, photos })
      setLoadError(false)
    } catch (error) {
      console.error('取得失敗', error)
      if (request === requestRef.current) setLoadError(true)
    }
  }, [])

  useEffect(() => {
    reload()
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  // 相手の変更を受け取ったら取得し直す。再接続時も、切れていた間の変更を取り込む。
  useEffect(() => {
    let timer
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        // 書き込み中に古い内容へ戻って見えるのを防ぐ（書き込み後に必ず取得される）
        if (pendingRef.current === 0) reload()
      }, 300)
    }
    const channel = supabase.channel('family-task')
    for (const table of ['task_members', 'task_categories', 'task_items', 'task_photos']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    }
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') schedule() })
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [reload])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // 書き込みを実行し、成功したら取得し直す。成否を返す。
  // RLS は更新・削除をエラーにせず0件で返すため、件数も確認する。
  const write = useCallback(async (query, failText = '保存できませんでした。通信状態を確認してください') => {
    pendingRef.current++
    let result
    try {
      result = await query
    } finally {
      pendingRef.current--
    }
    const { data: rows, error } = result
    const ok = !error && rows?.length > 0
    if (!ok) {
      console.error('書き込み失敗', error)
      setMessage(failText)
    }
    await reload()
    return ok
  }, [reload])

  const updateItem = useCallback(async (id, patch) => {
    // 操作にすぐ反応させるため先に画面へ反映し、失敗したら元に戻す
    requestRef.current++
    const apply = (p) => setData((d) => ({ ...d, items: d.items.map((t) => (t.id === id ? { ...t, ...p(t) } : t)) }))
    let before = null
    apply((t) => {
      before ??= Object.fromEntries(Object.keys(patch).map((k) => [k, t[k]]))
      return patch
    })
    const ok = await write(supabase.from('task_items').update(patch).eq('id', id).select('id'))
    if (!ok && before) apply(() => before)
    return ok
  }, [write])

  const value = useMemo(
    () => ({ ...data, loaded: Boolean(data), loadError, reload, write, updateItem, message, setMessage }),
    [data, loadError, reload, write, updateItem, message]
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export default DataProvider
