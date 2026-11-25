import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { INPUT_CLASS, PRIMARY_CLASS } from '../lib/ui'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErrorText('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      console.error('ログイン失敗', error)
      setErrorText(
        error.code === 'invalid_credentials'
          ? 'メールアドレスかパスワードが違います'
          : 'ログインできませんでした。通信状態を確認してください'
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-center gap-3 p-6">
      <p className="text-center text-5xl">👫</p>
      <h1 className="text-center text-xl font-bold text-gray-700">家族タスク</h1>
      <p className="mb-2 text-center text-sm text-gray-500">家計簿と同じアカウントでログインできます</p>
      <input type="email" name="username" autoComplete="username" autoCapitalize="none" aria-label="メールアドレス"
        placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT_CLASS} />
      <input type="password" name="password" autoComplete="current-password" aria-label="パスワード"
        placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} required className={INPUT_CLASS} />
      {errorText && <p role="alert" className="text-center text-sm text-red-600">{errorText}</p>}
      <button type="submit" disabled={busy} className={PRIMARY_CLASS}>{busy ? 'ログイン中...' : 'ログイン'}</button>
    </form>
  )
}

export default LoginPage
