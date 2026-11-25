import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DataContext } from '../hooks/contexts'

const PAGE_SIZE = 1000

// Supabase は1回に1000件までしか返さないため、分けて取得する
async function fetchAllItems() {
  const all = []
  for (;;) {
    const { data, error } = await supabase.from('task_items').select('*')
      .order('sort_order').order('created_at').order('id').range(all.length, all.length + PAGE_SIZE - 1)
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

  const reload = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const [members, categories, items] = await Promise.all([
        supabase.from('task_members').select('*'),
        supabase.from('task_categories').select('*').order('sort_order').order('created_at'),
        fetchAllItems(),
      ])
      if (members.error) throw members.error
      if (categories.error) throw categories.error
      if (request !== requestRef.current) return // 古い取得結果で上書きしない
      setData({ members: members.data, categories: categories.data, items })
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

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // 書き込みを実行し、成功したら取得し直す。成否を返す。
  // RLS は更新・削除をエラーにせず0件で返すため、件数も確認する。
  const write = useCallback(async (query, failText = '保存できませんでした。通信状態を確認してください') => {
    const { data: rows, error } = await query
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
